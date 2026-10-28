const { randomUUID } = require('node:crypto');
const { AppError, failure } = require('./errors');
const { sanitizeMessage } = require('./input');
const { roomChannel } = require('./rooms');
const { audit } = require('./audit');

// CHAT-F-005/006: the sender's identity comes from the verified token, and content
// length and markup policy come from the shared helper, never from this module.
class MessageService {
  constructor({ rooms, newId = randomUUID, clock = () => new Date().toISOString(), history = null } = {}) {
    if (!rooms) throw new Error('A RoomStore instance is required');
    this.rooms = rooms;
    this.newId = newId;
    this.clock = clock;
    this.history = history;
  }

  // Order follows the contract: resolve the room, authorise this socket's membership,
  // then validate and sanitise the content.
  send(identity, socketId, payload) {
    if (!identity || typeof identity.userId !== 'string' || !identity.userId ||
        typeof identity.sessionId !== 'string' || !identity.sessionId) {
      throw new AppError('UNAUTHORIZED', 'A verified identity is required');
    }
    const room = this.rooms.get(payload);
    if (!this.rooms.hasSocket(room.roomId, socketId)) {
      throw new AppError('FORBIDDEN', 'Join the room before sending messages');
    }
    const content = sanitizeMessage(payload.content);
    const messageId = this.newId();
    if (typeof messageId !== 'string' || !messageId) throw new Error('Message ID allocation failed');
    const message = {
      messageId,
      roomId: room.roomId,
      senderId: identity.userId,
      content,
      createdAt: this.clock()
    };
    this.history?.save(message);
    return this.history ? this.history.get(message.messageId) : message;
  }
}

// The sender is acknowledged only after the broadcast has been dispatched, which is
// the whole of CHAT-F-006. Per-recipient delivery confirmation is not claimed here;
// it belongs to the delivered/read status work (CHAT-24/25).
function registerMessageHandlers(socket, service, io) {
  socket.on('message:send', (payload, acknowledge) => {
    const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
    try {
      const message = service.send(socket.data.identity, socket.id, payload);
      io.to(roomChannel(message.roomId)).emit('message:received', message);
      if (service.history) {
        const delivered = service.history.delivered(message.messageId);
        io.to(roomChannel(message.roomId)).emit('message:status', delivered);
        respond({ ok: true, data: delivered });
      } else respond({ ok: true, data: message });
    } catch (error) {
      audit('message-send', failure(error).error.code);
      respond(failure(error));
    }
  });
  for (const event of ['room:history','message:read']) socket.on(event, (payload, acknowledge) => {
    const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
    try {
      if (!service.history) throw new AppError('NOT_FOUND', 'History storage is unavailable');
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AppError('VALIDATION_ERROR', 'payload must be an object');
      let roomId = payload.roomId;
      if (event === 'message:read') {
        if (typeof payload.messageId !== 'string' || !payload.messageId || payload.messageId.length > 128) throw new AppError('VALIDATION_ERROR', 'Invalid messageId');
        roomId = service.history.get(payload.messageId).roomId;
      }
      service.rooms.get({ roomId });
      if (!service.rooms.hasSocket(roomId,socket.id)) throw new AppError('FORBIDDEN', 'Join the room first');
      if (event === 'room:history') respond({ ok:true,data:{roomId,messages:service.history.history(roomId)} });
      else {
        const message = service.history.read(payload.messageId,socket.data.identity.userId);
        io.to(roomChannel(roomId)).emit('message:status',message);
        respond({ok:true,data:message});
      }
    } catch(error) { audit('message-history',failure(error).error.code); respond(failure(error)); }
  });
}

module.exports = { MessageService, registerMessageHandlers };
