
const { randomUUID } = require('node:crypto');
const { AppError, failure } = require('./errors');
const { sanitizeMessage } = require('./input');
const { roomChannel } = require('./rooms');
const { audit } = require('./audit');

class MessageService {
  constructor({
    rooms,
    database,
    newId = randomUUID,
    clock = () => new Date().toISOString()
  } = {}) {
    if (!rooms) throw new Error('A RoomStore instance is required');
    if (!database) throw new Error('A database instance is required');

    this.rooms = rooms;
    this.database = database;
    this.newId = newId;
    this.clock = clock;
  }

  send(identity, socketId, payload) {
    if (
      !identity ||
      typeof identity.userId !== 'string' ||
      !identity.userId ||
      typeof identity.sessionId !== 'string' ||
      !identity.sessionId
    ) {
      throw new AppError('UNAUTHORIZED', 'A verified identity is required');
    }

    const room = this.rooms.get(payload);

    if (!this.rooms.hasSocket(room.roomId, socketId)) {
      throw new AppError('FORBIDDEN', 'Join the room before sending messages');
    }

    const content = sanitizeMessage(payload.content);
    const messageId = this.newId();

    if (typeof messageId !== 'string' || !messageId) {
      throw new Error('Message ID allocation failed');
    }

    const message = {
      messageId,
      roomId: room.roomId,
      senderId: identity.userId,
      content,
      createdAt: this.clock()
    };

    // Save the message before broadcasting.
    // The database assigns the initial status: pending.
    this.database.saveMessage(message);

    return message;
  }

  getHistory(identity, socketId, payload) {
    if (
      !identity ||
      typeof identity.userId !== 'string' ||
      !identity.userId ||
      typeof identity.sessionId !== 'string' ||
      !identity.sessionId
    ) {
      throw new AppError('UNAUTHORIZED', 'A verified identity is required');
    }

    const room = this.rooms.get(payload);

    if (!this.rooms.hasSocket(room.roomId, socketId)) {
      throw new AppError(
        'FORBIDDEN',
        'Join the room before retrieving messages'
      );
    }

    return {
      roomId: room.roomId,
      messages: this.database.getRecentMessages(room.roomId, 50)
    };
  }

  // CHAT-24: Update delivery status after successful broadcast.
  markDelivered(messageId) {
    if (typeof messageId !== 'string' || !messageId) {
      throw new Error('A valid message ID is required');
    }

    const updatedRows = this.database.markMessageDelivered(messageId);

    if (updatedRows !== 1) {
      throw new Error('Message delivery status could not be updated');
    }

    return {
      messageId,
      deliveryStatus: 'delivered'
    };
  }

  // CHAT-25: Record that a room member has read a message.
  markRead(identity, socketId, payload) {
    if (
      !identity ||
      typeof identity.userId !== 'string' ||
      !identity.userId ||
      typeof identity.sessionId !== 'string' ||
      !identity.sessionId
    ) {
      throw new AppError('UNAUTHORIZED', 'A verified identity is required');
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      typeof payload.messageId !== 'string' ||
      !payload.messageId ||
      typeof payload.roomId !== 'string' ||
      !payload.roomId
    ) {
      throw new AppError(
        'VALIDATION_ERROR',
        'roomId and messageId are required'
      );
    }

    const room = this.rooms.get({ roomId: payload.roomId });

    if (!this.rooms.hasSocket(room.roomId, socketId)) {
      throw new AppError(
        'FORBIDDEN',
        'Join the room before marking messages as read'
      );
    }

    // Retrieve the message and verify that it belongs to this room.
    const message = this.database.findMessageById(payload.messageId);

    if (!message || message.roomId !== room.roomId) {
      throw new AppError('NOT_FOUND', 'Message not found in this room');
    }

    // A sender does not create a read receipt for their own message.
    if (message.senderId === identity.userId) {
      throw new AppError(
        'FORBIDDEN',
        'You cannot mark your own message as read'
      );
    }

    const readAt = this.clock();

    // INSERT OR IGNORE makes repeated read events idempotent.
    const inserted = this.database.markMessageRead(
      message.messageId,
      identity.userId,
      readAt
    );

    // Return the original receipt if it already existed.
    const receipts = this.database.getMessageReadReceipts(
      message.messageId
    );

    const receipt = receipts.find(
      item => item.userId === identity.userId
    );

    if (!receipt) {
      throw new Error('Read receipt could not be retrieved');
    }

    return {
      roomId: room.roomId,
      messageId: message.messageId,
      readerId: identity.userId,
      readAt: receipt.readAt,
      alreadyRead: inserted === 0
    };
  }
}

function registerMessageHandlers(socket, service, io) {
  socket.on('message:send', (payload, acknowledge) => {
    const respond =
      typeof acknowledge === 'function' ? acknowledge : () => {};

    try {
      const message = service.send(
        socket.data.identity,
        socket.id,
        payload
      );

      const channel = roomChannel(message.roomId);

      // Step 1: Broadcast the saved message.
      io.to(channel).emit('message:received', message);

      // Step 2: The server's broadcast call succeeded.
      // Update persistent delivery status.
      const delivery = service.markDelivered(message.messageId);

      // Step 3: Notify room members about the status change.
      io.to(channel).emit('message:delivered', {
        roomId: message.roomId,
        ...delivery
      });

      // Step 4: Acknowledge the sender.
      respond({
        ok: true,
        data: message
      });
    } catch (error) {
      audit('message-send', failure(error).error.code);
      respond(failure(error));
    }
  });

  socket.on('message:history', (payload, acknowledge) => {
    const respond =
      typeof acknowledge === 'function' ? acknowledge : () => {};

    try {
      const history = service.getHistory(
        socket.data.identity,
        socket.id,
        payload
      );

      respond({
        ok: true,
        data: history
      });
    } catch (error) {
      audit('message-history', failure(error).error.code);
      respond(failure(error));
    }
  });

  // CHAT-25: Handle read receipts.
  socket.on('message:read', (payload, acknowledge) => {
    const respond =
      typeof acknowledge === 'function' ? acknowledge : () => {};

    try {
      const receipt = service.markRead(
        socket.data.identity,
        socket.id,
        payload
      );

      // Notify all members of the room about the read receipt.
      // The sender can use this event to display read status.
      io.to(roomChannel(receipt.roomId)).emit('message:read', receipt);

      respond({
        ok: true,
        data: receipt
      });
    } catch (error) {
      audit('message-read', failure(error).error.code);
      respond(failure(error));
    }
  });
}

module.exports = {
  MessageService,
  registerMessageHandlers
};
