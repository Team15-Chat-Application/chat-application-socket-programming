
const Database = require('better-sqlite3');
const path = require('node:path');
const fs = require('node:fs');

function createDatabase(dbPath = path.join(__dirname, '..', 'data', 'chat.sqlite')) {
  const directory = path.dirname(dbPath);
  fs.mkdirSync(directory, { recursive: true });

  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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
  `);

  return {
    findUserByUsername(username) {
      return db.prepare(`
        SELECT user_id AS userId,
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
        SELECT user_id AS userId, username, role
        FROM users
        WHERE user_id = ?
      `).get(userId);
    },

    createUser({ userId, username, passwordHash }) {
      db.prepare(`
        INSERT INTO users (user_id, username, password_hash)
        VALUES (?, ?, ?)
      `).run(userId, username, passwordHash);
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
        SELECT session_id AS sessionId,
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

    close() {
      db.close();
    }
  };
}

module.exports = { createDatabase };
