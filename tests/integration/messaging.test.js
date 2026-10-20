// CHAT-14 / CHAT-15 over the real Socket.IO transport.
//
// Fixture-backed verification, not production authentication: these tests sign HS256
// tokens with a test-only secret and resolve them through Soham's createJwtAuth against
// an in-test session Map. Hrisheek's registration/login session issuance is still open,
// so a green run here proves the messaging handlers and the auth *consumer* contract,
// not an end-to-end login flow.
const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { createApplication } = require('../../src/app');
const { createJwtAuth, ISSUER, AUDIENCE } = require('../../src/jwt-auth');
const { RoomStore } = require('../../src/rooms');
const { MessageService, registerMessageHandlers } = require('../../src/messages');

const SECRET = 'test-only-signing-key-with-at-least-32-bytes';
function once(socket, event) {
  return new Promise((resolve, reject) => {
    const handler = value => { clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('Timed out: ' + event)); }, 3000);
    socket.once(event, handler);
  });
}
const collect = (socket, event) => { const seen = []; socket.on(event, value => seen.push(value)); return seen; };
const ack = (s, e, p) => new Promise((resolve, reject) => s.timeout(3000).emit(e, p, (err, result) => err ? reject(err) : resolve(result)));
let app, clients, sessions, rooms, url;

function build({ messageNewId = undefined } = {}) {
  clients = []; sessions = new Map(); rooms = new RoomStore();
  // The messaging service shares the one RoomStore instance, exactly as src/index.js wires it.
  const messages = new MessageService({ rooms, newId: messageNewId });
  const auth = createJwtAuth({ secret: SECRET, findSession: async id => sessions.get(id) });
  app = createApplication({ auth, rooms, registerHandlers: (io, socket) => registerMessageHandlers(socket, messages, io) });
}

beforeEach(async () => {
  build();
  const address = await app.start(0); url = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => { clients.forEach(s => s.disconnect()); await app.stop(); });

async function client(userId, suffix = 'one') {
  const now = Math.floor(Date.now() / 1000), sessionId = userId + '-' + suffix;
  sessions.set(sessionId, { userId, sessionId, expiresAt: now + 600, revokedAt: null });
  const token = jwt.sign({ sub: userId, jti: sessionId, iss: ISSUER, aud: AUDIENCE, iat: now, exp: now + 600 }, SECRET, { algorithm: 'HS256' });
  const s = connect(url, { autoConnect: false, reconnection: false, auth: { token } }); clients.push(s);
  const connected = once(s, 'connect'); s.connect(); await connected; return s;
}
// Room joining belongs to CHAT-19 (Soham); these tests use his handlers rather than re-implementing them.
async function joinRoom(...members) {
  const room = (await ack(members[0], 'room:create', { name: 'General' })).data;
  for (const member of members) await ack(member, 'room:join', { roomId: room.roomId });
  return room;
}

test('CHAT-14/CHAT-15: broadcast reaches every member and the sender is acknowledged only after dispatch', async () => {
  const alice = await client('alice'), bob = await client('bob', 'first'), tab = await client('bob', 'second');
  const outsider = await client('outsider');
  const room = await joinRoom(alice, bob, tab);
  const outsiderMessages = collect(outsider, 'message:received');
  const delivered = once(bob, 'message:received');
  const tabDelivery = once(tab, 'message:received');
  const order = [];
  alice.on('message:received', () => order.push('received'));
  const result = await ack(alice, 'message:send', { roomId: room.roomId, content: 'hello <b>world</b>' });
  order.push('ack');
  expect(order).toEqual(['received', 'ack']);
  expect(result).toEqual({
    ok: true,
    data: { messageId: expect.any(String), roomId: room.roomId, senderId: 'alice', content: 'hello world', createdAt: expect.any(String) }
  });
  expect(/T.*Z$/.test(result.data.createdAt)).toBe(true);
  expect(await delivered).toEqual(result.data);
  expect(await tabDelivery).toEqual(result.data);
  expect(outsiderMessages).toEqual([]);
});

test('CHAT-14: payload identity fields cannot override the verified token', async () => {
  const alice = await client('alice'), bob = await client('bob');
  const room = await joinRoom(alice, bob);
  const delivered = once(bob, 'message:received');
  const result = await ack(alice, 'message:send', {
    roomId: room.roomId, content: 'hi', senderId: 'mallory', userId: 'mallory', messageId: 'forged', createdAt: '1970-01-01T00:00:00.000Z'
  });
  expect(result.data.senderId).toBe('alice');
  expect(result.data.messageId).not.toBe('forged');
  expect(result.data.createdAt).not.toBe('1970-01-01T00:00:00.000Z');
  expect(await delivered).toEqual(result.data);
});

test('CHAT-14: a second room never receives another room\'s messages', async () => {
  const alice = await client('alice'), carol = await client('carol');
  const first = await joinRoom(alice);
  const second = (await ack(carol, 'room:create', { name: 'Private' })).data;
  await ack(carol, 'room:join', { roomId: second.roomId });
  const carolMessages = collect(carol, 'message:received');
  expect((await ack(alice, 'message:send', { roomId: first.roomId, content: 'room scoped' })).ok).toBe(true);
  // A barrier round-trip guarantees any stray broadcast has already arrived before asserting.
  await ack(carol, 'system:ping', { nonce: 'messaging-barrier' });
  expect(carolMessages).toEqual([]);
});

test('CHAT-14: non-members are refused and nothing is broadcast', async () => {
  const alice = await client('alice'), outsider = await client('outsider');
  const room = await joinRoom(alice);
  const outsiderMessages = collect(outsider, 'message:received');
  const aliceMessages = collect(alice, 'message:received');
  expect(await ack(outsider, 'message:send', { roomId: room.roomId, content: 'let me in' }))
    .toEqual({ ok: false, error: { code: 'FORBIDDEN', message: 'Join the room before sending messages' } });
  await ack(outsider, 'system:ping', { nonce: 'messaging-barrier' });
  expect(outsiderMessages).toEqual([]);
  expect(aliceMessages).toEqual([]);
});

test.each([null, undefined, [], 'room', {}, { roomId: 42 }, { roomId: 'x'.repeat(129) },
  { roomId: 'missing', content: 'hi' }, { content: 'no room' }])
  ('CHAT-14: invalid message:send payload %# gets a failure envelope and no broadcast', async payload => {
    const alice = await client('alice');
    await joinRoom(alice);
    const messages = collect(alice, 'message:received');
    const result = await ack(alice, 'message:send', payload);
    expect(result.ok).toBe(false);
    expect(['VALIDATION_ERROR', 'NOT_FOUND']).toContain(result.error.code);
    expect(result.error.message).toEqual(expect.any(String));
    await ack(alice, 'system:ping', { nonce: 'messaging-barrier' });
    expect(messages).toEqual([]);
  });

test('CHAT-14: an unacknowledged emit still broadcasts', async () => {
  const alice = await client('alice'), bob = await client('bob');
  const room = await joinRoom(alice, bob);
  const delivered = once(bob, 'message:received');
  alice.emit('message:send', { roomId: room.roomId, content: 'fire and forget' });
  expect((await delivered).content).toBe('fire and forget');
});

// CHAT-15: a server-side defect must produce the failure envelope, never a half-built message.
test('CHAT-15: an internal failure returns the failure envelope and broadcasts nothing', async () => {
  await app.stop();
  build({ messageNewId: () => null });
  const address = await app.start(0); url = `http://127.0.0.1:${address.port}`;
  const alice = await client('alice'), bob = await client('bob');
  const room = await joinRoom(alice, bob);
  const messages = collect(bob, 'message:received');
  expect(await ack(alice, 'message:send', { roomId: room.roomId, content: 'boom' }))
    .toEqual({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } });
  await ack(alice, 'system:ping', { nonce: 'messaging-barrier' });
  expect(messages).toEqual([]);
});

