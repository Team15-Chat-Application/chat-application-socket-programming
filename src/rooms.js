const { randomUUID } = require('node:crypto');
const { AppError, failure } = require('./errors');
const { sanitizePlainText } = require('./input');

const MAX_ROOM_NAME_LENGTH = 64;
function validateRoomName(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.name !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'name must be a string');
  }
  // Use the same explicit edge whitespace and Unicode code-point count in both backends.
  const name = payload.name.replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, '');
  if (![...name].length || [...name].length > MAX_ROOM_NAME_LENGTH || /[\p{Cc}\p{Cs}]/u.test(name)) {
    throw new AppError('VALIDATION_ERROR', 'name must contain 1 to 64 characters without control characters');
  }
  const clean = sanitizePlainText(name).replace(/^[ \t\r\n\f\v]+|[ \t\r\n\f\v]+$/g, '');
  if (!clean) throw new AppError('VALIDATION_ERROR', 'name is empty after sanitisation');
  return clean;
}

const CATALOGUE_CHANNEL = 'chat:catalogue';
const roomChannel = roomId => `chat:room:${roomId}`;
function requireIdentity(identity) {
  if (!identity || typeof identity.userId !== 'string' || !identity.userId ||
      typeof identity.sessionId !== 'string' || !identity.sessionId) {
    throw new AppError('UNAUTHORIZED', 'A verified identity is required');
  }
}

class RoomStore {
  #rooms = new Map();
  #members = new Map();
  #sockets = new Map();
  constructor({ newId = randomUUID } = {}) { this.newId = newId; }
  create(identity, payload) {
    requireIdentity(identity);
    const name = validateRoomName(payload);
    const roomId = this.newId();
    if (typeof roomId !== 'string' || !roomId || this.#rooms.has(roomId)) {
      throw new Error('Room ID allocation failed');
    }
    const room = Object.freeze({ roomId, name, memberCount: 0 });
    this.#rooms.set(roomId, room);
    this.#members.set(roomId, new Map());
    return { ...room };
  }
  get(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        typeof payload.roomId !== 'string' || !payload.roomId || payload.roomId.length > 128) {
      throw new AppError('VALIDATION_ERROR', 'roomId must be a nonempty string of at most 128 characters');
    }
    const room = this.#rooms.get(payload.roomId);
    if (!room) throw new AppError('NOT_FOUND', 'Room not found');
    return { ...room, memberCount: this.#members.get(room.roomId).size };
  }
  list() { return Array.from(this.#rooms.keys(), roomId => this.get({ roomId })); }
  join(identity, socketId, payload) {
    requireIdentity(identity);
    const room = this.get(payload);
    if (typeof socketId !== 'string' || !socketId) throw new Error('Socket identity is required');
    const binding = this.#sockets.get(socketId);
    if (binding && binding.identity.userId !== identity.userId) throw new AppError('FORBIDDEN', 'Socket identity cannot change');
    const users = this.#members.get(room.roomId);
    const sockets = users.get(identity.userId) || new Set();
    const changed = sockets.size === 0;
    sockets.add(socketId);
    users.set(identity.userId, sockets);
    const connection = binding || { identity: { ...identity }, rooms: new Set() };
    connection.rooms.add(room.roomId);
    this.#sockets.set(socketId, connection);
    return { room: this.get(payload), changed };
  }
  leave(identity, socketId, payload) {
    requireIdentity(identity);
    this.get(payload);
    const binding = this.#sockets.get(socketId);
    if (binding && binding.identity.userId !== identity.userId) throw new AppError('FORBIDDEN', 'Socket identity cannot change');
    const users = this.#members.get(payload.roomId);
    const sockets = users.get(identity.userId);
    const removed = sockets?.delete(socketId) === true;
    const changed = removed && sockets.size === 0;
    if (changed) users.delete(identity.userId);
    if (binding) {
      binding.rooms.delete(payload.roomId);
      if (!binding.rooms.size) this.#sockets.delete(socketId);
    }
    return { room: this.get(payload), changed };
  }
  disconnect(socketId) {
    const binding = this.#sockets.get(socketId);
    if (!binding) return [];
    const notices = [];
    for (const roomId of [...binding.rooms]) {
      const result = this.leave(binding.identity, socketId, { roomId });
      if (result.changed) notices.push({ roomId, userId: binding.identity.userId, action: 'leave', memberCount: result.room.memberCount });
    }
    return notices;
  }
  hasMember(roomId, userId) { return this.#members.get(roomId)?.has(userId) === true; }
  hasSocket(roomId, socketId) { return this.#sockets.get(socketId)?.rooms.has(roomId) === true; }
}

function registerRoomHandlers(socket, rooms, io, validateSession) {
  const catalogue = () => io.to(CATALOGUE_CHANNEL).emit('room:list-updated', { rooms: rooms.list() });
  const membership = data => io.to(roomChannel(data.roomId)).emit('room:membership', data);
  socket.join(CATALOGUE_CHANNEL);
  socket.emit('room:list-updated', { rooms: rooms.list() });
  // Serialise membership operations for one socket, including rapid duplicate requests.
  let pending = Promise.resolve();
  async function ensureLiveSession() {
    let valid = false;
    try { valid = await validateSession() === true; } catch { /* fail closed */ }
    if (!socket.connected) return false;
    if (!valid) {
      socket.emit('system:error', failure(new AppError('UNAUTHORIZED', 'Session is no longer valid')));
      socket.disconnect(true);
    }
    return valid;
  }
  function handle(event, operation) {
    socket.on(event, (payload, acknowledge) => {
      const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
      pending = pending.then(async () => {
        if (!socket.connected) return;
        try {
          // Queued work must not reuse a validation performed before it waited.
          if (!await ensureLiveSession()) return;
          const data = await operation(payload);
          if (socket.connected) respond({ ok: true, data });
        }
        catch (error) { if (socket.connected) respond(failure(error)); }
      }).catch(() => {}); // An acknowledgement/transport failure must not poison the next queued event.
    });
  }
  handle('room:create', payload => {
    const room = rooms.create(socket.data.identity, payload);
    catalogue();
    return room;
  });
  handle('room:list', payload => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new AppError('VALIDATION_ERROR', 'payload must be an object');
    }
    return { rooms: rooms.list() };
  });
  handle('room:join', async payload => {
    const room = rooms.get(payload);
    await socket.join(roomChannel(room.roomId));
    if (!await ensureLiveSession()) return;
    const result = rooms.join(socket.data.identity, socket.id, payload);
    if (result.changed) {
      membership({ roomId: room.roomId, userId: socket.data.identity.userId, action: 'join', memberCount: result.room.memberCount });
      catalogue();
    }
    return result.room;
  });
  handle('room:leave', async payload => {
    const room = rooms.get(payload);
    await socket.leave(roomChannel(room.roomId));
    if (!await ensureLiveSession()) return;
    const result = rooms.leave(socket.data.identity, socket.id, payload);
    if (result.changed) {
      membership({ roomId: room.roomId, userId: socket.data.identity.userId, action: 'leave', memberCount: result.room.memberCount });
      catalogue();
    }
    return { roomId: room.roomId };
  });
  socket.on('disconnect', () => {
    const notices = rooms.disconnect(socket.id);
    for (const notice of notices) membership(notice);
    if (notices.length) catalogue();
  });
}
module.exports = { MAX_ROOM_NAME_LENGTH, CATALOGUE_CHANNEL, roomChannel, validateRoomName, RoomStore, registerRoomHandlers };
