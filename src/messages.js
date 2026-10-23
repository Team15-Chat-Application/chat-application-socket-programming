const { randomUUID } = require('node:crypto');
const { AppError, failure } = require('./errors');
const { sanitizeMessage } = require('./input');
const { roomChannel } = require('./rooms');

// CHAT-F-005/006: the sender's identity comes from the verified token, and content
// length and markup policy come from the shared helper, never from this module.
class MessageService {
  constructor({ rooms, newId = randomUUID, clock = () => new Date().toISOString() } = {}) {
    if (!rooms) throw new Error('A RoomStore instance is required');
    this.rooms = rooms;
    this.newId = newId;
    this.clock = clock;
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
    return {
      messageId,
      roomId: room.roomId,
      senderId: identity.userId,
      content,
      createdAt: this.clock()
    };
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
      respond({ ok: true, data: message });
    } catch (error) {
      respond(failure(error));
    }
  });
}

module.exports = { MessageService, registerMessageHandlers };
