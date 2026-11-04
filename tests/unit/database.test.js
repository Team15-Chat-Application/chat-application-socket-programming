
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../../src/database');

describe('Database Tests - CHAT-22 and CHAT-24', () => {
  let tempDirectory;
  let dbPath;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'chat-database-test-')
    );

    dbPath = path.join(tempDirectory, 'chat.sqlite');
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, {
      recursive: true,
      force: true
    });
  });

  // CHAT-22: Message persistence across database restarts.
  test('messages remain available after closing and reopening SQLite', () => {
    const firstDatabase = createDatabase(dbPath);

    firstDatabase.createUser({
      userId: 'alice',
      username: 'alice',
      passwordHash: 'test-only-password-hash'
    });

    firstDatabase.saveMessage({
      messageId: 'message-1',
      roomId: 'room-1',
      senderId: 'alice',
      content: 'First persistent message',
      createdAt: '2026-11-04T09:00:00.000Z'
    });

    firstDatabase.saveMessage({
      messageId: 'message-2',
      roomId: 'room-1',
      senderId: 'alice',
      content: 'Second persistent message',
      createdAt: '2026-11-04T09:01:00.000Z'
    });

    firstDatabase.close();

    // Reopen the same SQLite database file.
    const reopenedDatabase = createDatabase(dbPath);

    try {
      const messages = reopenedDatabase.getRecentMessages(
        'room-1',
        50
      );

      expect(messages).toHaveLength(2);

      expect(messages.map(message => message.content)).toEqual([
        'First persistent message',
        'Second persistent message'
      ]);

      expect(messages[0].messageId).toBe('message-1');
      expect(messages[1].messageId).toBe('message-2');

      // Existing messages default to pending.
      expect(messages[0].deliveryStatus).toBe('pending');
      expect(messages[1].deliveryStatus).toBe('pending');
    } finally {
      reopenedDatabase.close();
    }
  });

  // CHAT-24: Delivery status changes from pending to delivered.
  test('message delivery status changes from pending to delivered', () => {
    const database = createDatabase(dbPath);

    try {
      database.createUser({
        userId: 'alice',
        username: 'alice',
        passwordHash: 'test-only-password-hash'
      });

      database.saveMessage({
        messageId: 'delivery-test-1',
        roomId: 'room-1',
        senderId: 'alice',
        content: 'Delivery test message',
        createdAt: '2026-11-04T09:00:00.000Z'
      });

      // Verify initial delivery status.
      const pendingMessages = database.getRecentMessages('room-1');

      expect(pendingMessages).toHaveLength(1);
      expect(pendingMessages[0].deliveryStatus).toBe('pending');

      // Mark the message as delivered.
      const updatedRows = database.markMessageDelivered(
        'delivery-test-1'
      );

      expect(updatedRows).toBe(1);

      // Verify updated delivery status.
      const deliveredMessages = database.getRecentMessages('room-1');

      expect(deliveredMessages).toHaveLength(1);
      expect(deliveredMessages[0].deliveryStatus).toBe('delivered');

      expect(deliveredMessages[0].messageId).toBe('delivery-test-1');
    } finally {
      database.close();
    }
  });

  // CHAT-24: Updating a nonexistent message must not report success.
  test('marking a nonexistent message as delivered updates zero rows', () => {
    const database = createDatabase(dbPath);

    try {
      const updatedRows = database.markMessageDelivered(
        'nonexistent-message'
      );

      expect(updatedRows).toBe(0);
    } finally {
      database.close();
    }
  });
});
