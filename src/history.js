const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const { AppError } = require('./errors');

class HistoryStore {
  constructor(filename = ':memory:') {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS rooms(room_id TEXT PRIMARY KEY, name TEXT NOT NULL, creator_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT UNIQUE NOT NULL,
        room_id TEXT NOT NULL REFERENCES rooms(room_id), sender_id TEXT NOT NULL, content TEXT NOT NULL,
        created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Sent' CHECK(status IN ('Sent','Delivered','Read')));
      CREATE INDEX IF NOT EXISTS messages_room_seq ON messages(room_id,seq);
      CREATE TABLE IF NOT EXISTS receipts(message_id TEXT NOT NULL REFERENCES messages(message_id),
        user_id TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY(message_id,user_id));`);
  }
  rooms() { return this.db.prepare('SELECT room_id AS roomId,name,0 AS memberCount FROM rooms ORDER BY rowid').all(); }
  createRoom(room, identity) {
    this.db.prepare('INSERT INTO rooms(room_id,name,creator_id) VALUES (?,?,?)').run(room.roomId, room.name, identity.userId);
  }
  save(message) {
    this.db.prepare('INSERT INTO messages(message_id,room_id,sender_id,content,created_at) VALUES (?,?,?,?,?)')
      .run(message.messageId,message.roomId,message.senderId,message.content,message.createdAt);
  }
  get(messageId) {
    const row = this.db.prepare('SELECT message_id AS messageId,room_id AS roomId,sender_id AS senderId,content,created_at AS createdAt,status FROM messages WHERE message_id=?').get(messageId);
    if (!row) throw new AppError('NOT_FOUND', 'Message not found');
    return { ...row, readBy: this.db.prepare('SELECT user_id AS userId,read_at AS readAt FROM receipts WHERE message_id=? ORDER BY user_id').all(messageId) };
  }
  history(roomId) {
    return this.db.prepare('SELECT message_id FROM messages WHERE room_id=? ORDER BY seq DESC LIMIT 50').all(roomId)
      .reverse().map(row => this.get(row.message_id));
  }
  delivered(messageId) {
    this.db.prepare("UPDATE messages SET status='Delivered' WHERE message_id=? AND status='Sent'").run(messageId);
    return this.get(messageId);
  }
  read(messageId, userId) {
    const message = this.get(messageId);
    if (message.senderId === userId) throw new AppError('FORBIDDEN', 'A sender cannot mark their own message read');
    if (message.status === 'Sent') throw new AppError('VALIDATION_ERROR', 'Message has not been delivered');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT OR IGNORE INTO receipts(message_id,user_id,read_at) VALUES (?,?,?)').run(messageId,userId,new Date().toISOString());
      this.db.prepare("UPDATE messages SET status='Read' WHERE message_id=?").run(messageId);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.get(messageId);
  }
  close() { this.db.close(); }
}
module.exports = { HistoryStore };
