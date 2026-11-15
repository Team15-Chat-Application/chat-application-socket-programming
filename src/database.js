const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const ROOM_COLUMNS = ['room_id', 'name', 'creator_id', 'legacy_data'];
const MESSAGE_COLUMNS = ['seq', 'message_id', 'room_id', 'sender_id', 'content', 'created_at', 'status', 'legacy_data'];
const RECEIPT_COLUMNS = ['message_id', 'user_id', 'read_at', 'legacy_data'];
const MESSAGING_TABLES = `
  CREATE TABLE rooms(
    room_id TEXT PRIMARY KEY, name TEXT NOT NULL, creator_id TEXT NOT NULL,
    legacy_data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE messages(
    seq INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT UNIQUE NOT NULL,
    room_id TEXT NOT NULL REFERENCES rooms(room_id), sender_id TEXT NOT NULL,
    content TEXT NOT NULL, created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Sent' CHECK(status IN ('Sent','Delivered','Read')),
    legacy_data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX messages_room_seq ON messages(room_id,seq);
  CREATE TABLE receipts(
    message_id TEXT NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, read_at TEXT NOT NULL,
    legacy_data TEXT NOT NULL DEFAULT '{}', PRIMARY KEY(message_id,user_id)
  );
`;

function tableExists(db, name) {
  return db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get('table', name) !== undefined;
}

function columns(db, table) {
  return tableExists(db, table) ? db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name) : [];
}

function hasForeignKey(db, table, from, target, to) {
  return tableExists(db, table) && db.prepare(`PRAGMA foreign_key_list(${table})`).all()
    .some(key => key.from === from && key.table === target && key.to === to);
}

const MIGRATIONS = [
  { version: 1, name: 'unified-messaging-schema', up: migrateMessagingSchema, verify: verifyUnifiedMessagingSchema },
  { version: 2, name: 'preserve-legacy-metadata', up: migrateLegacyMetadata, verify: verifyCurrentMessagingSchema }
];
const CURRENT_SCHEMA_VERSION = MIGRATIONS.at(-1).version;

function readAppliedMigrations(db) {
  if (!tableExists(db, 'schema_migrations')) return new Set();
  const names = columns(db, 'schema_migrations');
  if (!['version', 'name', 'applied_at'].every(name => names.includes(name))) {
    throw new Error('Unsupported schema_migrations table shape');
  }
  const rows = db.prepare('SELECT version,name FROM schema_migrations ORDER BY version').all();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const expected = MIGRATIONS[index];
    if (!expected || row.version !== expected.version || row.name !== expected.name) {
      throw new Error(`Invalid or unsupported migration history at version ${row.version}`);
    }
  }
  if (rows.length && rows.at(-1).version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Database schema version ${rows.at(-1).version} is newer than this application`);
  }
  return new Set(rows.map(row => row.version));
}

function recordMigration(db, migration) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
  )`);
  db.prepare('INSERT INTO schema_migrations(version,name,applied_at) VALUES (?,?,?)')
    .run(migration.version, migration.name, new Date().toISOString());
}

function verifyUnifiedMessagingSchema(db) {
  const messageColumns = columns(db, 'messages');
  const roomColumns = columns(db, 'rooms');
  const receiptColumns = columns(db, 'receipts');
  const canonical = ['seq', 'message_id', 'room_id', 'sender_id', 'content', 'created_at', 'status']
      .every(name => messageColumns.includes(name)) && !messageColumns.includes('delivery_status') &&
    ['room_id', 'name', 'creator_id'].every(name => roomColumns.includes(name)) &&
    ['message_id', 'user_id', 'read_at'].every(name => receiptColumns.includes(name)) &&
    hasForeignKey(db, 'messages', 'room_id', 'rooms', 'room_id') &&
    hasForeignKey(db, 'receipts', 'message_id', 'messages', 'message_id') &&
    !tableExists(db, 'message_reads');
  if (!canonical) throw new Error('Recorded migration version 1 does not match the unified messaging schema');
}

function verifyCurrentMessagingSchema(db) {
  verifyUnifiedMessagingSchema(db);
  const canonical = MESSAGE_COLUMNS.every(name => columns(db, 'messages').includes(name)) &&
    ROOM_COLUMNS.every(name => columns(db, 'rooms').includes(name)) &&
    RECEIPT_COLUMNS.every(name => columns(db, 'receipts').includes(name));
  if (!canonical) throw new Error('Recorded migration version 2 does not match the metadata-preserving schema');
}

