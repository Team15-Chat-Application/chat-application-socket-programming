
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Worker } = require('node:worker_threads');
const { createDatabase, createVerifiedBackup } = require('../../src/database');
const { HistoryStore } = require('../../src/history');

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

  test('migrates the legacy authentication database without losing users, messages, or readers', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE users(user_id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user', failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER);
      CREATE TABLE sessions(session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER);
      CREATE TABLE messages(message_id TEXT PRIMARY KEY, room_id TEXT NOT NULL, sender_id TEXT NOT NULL,
        content TEXT NOT NULL, created_at TEXT NOT NULL, delivery_status TEXT NOT NULL DEFAULT 'pending');
      CREATE TABLE message_reads(message_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TEXT NOT NULL,
        PRIMARY KEY(message_id,user_id));
      INSERT INTO users(user_id,username,password_hash) VALUES ('alice','alice','preserve-hash');
      INSERT INTO sessions(session_id,user_id,expires_at) VALUES ('alice-session','alice',2000000000);
      INSERT INTO messages VALUES ('m1','r1','alice','kept','2026-11-04T09:00:00.000Z','delivered');
      INSERT INTO message_reads VALUES ('m1','bob','2026-11-04T09:01:00.000Z');
    `);
    legacy.close();

    const database = createDatabase(dbPath);
    const history = new HistoryStore(dbPath, { db: database.db, ownsConnection: false });
    try {
      expect(database.findUserById('alice')).toMatchObject({ userId: 'alice', username: 'alice' });
      expect(database.findSession('alice-session')).toMatchObject({ sessionId: 'alice-session', userId: 'alice' });
      expect(history.get('m1')).toMatchObject({ status: 'Read', readBy: [{ userId: 'bob' }] });
      expect(history.history('r1').map(message => message.messageId)).toEqual(['m1']);
      expect(database.db.prepare('PRAGMA table_info(messages)').all().map(column => column.name))
        .toEqual(['seq', 'message_id', 'room_id', 'sender_id', 'content', 'created_at', 'status', 'legacy_data']);
      expect(database.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name))
        .not.toContain('message_reads');
      expect(database.db.prepare('PRAGMA foreign_keys').get().foreign_keys).toBe(1);
      expect(database.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(fs.existsSync(database.migrationBackupPath)).toBe(true);
      const backup = new DatabaseSync(database.migrationBackupPath, { readOnly: true });
      try {
        expect(backup.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
        expect(backup.prepare('SELECT password_hash FROM users WHERE user_id=?').get('alice').password_hash).toBe('preserve-hash');
        expect(backup.prepare('PRAGMA table_info(messages)').all().map(column => column.name)).toContain('delivery_status');
      } finally { backup.close(); }
    } finally {
      database.close();
    }
  });

  test('migrates the integrated history schema and merges both receipt tables', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE rooms(room_id TEXT PRIMARY KEY,name TEXT NOT NULL,creator_id TEXT NOT NULL);
      CREATE TABLE messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,message_id TEXT UNIQUE NOT NULL,
        room_id TEXT NOT NULL,sender_id TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Sent');
      CREATE TABLE receipts(message_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at TEXT NOT NULL,
        PRIMARY KEY(message_id,user_id));
      CREATE TABLE message_reads(message_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at TEXT NOT NULL,
        PRIMARY KEY(message_id,user_id));
      INSERT INTO rooms VALUES ('r2','Existing room','alice');
      INSERT INTO messages(message_id,room_id,sender_id,content,created_at,status)
        VALUES ('m2','r2','alice','hybrid','2026-11-04T09:00:00.000Z','Delivered');
      ALTER TABLE messages ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'pending';
      UPDATE messages SET delivery_status='delivered';
      INSERT INTO receipts VALUES ('m2','bob','2026-11-04T09:03:00.000Z');
      INSERT INTO message_reads VALUES ('m2','carol','2026-11-04T09:02:00.000Z');
      INSERT INTO message_reads VALUES ('m2','bob','2026-11-04T09:01:00.000Z');
      INSERT INTO messages(message_id,room_id,sender_id,content,created_at,status,delivery_status)
        VALUES ('m3','r2','alice','one reader','2026-11-04T09:04:00.000Z','Delivered','delivered');
      INSERT INTO receipts VALUES ('m3','dana','2026-11-04T09:05:00.000Z');
    `);
    legacy.close();

    const database = createDatabase(dbPath);
    const history = new HistoryStore(dbPath, { db: database.db, ownsConnection: false });
    try {
      expect(history.get('m2').status).toBe('Read');
      expect(history.get('m2').readBy.map(receipt => receipt.userId).sort()).toEqual(['bob', 'carol']);
      expect(history.get('m2').readBy.find(receipt => receipt.userId === 'bob').readAt).toBe('2026-11-04T09:01:00.000Z');
      expect(history.get('m3')).toMatchObject({ status: 'Read', readBy: [{ userId: 'dana' }] });
      expect(database.db.prepare('SELECT version,name FROM schema_migrations').all()).toMatchObject([
        { version: 1, name: 'unified-messaging-schema' },
        { version: 2, name: 'preserve-legacy-metadata' }
      ]);
      expect(database.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      database.close();
    }
  });

  test('latest history order is deterministic when all timestamps match', () => {
    const database = createDatabase(dbPath);
    const history = new HistoryStore(dbPath, { db: database.db, ownsConnection: false });
    try {
      history.createRoom({ roomId: 'same-time-room', name: 'Same time' }, { userId: 'alice' });
      for (let index = 0; index < 55; index++) {
        history.save({ messageId: `same-${index}`, roomId: 'same-time-room', senderId: 'alice',
          content: `message-${index}`, createdAt: '2026-11-04T09:00:00.000Z' });
      }
      const messages = history.history('same-time-room');
      expect(messages).toHaveLength(50);
      expect(messages.map(message => message.content)).toEqual(Array.from({ length: 50 }, (_, index) => `message-${index + 5}`));
    } finally {
      database.close();
    }
  });

  test('maps supported legacy room aliases and retains extra room data', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE rooms(id TEXT PRIMARY KEY,title TEXT NOT NULL,owner_id TEXT,visibility TEXT,description TEXT);
      CREATE TABLE messages(message_id TEXT PRIMARY KEY,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,delivery_status TEXT);
    `);
    legacy.prepare('INSERT INTO rooms VALUES (?,?,?,?,?)').run('legacy-room', 'Old title', 'owner', 'private', 'Keep metadata');
    legacy.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run('legacy-message', 'legacy-room', 'owner', 'body', 't', 'delivered');
    legacy.close();
    const database = createDatabase(dbPath);
    try {
      const room = database.db.prepare('SELECT room_id,name,creator_id,legacy_data FROM rooms').get();
      expect(room).toMatchObject({ room_id: 'legacy-room', name: 'Old title', creator_id: 'owner' });
      expect(JSON.parse(room.legacy_data)).toEqual({ visibility: 'private', description: 'Keep metadata' });
      expect(database.db.prepare('SELECT message_id FROM messages').get().message_id).toBe('legacy-message');
    } finally { database.close(); }
  });

  test('rejects unsupported room schemas without dropping their rows or recording a version', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE rooms(room_uuid TEXT PRIMARY KEY,label TEXT NOT NULL);
      CREATE TABLE messages(seq INTEGER PRIMARY KEY,message_id TEXT UNIQUE,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,status TEXT,legacy_data TEXT);
    `);
    legacy.prepare('INSERT INTO rooms VALUES (?,?)').run('unknown-room', 'Do not discard');
    legacy.close();
    expect(() => createDatabase(dbPath)).toThrow(/Unsupported legacy rooms schema/);
    const unchanged = new DatabaseSync(dbPath, { readOnly: true });
    try {
      expect(unchanged.prepare('PRAGMA table_info(rooms)').all().map(column => column.name)).toEqual(['room_uuid', 'label']);
      expect(unchanged.prepare('SELECT * FROM rooms').all()).toEqual([{ room_uuid: 'unknown-room', label: 'Do not discard' }]);
      expect(unchanged.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
    } finally { unchanged.close(); }
  });

  test('preserves valid explicit sequences and rejects invalid sequence values safely', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE rooms(room_id TEXT PRIMARY KEY,name TEXT NOT NULL,creator_id TEXT NOT NULL);
      CREATE TABLE messages(seq INTEGER,message_id TEXT,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,status TEXT,delivery_status TEXT);
      CREATE TABLE receipts(message_id TEXT,user_id TEXT,read_at TEXT);
    `);
    legacy.prepare('INSERT INTO rooms VALUES (?,?,?)').run('r', 'Room', 'u');
    const insert = legacy.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)');
    insert.run(9, 'm9', 'r', 'u', 'nine', 'same', 'Delivered', 'delivered');
    insert.run(20, 'm20', 'r', 'u', 'twenty', 'same', 'Delivered', 'delivered');
    legacy.close();
    const database = createDatabase(dbPath);
    try {
      expect(database.db.prepare('SELECT seq,message_id FROM messages ORDER BY seq').all())
        .toEqual([{ seq: 9, message_id: 'm9' }, { seq: 20, message_id: 'm20' }]);
    } finally { database.close(); }

    const invalidPath = path.join(tempDirectory, 'invalid-seq.sqlite');
    const invalid = new DatabaseSync(invalidPath);
    invalid.exec(`
      CREATE TABLE rooms(room_id TEXT PRIMARY KEY,name TEXT NOT NULL,creator_id TEXT NOT NULL);
      CREATE TABLE messages(seq INTEGER,message_id TEXT,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,status TEXT,delivery_status TEXT);
    `);
    invalid.prepare('INSERT INTO rooms VALUES (?,?,?)').run('r', 'Room', 'u');
    invalid.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)').run(null, 'bad', 'r', 'u', 'x', 't', 'Sent', 'pending');
    invalid.close();
    expect(() => createDatabase(invalidPath)).toThrow(/sequence values must be unique positive integers/);
    const check = new DatabaseSync(invalidPath, { readOnly: true });
    try {
      expect(check.prepare('SELECT seq FROM messages').get().seq).toBeNull();
      expect(check.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
    } finally { check.close(); }
  });

  test('obtains a write lock before migration snapshots so a concurrent receipt is retained', async () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE users(user_id TEXT PRIMARY KEY,username TEXT,password_hash TEXT,role TEXT,failed_attempts INTEGER,locked_until INTEGER);
      CREATE TABLE sessions(session_id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER,revoked_at INTEGER);
      CREATE INDEX idx_sessions_user_id ON sessions(user_id);
      CREATE TABLE messages(message_id TEXT PRIMARY KEY,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,delivery_status TEXT);
      CREATE TABLE message_reads(message_id TEXT,user_id TEXT,read_at TEXT,PRIMARY KEY(message_id,user_id));
    `);
    legacy.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run('m', 'r', 'u', 'x', 't', 'delivered');
    legacy.close();
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(workerData);
      db.exec('PRAGMA journal_mode=WAL; BEGIN IMMEDIATE');
      parentPort.postMessage('locked');
      setTimeout(() => {
        db.prepare('INSERT INTO message_reads VALUES (?,?,?)').run('m','late-reader','t');
        db.exec('COMMIT'); db.close(); parentPort.postMessage('committed');
      }, 100);
    `, { eval: true, workerData: dbPath });
    await new Promise((resolve, reject) => {
      worker.once('message', message => message === 'locked' ? resolve() : reject(new Error(message)));
      worker.once('error', reject);
    });
    let database;
    try {
      database = createDatabase(dbPath);
      expect(database.getMessageReadReceipts('m').map(receipt => receipt.userId)).toEqual(['late-reader']);
    } finally {
      database?.close();
      await worker.terminate();
    }
  });

  test('rolls back the complete schema and data on failure, records no version, and closes the connection', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE rooms(room_id TEXT PRIMARY KEY,name TEXT NOT NULL,creator_id TEXT NOT NULL);
      CREATE TABLE messages(message_id TEXT PRIMARY KEY,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,delivery_status TEXT);
      CREATE TABLE message_reads(message_id TEXT,user_id TEXT,read_at TEXT,PRIMARY KEY(message_id,user_id));
    `);
    legacy.prepare('INSERT INTO rooms VALUES (?,?,?)').run('r', 'Before', 'u');
    legacy.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run('m', 'r', 'u', null, 't', 'delivered');
    legacy.close();
    expect(() => createDatabase(dbPath)).toThrow(/NOT NULL constraint failed/);
    const afterFailure = new DatabaseSync(dbPath, { readOnly: true });
    try {
      expect(afterFailure.prepare('PRAGMA table_info(messages)').all().map(column => column.name))
        .toEqual(['message_id', 'room_id', 'sender_id', 'content', 'created_at', 'delivery_status']);
      expect(afterFailure.prepare('SELECT * FROM rooms').all())
        .toEqual([{ room_id: 'r', name: 'Before', creator_id: 'u' }]);
      expect(afterFailure.prepare('SELECT message_id,content FROM messages').all())
        .toEqual([{ message_id: 'm', content: null }]);
      expect(afterFailure.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
      expect(afterFailure.prepare("SELECT name FROM sqlite_master WHERE name='users'").all()).toEqual([]);
    } finally { afterFailure.close(); }
    const backupName = fs.readdirSync(tempDirectory).find(name => name.startsWith('chat.sqlite.pre-migration-'));
    expect(backupName).toBeTruthy();
    const backup = new DatabaseSync(path.join(tempDirectory, backupName), { readOnly: true });
    try {
      expect(backup.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
      expect(backup.prepare('SELECT message_id,content FROM messages').all())
        .toEqual([{ message_id: 'm', content: null }]);
    } finally { backup.close(); }
    expect(() => fs.rmSync(dbPath)).not.toThrow();
  });

  test('creates verified backups without overwriting an existing target', () => {
    const source = new DatabaseSync(':memory:');
    source.exec('CREATE TABLE kept(value TEXT)');
    source.prepare('INSERT INTO kept VALUES (?)').run('original');
    const occupiedPath = path.join(tempDirectory, 'occupied.sqlite');
    fs.writeFileSync(occupiedPath, 'leave unchanged');
    expect(() => createVerifiedBackup(source, dbPath, occupiedPath)).toThrow(/EEXIST/);
    expect(fs.readFileSync(occupiedPath, 'utf8')).toBe('leave unchanged');

    const backupPath = createVerifiedBackup(source, dbPath, path.join(tempDirectory, 'verified.sqlite'));
    const backup = new DatabaseSync(backupPath, { readOnly: true });
    try {
      expect(backup.prepare('PRAGMA integrity_check').get().integrity_check).toBe('ok');
      expect(backup.prepare('SELECT value FROM kept').get().value).toBe('original');
    } finally { backup.close(); source.close(); }
  });

  test('a verified migration backup restores the prior legacy schema and rows', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec('CREATE TABLE messages(message_id TEXT PRIMARY KEY,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,delivery_status TEXT)');
    legacy.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run('before', 'r', 'u', 'original', 't', 'delivered');
    legacy.close();
    const migrated = createDatabase(dbPath);
    const backupPath = migrated.migrationBackupPath;
    migrated.close();

    const migratedPath = `${dbPath}.migrated`;
    fs.renameSync(dbPath, migratedPath);
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(dbPath + suffix)) fs.renameSync(dbPath + suffix, migratedPath + suffix);
    }
    fs.copyFileSync(backupPath, dbPath, fs.constants.COPYFILE_EXCL);
    const restored = new DatabaseSync(dbPath, { readOnly: true });
    try {
      expect(restored.prepare('PRAGMA table_info(messages)').all().map(column => column.name))
        .toEqual(['message_id', 'room_id', 'sender_id', 'content', 'created_at', 'delivery_status']);
      expect(restored.prepare('SELECT message_id,content,delivery_status FROM messages').all())
        .toEqual([{ message_id: 'before', content: 'original', delivery_status: 'delivered' }]);
      expect(restored.prepare("SELECT name FROM sqlite_master WHERE name='schema_migrations'").all()).toEqual([]);
    } finally { restored.close(); }
  });

  test('repeated startup is idempotent and does not create a second migration backup', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec('CREATE TABLE messages(message_id TEXT PRIMARY KEY,room_id TEXT,sender_id TEXT,content TEXT,created_at TEXT,delivery_status TEXT)');
    legacy.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?)').run('m', 'r', 'u', 'x', 't', 'delivered');
    legacy.close();
    const first = createDatabase(dbPath);
    const backupPath = first.migrationBackupPath;
    first.close();
    const second = createDatabase(dbPath);
    try {
      expect(second.migrationBackupPath).toBeNull();
      expect(second.db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count).toBe(2);
      expect(second.db.prepare('SELECT seq,message_id,status FROM messages').all())
        .toEqual([{ seq: 1, message_id: 'm', status: 'Delivered' }]);
      expect(fs.existsSync(backupPath)).toBe(true);
      expect(second.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally { second.close(); }
  });

  test('rejects unsupported migration versions and gaps without modifying the database', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec('CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)');
    legacy.prepare('INSERT INTO schema_migrations VALUES (?,?,?)').run(2, 'future-version', 't');
    legacy.exec('CREATE TABLE keep(value TEXT)');
    legacy.prepare('INSERT INTO keep VALUES (?)').run('untouched');
    legacy.close();
    expect(() => createDatabase(dbPath)).toThrow(/Invalid or unsupported migration history/);
    const unchanged = new DatabaseSync(dbPath, { readOnly: true });
    try {
      expect(unchanged.prepare('SELECT value FROM keep').get().value).toBe('untouched');
      expect(unchanged.prepare("SELECT name FROM sqlite_master WHERE name='users'").all()).toEqual([]);
    } finally { unchanged.close(); }
  });

  test('applies the next migration sequentially to an already versioned database', () => {
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      CREATE TABLE users(user_id TEXT PRIMARY KEY,username TEXT NOT NULL,password_hash TEXT NOT NULL,
        role TEXT NOT NULL,failed_attempts INTEGER NOT NULL,locked_until INTEGER);
      CREATE TABLE sessions(session_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(user_id));
      CREATE TABLE rooms(room_id TEXT PRIMARY KEY,name TEXT NOT NULL,creator_id TEXT NOT NULL);
      CREATE TABLE messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,message_id TEXT UNIQUE NOT NULL,
        room_id TEXT NOT NULL REFERENCES rooms(room_id),sender_id TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Sent','Delivered','Read')));
      CREATE TABLE receipts(message_id TEXT NOT NULL REFERENCES messages(message_id),user_id TEXT NOT NULL,read_at TEXT NOT NULL,
        PRIMARY KEY(message_id,user_id));
      CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations VALUES (1,'unified-messaging-schema','2026-11-01T00:00:00.000Z');
      INSERT INTO rooms VALUES ('r','Version one','u');
      INSERT INTO messages VALUES (7,'m','r','u','keep','2026-11-01T00:00:00.000Z','Delivered');
      INSERT INTO receipts VALUES ('m','reader','2026-11-01T00:01:00.000Z');
    `);
    legacy.close();

    const database = createDatabase(dbPath);
    try {
      expect(database.db.prepare('SELECT version,name FROM schema_migrations ORDER BY version').all()).toEqual([
        { version: 1, name: 'unified-messaging-schema' },
        { version: 2, name: 'preserve-legacy-metadata' }
      ]);
      expect(database.db.prepare('SELECT seq,message_id,content FROM messages').all())
        .toEqual([{ seq: 7, message_id: 'm', content: 'keep' }]);
      expect(database.db.prepare('SELECT user_id FROM receipts').all()).toEqual([{ user_id: 'reader' }]);
      expect(database.db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(database.migrationBackupPath).toBeTruthy();
    } finally { database.close(); }
  });
});
