
const { DatabaseSync: Database } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

function createDatabase(dbPath = path.join(__dirname, '..', 'data', 'chat.sqlite')) {
  const directory = path.dirname(dbPath);
  fs.mkdirSync(directory, { recursive: true });

  const db = new Database(dbPath);

  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER DEFAULT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id
      ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (delivery_status IN ('pending', 'delivered')),
      FOREIGN KEY (sender_id) REFERENCES users(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_created
      ON messages(room_id, created_at DESC, message_id DESC);
  `);

  // CHAT-24 migration: preserve existing messages.
  const messageColumns = db.prepare(
    'PRAGMA table_info(messages)'
  ).all();

  if (!messageColumns.some(column => column.name === 'delivery_status')) {
    db.exec(`
      ALTER TABLE messages
      ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'pending'
    `);
  }

  // CHAT-25: Store read receipts separately for every user.
  // A group message can be read by one member while remaining unread
  // for other members.
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_reads (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id),
      FOREIGN KEY (message_id)
        REFERENCES messages(message_id)
        ON DELETE CASCADE,
      FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_message_reads_user
      ON message_reads(user_id, read_at DESC);
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages (
      message_id,
      room_id,
      sender_id,
      content,
      created_at
    )
    VALUES (
      @messageId,
      @roomId,
      @senderId,
      @content,
      @createdAt
    )
  `);

  // CHAT-23: Retrieve the newest messages first.
  // rowid provides deterministic insertion ordering when timestamps
  // are identical. The getRecentMessages function reverses the result
  // to return messages in chronological order.
  const findMessages = db.prepare(`
    SELECT
      message_id AS messageId,
      room_id AS roomId,
      sender_id AS senderId,
      content,
      created_at AS createdAt,
      delivery_status AS deliveryStatus
    FROM messages
    WHERE room_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `);

  const markDelivered = db.prepare(`
    UPDATE messages
    SET delivery_status = 'delivered'
    WHERE message_id = ?
  `);

  const findMessage = db.prepare(`
    SELECT
      message_id AS messageId,
      room_id AS roomId,
      sender_id AS senderId,
      content,
      created_at AS createdAt,
      delivery_status AS deliveryStatus
    FROM messages
    WHERE message_id = ?
  `);

  const insertReadReceipt = db.prepare(`
    INSERT OR IGNORE INTO message_reads (
      message_id,
      user_id,
      read_at
    )
    VALUES (?, ?, ?)
  `);

  const findReadReceipts = db.prepare(`
    SELECT
      message_id AS messageId,
      user_id AS userId,
      read_at AS readAt
    FROM message_reads
    WHERE message_id = ?
    ORDER BY read_at ASC, user_id ASC
  `);

  return {
    findUserByUsername(username) {
      return db.prepare(`
        SELECT
          user_id AS userId,
          username,
          password_hash AS passwordHash,
          role,
          failed_attempts AS failedAttempts,
          locked_until AS lockedUntil
        FROM users
        WHERE username = ?
      `).get(username);
    },

    findUserById(userId) {
      return db.prepare(`
        SELECT
          user_id AS userId,
          username,
          role
        FROM users
        WHERE user_id = ?
      `).get(userId);
    },

    createUser({ userId, username, passwordHash }) {
      try { db.prepare(`
        INSERT INTO users (user_id, username, password_hash)
        VALUES (?, ?, ?)
      `).run(userId, username, passwordHash); }
      catch (error) {
        if (error.errcode === 2067 || error.errcode === 1555) error.code = 'SQLITE_CONSTRAINT_UNIQUE';
        throw error;
      }
    },

    recordFailedLogin(userId, failedAttempts, lockedUntil) {
      db.prepare(`
        UPDATE users
        SET failed_attempts = ?, locked_until = ?
        WHERE user_id = ?
      `).run(failedAttempts, lockedUntil, userId);
    },

    resetFailedLogins(userId) {
      db.prepare(`
        UPDATE users
        SET failed_attempts = 0, locked_until = NULL
        WHERE user_id = ?
      `).run(userId);
    },

    createSession({ sessionId, userId, expiresAt }) {
      db.prepare(`
        INSERT INTO sessions (session_id, user_id, expires_at)
        VALUES (?, ?, ?)
      `).run(sessionId, userId, expiresAt);
    },

    findSession(sessionId) {
      return db.prepare(`
        SELECT
          session_id AS sessionId,
          user_id AS userId,
          expires_at AS expiresAt,
          revoked_at AS revokedAt
        FROM sessions
        WHERE session_id = ?
      `).get(sessionId);
    },

    revokeSession(sessionId, revokedAt) {
      return db.prepare(`
        UPDATE sessions
        SET revoked_at = ?
        WHERE session_id = ? AND revoked_at IS NULL
      `).run(revokedAt, sessionId).changes;
    },

    saveMessage(message) {
      insertMessage.run(message);
      return message;
    },

    // CHAT-24: Mark a message as delivered after broadcast confirmation.
    markMessageDelivered(messageId) {
      return markDelivered.run(messageId).changes;
    },

    // CHAT-25: Find a message before recording its read receipt.
    findMessageById(messageId) {
      return findMessage.get(messageId);
    },

    // CHAT-25: Record one read receipt per user and message.
    // Returns 1 for a new receipt and 0 if it already exists.
    markMessageRead(messageId, userId, readAt) {
      return insertReadReceipt.run(
        messageId,
        userId,
        readAt
      ).changes;
    },

    // CHAT-25: Retrieve all users who have read a message.
    getMessageReadReceipts(messageId) {
      return findReadReceipts.all(messageId);
    },

    // CHAT-23: Return the latest messages in chronological order.
    getRecentMessages(roomId, limit = 50) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new RangeError(
          'Message history limit must be between 1 and 50'
        );
      }

      return findMessages.all(roomId, limit).reverse();
    },

    close() {
      db.close();
    }
  };
}

module.exports = { createDatabase };
