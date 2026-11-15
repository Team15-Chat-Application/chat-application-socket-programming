const { AppError } = require('./errors');

class HistoryStore {
  constructor(filename = ':memory:', { db, ownsConnection = !db } = {}) {
    this.ownsConnection = ownsConnection;
    if (db) this.db = db;
    else {
      // Keep standalone store construction on the same migration path as runtime.
      this.database = require('./database').createDatabase(filename);
      this.db = this.database.db;
    }
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
    return { ...row, ...(this.usernameFor ? {senderName:this.usernameFor(row.senderId)}:{}), readBy: this.db.prepare('SELECT user_id AS userId,read_at AS readAt FROM receipts WHERE message_id=? ORDER BY user_id').all(messageId) };
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
  close() { if (this.ownsConnection) this.database.close(); }
}
module.exports = { HistoryStore };