test('CHAT-14: messages are delivered in send order without loss', async () => {
  const alice = await client('alice'), bob = await client('bob');
  const room = await joinRoom(alice, bob);
  const received = collect(bob, 'message:received');
  const latencies = [];
  for (let i = 1; i <= 20; i++) {
    const sent = Date.now();
    const result = await ack(alice, 'message:send', { roomId: room.roomId, content: `message ${i}` });
    latencies.push(Date.now() - sent);
    expect(result.data.content).toBe(`message ${i}`);
  }
  const p90 = latencies.slice().sort((a, b) => a - b)[Math.ceil(latencies.length * 0.9) - 1];
  // Reported, not contracted: the test plan states no numeric delivery budget, so only the
  // 3000 ms transport guard already used by every acknowledgement is enforced here.
  console.info(`CHAT-15 sender acknowledgement over real transport: 20 sends, p90=${p90}ms, max=${Math.max(...latencies)}ms`);
  // The acknowledgement may resolve before the recipient's last packet is handled, so drain
  // the transport with a round-trip on the recipient before asserting completeness.
  await ack(bob, 'system:ping', { nonce: 'order-barrier' });
  expect(received.map(m => m.content)).toEqual(Array.from({ length: 20 }, (_, i) => `message ${i + 1}`));
  expect(new Set(received.map(m => m.messageId)).size).toBe(20);
});

test('CHAT-14: a revoked fixture session is rejected by the per-packet validator before the handler', async () => {
  const alice = await client('alice'), bob = await client('bob');
  const room = await joinRoom(alice, bob);
  const bobMessages = collect(bob, 'message:received');
  const denied = once(alice, 'system:error'), gone = once(alice, 'disconnect');
  sessions.get('alice-one').revokedAt = Math.floor(Date.now() / 1000);
  alice.emit('message:send', { roomId: room.roomId, content: 'after revocation' });
  expect(await denied).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  await gone;
  expect(bobMessages).toEqual([]);
});

test('CHAT-14: leaving a room stops later messages for that sender', async () => {
  const alice = await client('alice'), bob = await client('bob');
  const room = await joinRoom(alice, bob);
  await ack(alice, 'room:leave', { roomId: room.roomId });
  const bobMessages = collect(bob, 'message:received');
  expect(await ack(alice, 'message:send', { roomId: room.roomId, content: 'ghost post' }))
    .toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  await ack(alice, 'system:ping', { nonce: 'messaging-barrier' });
  expect(bobMessages).toEqual([]);
});
