// STP test-data preparation only: never writes to a live application database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createDatabase } = require('../src/database');
const { createAuthService } = require('../src/auth');
const { HistoryStore } = require('../src/history');

const fixtureRoot = path.resolve(__dirname, '..', 'reports', 'review-fixtures');

async function seedFixture({ name = 'review.sqlite', password } = {}) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]+\.sqlite$/.test(name)) {
    throw Error('Use a simple .sqlite filename inside reports/review-fixtures');
  }
  if (typeof password !== 'string' || !password || /\p{Cs}/u.test(password) ||
      Buffer.byteLength(password, 'utf8') > 72) {
    throw Error('Set REVIEW_SEED_PASSWORD to 1–72 UTF-8 bytes for isolated dummy accounts');
  }
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const filename = path.join(fixtureRoot, name);
  // Exclusive creation: existing databases, including symlinks, are never replaced.
  fs.closeSync(fs.openSync(filename, 'wx', 0o600));
  const database = createDatabase(filename);
  const history = new HistoryStore(filename);
  try {
    const auth = createAuthService({ database, secret: randomBytes(48).toString('hex') });
    const users = [];
    for (let index = 1; index <= 10; index++) {
      users.push(await auth.register({ username: 'seed_user_' + String(index).padStart(2, '0'), password }));
    }
    const login = await auth.login({ username: users[0].username, password });
    await auth.logout({ token: login.token });
    for (let roomIndex = 0; roomIndex < 5; roomIndex++) {
      const room = { roomId: randomUUID(), name: 'Seed Room ' + (roomIndex + 1) };
      history.createRoom(room, { userId: users[0].userId });
      for (let index = 0; index < 40; index++) {
        const message = {
          messageId: randomUUID(), roomId: room.roomId, senderId: users[index % 10].userId,
          content: 'Synthetic review message ' + (roomIndex * 40 + index + 1),
          createdAt: new Date().toISOString()
        };
        history.save(message);
        history.delivered(message.messageId);
        if (index % 4 === 0) history.read(message.messageId, users[(index + 1) % 10].userId);
      }
    }
  } finally {
    history.close();
    database.close();
  }
  const inspection = new DatabaseSync(filename, { readOnly: true });
  let report;
  try {
    const count = table => inspection.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n;
    const hashedPasswords = inspection.prepare('SELECT password_hash FROM users').all()
      .every(row => /^\$2[ab]\$1[0-4]\$/.test(row.password_hash));
    report = {
      recordedAt: new Date().toISOString(),
      file: path.relative(path.resolve(__dirname, '..'), filename).replaceAll('\\', '/'),
      users: count('users'), rooms: count('rooms'), messages: count('messages'),
      recipientReadReceipts: count('receipts'), bcryptCostAtLeast10: hashedPasswords,
      credentialRoundTripAndRevocation: true,
      scope: 'Isolated synthetic STP seed data; seeded delivery/read states are not evidence of network delivery, UAT or human approval',
      passwordsAndTokensPrinted: false
    };
    assert.equal(report.users, 10); assert.equal(report.rooms, 5);
    assert.equal(report.messages, 200); assert.equal(report.recipientReadReceipts, 50);
    assert.equal(report.bcryptCostAtLeast10, true);
  } finally { inspection.close(); }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  let report;
  if (args.length === 1 && args[0] === '--check') {
    const name = 'check-' + randomUUID() + '.sqlite';
    const password = randomBytes(24).toString('base64url');
    report = await seedFixture({ name, password });
    await assert.rejects(seedFixture({ name, password }), { code: 'EEXIST' });
    await assert.rejects(seedFixture({ name: '../live.sqlite', password }), /simple/);
    await assert.rejects(seedFixture({ name: 'missing-password.sqlite' }), /REVIEW_SEED_PASSWORD/);
    report.guards = { existingDatabasePreserved: true, pathTraversalRejected: true, missingPasswordRejected: true };
  } else {
    if (args.length && !(args.length === 2 && args[0] === '--name')) {
      throw Error('Usage: node scripts/seed_review.js [--name review.sqlite] or --check');
    }
    report = await seedFixture({ name: args[1] || 'review.sqlite', password: process.env.REVIEW_SEED_PASSWORD });
  }
  fs.writeFileSync(path.resolve(__dirname, '..', 'reports', 'seed-review.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

if (require.main === module) main().catch(error => {
  console.error(error.code === 'EEXIST' ? 'Fixture already exists; choose a fresh --name. No existing database was replaced.' : error.message);
  process.exitCode = 1;
});
module.exports = { seedFixture };