function migrateLegacyMetadata(db) {
  verifyUnifiedMessagingSchema(db);
  for (const table of ['rooms', 'messages', 'receipts']) {
    if (!columns(db, table).includes('legacy_data')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN legacy_data TEXT NOT NULL DEFAULT '{}'`);
    }
  }
  db.exec('CREATE INDEX IF NOT EXISTS messages_room_seq ON messages(room_id,seq)');
}

function encodeLegacyValue(value) {
  if (typeof value === 'bigint') return { type: 'integer', value: value.toString() };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { type: 'blob', base64: Buffer.from(value).toString('base64') };
  }
  return value;
}

function legacyData(row, columnsToPreserve) {
  const data = {};
  for (const column of columnsToPreserve) data[column] = encodeLegacyValue(row[column]);
  return JSON.stringify(data);
}

function mapRoomRows(roomRows, roomColumns, messageRows) {
  if (!roomColumns.length) return [];
  const idColumn = roomColumns.includes('room_id') ? 'room_id' : roomColumns.includes('id') ? 'id' : null;
  const nameColumn = ['name', 'title', 'room_name', 'label'].find(name => roomColumns.includes(name));
  if (!idColumn || !nameColumn) {
    throw new Error('Unsupported legacy rooms schema: expected room_id/id and name/title/room_name/label');
  }
  const creatorColumn = ['creator_id', 'created_by', 'owner_id', 'user_id'].find(name => roomColumns.includes(name));
  const known = new Set([idColumn, nameColumn, creatorColumn].filter(Boolean));
  return roomRows.map(row => {
    const roomId = row[idColumn];
    const name = row[nameColumn];
    if (roomId === null || roomId === undefined || name === null || name === undefined) {
      throw new Error('Cannot migrate a room with a missing ID or name');
    }
    if (typeof name !== 'string') throw new Error('Cannot migrate a room with a non-text name');
    const fallbackCreator = messageRows.find(message => String(message.room_id) === String(roomId))?.sender_id;
    const creator = creatorColumn ? row[creatorColumn] : fallbackCreator;
    const extraColumns = roomColumns.filter(column => !known.has(column));
    const extraData = Object.fromEntries(extraColumns.map(column => [column, encodeLegacyValue(row[column])]));
    if (typeof roomId !== 'string') extraData.legacy_room_id = encodeLegacyValue(roomId);
    if (creator !== null && creator !== undefined && typeof creator !== 'string') {
      extraData.legacy_creator_id = encodeLegacyValue(creator);
    }
    return {
      roomId: String(roomId), name: String(name),
      creatorId: creator !== null && creator !== undefined ? String(creator) : 'legacy',
      legacyData: JSON.stringify(extraData)
    };
  });
}

function isCurrentMessagingSchema(db) {
  const messageColumns = columns(db, 'messages');
  const roomColumns = columns(db, 'rooms');
  const receiptColumns = columns(db, 'receipts');
  return MESSAGE_COLUMNS.every(name => messageColumns.includes(name)) &&
    messageColumns.every(name => MESSAGE_COLUMNS.includes(name)) &&
    ROOM_COLUMNS.every(name => roomColumns.includes(name)) &&
    roomColumns.every(name => ROOM_COLUMNS.includes(name)) &&
    RECEIPT_COLUMNS.every(name => receiptColumns.includes(name)) &&
    receiptColumns.every(name => RECEIPT_COLUMNS.includes(name)) &&
    hasForeignKey(db, 'messages', 'room_id', 'rooms', 'room_id') &&
    hasForeignKey(db, 'receipts', 'message_id', 'messages', 'message_id') &&
    !tableExists(db, 'message_reads');
}

function migrateMessagingSchema(db) {
  if (isCurrentMessagingSchema(db)) {
    db.exec('CREATE INDEX IF NOT EXISTS messages_room_seq ON messages(room_id,seq)');
    return;
  }

  const messageColumns = columns(db, 'messages');
  const roomColumns = columns(db, 'rooms');
  const receiptColumns = columns(db, 'receipts');
  const messageReadColumns = columns(db, 'message_reads');
  const requiredMessageColumns = ['message_id', 'room_id', 'sender_id', 'content', 'created_at'];
  if (messageColumns.length && !requiredMessageColumns.every(name => messageColumns.includes(name))) {
    throw new Error('Unsupported legacy messages schema: required message fields are missing');
  }
  const supportedMessageColumns = new Set([...requiredMessageColumns, 'seq', 'status', 'delivery_status', 'legacy_data']);
  const extraMessageColumns = messageColumns.filter(name => !supportedMessageColumns.has(name));
  if (extraMessageColumns.length) throw new Error(`Unsupported legacy messages columns: ${extraMessageColumns.join(', ')}`);
  for (const [table, tableColumns] of [['receipts', receiptColumns], ['message_reads', messageReadColumns]]) {
    if (tableColumns.length && !['message_id', 'user_id', 'read_at'].every(name => tableColumns.includes(name))) {
      throw new Error(`Unsupported ${table} schema: receipt fields are missing`);
    }
    const extraColumns = tableColumns.filter(name => !['message_id', 'user_id', 'read_at', 'legacy_data'].includes(name));
    if (extraColumns.length) throw new Error(`Unsupported ${table} columns: ${extraColumns.join(', ')}`);
  }

  let messageRows = [];
  if (messageColumns.length) {
    try { messageRows = db.prepare('SELECT rowid AS legacy_rowid,* FROM messages ORDER BY rowid').all(); }
    catch { throw new Error('Unsupported messages table: migration requires a rowid table'); }
  }
  const receiptRows = receiptColumns.length ? db.prepare('SELECT * FROM receipts').all() : [];
  const messageReadRows = messageReadColumns.length ? db.prepare('SELECT * FROM message_reads').all() : [];
  const roomRows = roomColumns.length ? db.prepare('SELECT * FROM rooms').all() : [];
  const knownMessageIds = new Set(messageRows.map(message => message.message_id));
  const allReceipts = [
    ...receiptRows.map(row => ({ ...row, source: 'receipts' })),
    ...messageReadRows.map(row => ({ ...row, source: 'message_reads' }))
  ];
  if (allReceipts.some(receipt => !knownMessageIds.has(receipt.message_id))) {
    throw new Error('Cannot migrate a read receipt without its message');
  }
  const mappedRooms = mapRoomRows(roomRows, roomColumns, messageRows);

  let orderedMessages = messageRows;
  if (messageColumns.includes('seq')) {
    const sequences = messageRows.map(row => row.seq);
    if (sequences.some(seq => !Number.isSafeInteger(seq) || seq < 1) || new Set(sequences).size !== sequences.length) {
      throw new Error('Unsupported messages schema: sequence values must be unique positive integers');
    }
    orderedMessages = [...messageRows].sort((left, right) => left.seq - right.seq);
  }

  db.exec('DROP TABLE IF EXISTS message_reads; DROP TABLE IF EXISTS receipts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS rooms;');
  db.exec(MESSAGING_TABLES);
  const insertRoom = db.prepare('INSERT INTO rooms(room_id,name,creator_id,legacy_data) VALUES (?,?,?,?)');
  for (const room of mappedRooms) insertRoom.run(room.roomId, room.name, room.creatorId, room.legacyData);

  const knownRooms = new Set(mappedRooms.map(room => room.roomId));
  const insertMessage = db.prepare('INSERT INTO messages(seq,message_id,room_id,sender_id,content,created_at,status,legacy_data) VALUES (?,?,?,?,?,?,?,?)');
  const receiptsByMessage = new Set(allReceipts.map(receipt => receipt.message_id));
  const supportedMessageColumnsSet = new Set([...requiredMessageColumns, 'seq', 'status', 'delivery_status']);
  for (let index = 0; index < orderedMessages.length; index++) {
    const row = orderedMessages[index];
    const roomId = String(row.room_id);
    if (!knownRooms.has(roomId)) {
      insertRoom.run(roomId, 'Recovered room', String(row.sender_id), '{}');
      knownRooms.add(roomId);
    }
    let status = ['Sent', 'Delivered', 'Read'].includes(row.status) ? row.status : 'Sent';
    if (row.delivery_status === 'delivered' && status === 'Sent') status = 'Delivered';
    // `Read` means at least one recipient read the message; receipts remain per recipient.
    if (receiptsByMessage.has(row.message_id)) status = 'Read';
    const extra = messageColumns.includes('legacy_data') ? { legacy_data: row.legacy_data } : {};
    insertMessage.run(Number.isSafeInteger(row.seq) ? row.seq : index + 1, row.message_id, roomId,
      row.sender_id, row.content, row.created_at, status,
      legacyData({ ...row, ...extra }, [...messageColumns.filter(name => !supportedMessageColumnsSet.has(name)),
        ...(messageColumns.includes('legacy_data') ? ['legacy_data'] : [])]));
  }

  const receiptGroups = new Map();
  for (const receipt of allReceipts) {
    const key = JSON.stringify([receipt.message_id, receipt.user_id]);
    const group = receiptGroups.get(key) || { messageId: receipt.message_id, userId: receipt.user_id, readAt: receipt.read_at, extras: [] };
    if (receipt.read_at < group.readAt) group.readAt = receipt.read_at;
    const extraColumns = Object.keys(receipt).filter(name => !['message_id', 'user_id', 'read_at', 'source'].includes(name));
    const extraData = legacyData(receipt, extraColumns);
    if (extraData !== '{}') group.extras.push({ source: receipt.source, data: JSON.parse(extraData) });
    receiptGroups.set(key, group);
  }
  const insertReceipt = db.prepare('INSERT INTO receipts(message_id,user_id,read_at,legacy_data) VALUES (?,?,?,?)');
  for (const receipt of receiptGroups.values()) {
    insertReceipt.run(receipt.messageId, receipt.userId, receipt.readAt, JSON.stringify(receipt.extras));
  }
}

function createVerifiedBackup(db, databasePath, requestedBackupPath) {
  if (databasePath === ':memory:') return null;
  const absolutePath = path.resolve(databasePath);
  const backupPath = requestedBackupPath ? path.resolve(requestedBackupPath) :
    `${absolutePath}.pre-migration-${Date.now()}-${process.pid}-${crypto.randomUUID()}.sqlite`;
  const bytes = Buffer.from(db.serialize());
  const descriptor = fs.openSync(backupPath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const savedBytes = fs.readFileSync(backupPath);
  if (!savedBytes.equals(bytes)) throw new Error(`SQLite backup verification failed: ${backupPath}`);
  const verification = new DatabaseSync(backupPath, { readOnly: true });
  try {
    const result = verification.prepare('PRAGMA integrity_check').all();
    if (result.length !== 1 || result[0].integrity_check !== 'ok') {
      throw new Error(`SQLite backup integrity check failed: ${backupPath}`);
    }
  } finally {
    verification.close();
  }
  return backupPath;
}

function createDatabase(dbPath = path.join(__dirname, '..', 'data', 'chat.sqlite')) {
  const directory = path.dirname(dbPath);
  if (dbPath !== ':memory:') fs.mkdirSync(directory, { recursive: true });
  const existedBefore = dbPath !== ':memory:' && fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0;
  const db = new DatabaseSync(dbPath);
  let migrationBackupPath = null;
  try {
    db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;');
    const applied = readAppliedMigrations(db);
    if (existedBefore && MIGRATIONS.some(migration => !applied.has(migration.version))) {
      migrationBackupPath = createVerifiedBackup(db, dbPath);
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user',
        failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until INTEGER
      );
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
        revoked_at INTEGER DEFAULT NULL, FOREIGN KEY (user_id) REFERENCES users(user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    `);
    const userColumns = columns(db, 'users');
    const sessionColumns = columns(db, 'sessions');
    if (!['user_id', 'username', 'password_hash', 'role', 'failed_attempts', 'locked_until'].every(name => userColumns.includes(name))) {
      throw new Error('Unsupported users schema: required account fields are missing');
    }
    if (!['session_id', 'user_id', 'expires_at', 'revoked_at'].every(name => sessionColumns.includes(name))) {
      throw new Error('Unsupported sessions schema: required session fields are missing');
    }
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) {
        migration.verify(db);
        continue;
      }
      migration.up(db);
      recordMigration(db, migration);
      applied.add(migration.version);
      migration.verify(db);
    }
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length) throw new Error(`SQLite foreign-key check failed (${violations.length} violation(s))`);
    db.exec('COMMIT; PRAGMA foreign_keys=ON;');
    if (db.prepare('PRAGMA foreign_keys').get().foreign_keys !== 1) {
      throw new Error('SQLite foreign-key enforcement could not be enabled');
    }
    // WAL is an operational preference; perform the mode change after the
    // verified backup and committed migration so backup always precedes DDL.
    if (dbPath !== ':memory:') {
      try { db.prepare('PRAGMA journal_mode=WAL').get(); } catch { /* Retain SQLite's existing journal mode if another reader prevents the switch. */ }
    }
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* Preserve the migration error. */ }
    try { db.exec('PRAGMA foreign_keys=ON'); } catch { /* Preserve the migration error. */ }
    try { db.close(); } catch { /* Preserve the migration error. */ }
    throw error;
  }

  const statusFor = value => value === 'Delivered' || value === 'Read' ? value : 'Sent';
  const selectMessage = `SELECT message_id AS messageId, room_id AS roomId, sender_id AS senderId,
    content, created_at AS createdAt, status FROM messages`;
  return {
    db,
    migrationBackupPath,
    findUserByUsername(username) {
      return db.prepare(`SELECT user_id AS userId,username,password_hash AS passwordHash,role,
        failed_attempts AS failedAttempts,locked_until AS lockedUntil FROM users WHERE username=?`).get(username);
    },
    findUserById(userId) { return db.prepare('SELECT user_id AS userId,username,role FROM users WHERE user_id=?').get(userId); },
    createUser({ userId, username, passwordHash }) {
      try { db.prepare('INSERT INTO users(user_id,username,password_hash) VALUES (?,?,?)').run(userId, username, passwordHash); }
      catch (error) { if (error.errcode === 2067 || error.errcode === 1555) error.code = 'SQLITE_CONSTRAINT_UNIQUE'; throw error; }
    },
    recordFailedLogin(userId, failedAttempts, lockedUntil) {
      db.prepare('UPDATE users SET failed_attempts=?,locked_until=? WHERE user_id=?').run(failedAttempts, lockedUntil, userId);
    },
    resetFailedLogins(userId) { db.prepare('UPDATE users SET failed_attempts=0,locked_until=NULL WHERE user_id=?').run(userId); },
    createSession({ sessionId, userId, expiresAt }) {
      db.prepare('INSERT INTO sessions(session_id,user_id,expires_at) VALUES (?,?,?)').run(sessionId, userId, expiresAt);
    },
    findSession(sessionId) {
      return db.prepare(`SELECT session_id AS sessionId,user_id AS userId,expires_at AS expiresAt,revoked_at AS revokedAt
        FROM sessions WHERE session_id=?`).get(sessionId);
    },
    revokeSession(sessionId, revokedAt) {
      return db.prepare('UPDATE sessions SET revoked_at=? WHERE session_id=? AND revoked_at IS NULL').run(revokedAt, sessionId).changes;
    },
    saveMessage(message) {
      db.prepare('INSERT OR IGNORE INTO rooms(room_id,name,creator_id) VALUES (?,?,?)')
        .run(message.roomId, 'Recovered room', message.senderId);
      db.prepare('INSERT INTO messages(message_id,room_id,sender_id,content,created_at,status) VALUES (?,?,?,?,?,?)')
        .run(message.messageId, message.roomId, message.senderId, message.content, message.createdAt, statusFor(message.status));
      return message;
    },
    markMessageDelivered(messageId) {
      return db.prepare("UPDATE messages SET status='Delivered' WHERE message_id=? AND status='Sent'").run(messageId).changes;
    },
    findMessageById(messageId) {
      const row = db.prepare(`${selectMessage} WHERE message_id=?`).get(messageId);
      return row && { ...row, deliveryStatus: row.status === 'Sent' ? 'pending' : 'delivered' };
    },
    markMessageRead(messageId, userId, readAt) {
      return db.prepare('INSERT OR IGNORE INTO receipts(message_id,user_id,read_at) VALUES (?,?,?)').run(messageId, userId, readAt).changes;
    },
    getMessageReadReceipts(messageId) {
      return db.prepare('SELECT message_id AS messageId,user_id AS userId,read_at AS readAt FROM receipts WHERE message_id=? ORDER BY read_at,user_id').all(messageId);
    },
    getRecentMessages(roomId, limit = 50) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError('Message history limit must be between 1 and 50');
      return db.prepare(`${selectMessage} WHERE room_id=? ORDER BY seq DESC LIMIT ?`).all(roomId, limit).reverse()
        .map(row => ({ ...row, deliveryStatus: row.status === 'Sent' ? 'pending' : 'delivered' }));
    },
    close() { db.close(); }
  };
}

module.exports = { createDatabase, createVerifiedBackup };
