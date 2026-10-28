import sqlite3
from pathlib import Path
from threading import RLock
from datetime import datetime, timezone
from .rooms import RoomError


class HistoryStore:
    def __init__(self, filename=':memory:'):
        if filename != ':memory:':
            Path(filename).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(filename, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = RLock()
        self.db.executescript('''PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
          CREATE TABLE IF NOT EXISTS rooms(room_id TEXT PRIMARY KEY,name TEXT NOT NULL,creator_id TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,message_id TEXT UNIQUE NOT NULL,
            room_id TEXT NOT NULL REFERENCES rooms(room_id),sender_id TEXT NOT NULL,content TEXT NOT NULL,
            created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Sent' CHECK(status IN ('Sent','Delivered','Read')));
          CREATE INDEX IF NOT EXISTS messages_room_seq ON messages(room_id,seq);
          CREATE TABLE IF NOT EXISTS receipts(message_id TEXT NOT NULL REFERENCES messages(message_id),
            user_id TEXT NOT NULL,read_at TEXT NOT NULL,PRIMARY KEY(message_id,user_id));''')

    def rooms(self):
        with self.lock:
            return [dict(r) for r in self.db.execute('SELECT room_id AS roomId,name,0 AS memberCount FROM rooms ORDER BY rowid')]

    def create_room(self, room, identity):
        with self.lock, self.db:
            self.db.execute('INSERT INTO rooms VALUES (?,?,?)',(room['roomId'],room['name'],identity['userId']))

    def save(self, message):
        with self.lock, self.db:
            self.db.execute('INSERT INTO messages(message_id,room_id,sender_id,content,created_at) VALUES (?,?,?,?,?)',
                tuple(message[k] for k in ('messageId','roomId','senderId','content','createdAt')))

    def get(self, message_id):
        with self.lock:
            row = self.db.execute('SELECT message_id AS messageId,room_id AS roomId,sender_id AS senderId,content,created_at AS createdAt,status FROM messages WHERE message_id=?',(message_id,)).fetchone()
            if row is None:
                raise RoomError('NOT_FOUND','Message not found')
            result = dict(row)
            result['readBy'] = [dict(r) for r in self.db.execute('SELECT user_id AS userId,read_at AS readAt FROM receipts WHERE message_id=? ORDER BY user_id',(message_id,))]
            return result

    def history(self, room_id):
        with self.lock:
            rows = self.db.execute('SELECT message_id FROM messages WHERE room_id=? ORDER BY seq DESC LIMIT 50',(room_id,)).fetchall()
            return [self.get(row[0]) for row in reversed(rows)]

    def delivered(self, message_id):
        with self.lock, self.db:
            self.db.execute("UPDATE messages SET status='Delivered' WHERE message_id=? AND status='Sent'",(message_id,))
            return self.get(message_id)

    def read(self, message_id, user_id):
        with self.lock, self.db:
            message = self.get(message_id)
            if message['senderId'] == user_id:
                raise RoomError('FORBIDDEN','A sender cannot mark their own message read')
            if message['status'] == 'Sent':
                raise RoomError('VALIDATION_ERROR','Message has not been delivered')
            self.db.execute('INSERT OR IGNORE INTO receipts VALUES (?,?,?)',
                (message_id,user_id,datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')))
            self.db.execute("UPDATE messages SET status='Read' WHERE message_id=?",(message_id,))
            return self.get(message_id)

    def close(self):
        self.db.close()
