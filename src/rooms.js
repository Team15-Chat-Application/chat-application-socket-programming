const { randomUUID } = require('node:crypto');
const { AppError, failure } = require('./errors');

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
  return name;
}

class RoomStore {
  #rooms = new Map();
  constructor({ newId = randomUUID } = {}) { this.newId = newId; }
  create(identity, payload) {
    if (!identity || typeof identity.userId !== 'string' || !identity.userId ||
        typeof identity.sessionId !== 'string' || !identity.sessionId) {
      throw new AppError('UNAUTHORIZED', 'A verified identity is required');
    }
    const name = validateRoomName(payload);
    const roomId = this.newId();
    if (typeof roomId !== 'string' || !roomId || this.#rooms.has(roomId)) {
      throw new Error('Room ID allocation failed');
    }
    const room = Object.freeze({ roomId, name, memberCount: 0 });
    this.#rooms.set(roomId, room);
    return { ...room };
  }
  list() { return Array.from(this.#rooms.values(), room => ({ ...room })); }
}

function registerRoomHandlers(socket, rooms) {
  socket.on('room:create', (payload, acknowledge) => {
    const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
    try { respond({ ok: true, data: rooms.create(socket.data.identity, payload) }); }
    catch (error) { respond(failure(error)); }
  });
  socket.on('room:list', (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') return;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      acknowledge(failure(new AppError('VALIDATION_ERROR', 'payload must be an object')));
      return;
    }
    try { acknowledge({ ok: true, data: { rooms: rooms.list() } }); }
    catch (error) { acknowledge(failure(error)); }
  });
}
module.exports = { MAX_ROOM_NAME_LENGTH, validateRoomName, RoomStore, registerRoomHandlers };
