
// CHAT-14 / CHAT-15 over the real Socket.IO transport.
//
// Fixture-backed verification, not production authentication.
const { createDatabase } = require('../../src/database');
const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { createApplication } = require('../../src/app');
const { createJwtAuth, ISSUER, AUDIENCE } = require('../../src/jwt-auth');
const { RoomStore } = require('../../src/rooms');
const { MessageService, registerMessageHandlers } = require('../../src/messages');

const SECRET = 'test-only-signing-key-with-at-least-32-bytes';

function once(socket, event) {
  return new Promise((resolve, reject) => {
    const handler = value => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error('Timed out: ' + event));
    }, 3000);
    socket.once(event, handler);
  });
}

const collect = (socket, event) => {
  const seen = [];
  socket.on(event, value => seen.push(value));
  return seen;
};

const ack = (s, e, p) => new Promise((resolve, reject) => {
  s.timeout(3000).emit(e, p, (err, result) =>
    err ? reject(err) : resolve(result)
  );
});

let app, clients, sessions, rooms, database, url;

function build({ messageNewId = undefined } = {}) {
  clients = [];
  sessions = new Map();
  rooms = new RoomStore();
  database = createDatabase(':memory:');

  const messages = new MessageService({
    rooms,
    database,
    newId: messageNewId
  });

  const auth = createJwtAuth({
    secret: SECRET,
    findSession: async id => sessions.get(id)
  });

  app = createApplication({
    auth,
    rooms,
    registerHandlers: (io, socket) =>
      registerMessageHandlers(socket, messages, io)
  });
}

beforeEach(async () => {
  build();
  const address = await app.start(0);
  url = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  clients.forEach(s => s.disconnect());

  if (app) {
    await app.stop();
    app = null;
  }

  if (database) {
    database.close();
    database = null;
  }
});

async function client(userId, suffix = 'one') {
  // Create the user in the in-memory database before sending messages.
  if (!database.findUserById(userId)) {
    database.createUser({
      userId,
      username: userId,
      passwordHash: 'test-only-password-hash'
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionId = userId + '-' + suffix;

  sessions.set(sessionId, {
    userId,
    sessionId,
    expiresAt: now + 600,
    revokedAt: null
  });

  const token = jwt.sign({
    sub: userId,
    jti: sessionId,
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now,
    exp: now + 600
  }, SECRET, { algorithm: 'HS256' });

  const s = connect(url, {
    autoConnect: false,
    reconnection: false,
    auth: { token }
  });

  clients.push(s);

  const connected = once(s, 'connect');
  s.connect();
  await connected;

  return s;
}

// Room joining belongs to CHAT-19.
async function joinRoom(...members) {
  const room = (await ack(members[0], 'room:create', {
    name: 'General'
  })).data;

  for (const member of members) {
    await ack(member, 'room:join', { roomId: room.roomId });
  }

  return room;
}

test('CHAT-14/CHAT-15: broadcast reaches every member and sender is acknowledged only after dispatch', async () => {
  const alice = await client('alice');
  const bob = await client('bob', 'first');
  const tab = await client('bob', 'second');
  const outsider = await client('outsider');

  const room = await joinRoom(alice, bob, tab);

  const outsiderMessages = collect(outsider, 'message:received');
  const delivered = once(bob, 'message:received');
  const tabDelivery = once(tab, 'message:received');

  const order = [];
  alice.on('message:received', () => order.push('received'));

  const result = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'hello <b>world</b>'
  });

  order.push('ack');

  expect(order).toEqual(['received', 'ack']);

  expect(result).toEqual({
    ok: true,
    data: {
      messageId: expect.any(String),
      roomId: room.roomId,
      senderId: 'alice',
      content: 'hello world',
      createdAt: expect.any(String)
    }
  });

  expect(/T.*Z$/.test(result.data.createdAt)).toBe(true);
  expect(await delivered).toEqual(result.data);
  expect(await tabDelivery).toEqual(result.data);
  expect(outsiderMessages).toEqual([]);
});

test('CHAT-14: payload identity fields cannot override the verified token', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const delivered = once(bob, 'message:received');

  const result = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'hi',
    senderId: 'mallory',
    userId: 'mallory',
    messageId: 'forged',
    createdAt: '1970-01-01T00:00:00.000Z'
  });

  expect(result.data.senderId).toBe('alice');
  expect(result.data.messageId).not.toBe('forged');
  expect(result.data.createdAt).not.toBe('1970-01-01T00:00:00.000Z');
  expect(await delivered).toEqual(result.data);
});

test('CHAT-14: a second room never receives another room messages', async () => {
  const alice = await client('alice');
  const carol = await client('carol');

  const first = await joinRoom(alice);

  const second = (await ack(carol, 'room:create', {
    name: 'Private'
  })).data;

  await ack(carol, 'room:join', { roomId: second.roomId });

  const carolMessages = collect(carol, 'message:received');

  expect((await ack(alice, 'message:send', {
    roomId: first.roomId,
    content: 'room scoped'
  })).ok).toBe(true);

  await ack(carol, 'system:ping', { nonce: 'messaging-barrier' });
  expect(carolMessages).toEqual([]);
});

test('CHAT-14: non-members are refused and nothing is broadcast', async () => {
  const alice = await client('alice');
  const outsider = await client('outsider');

  const room = await joinRoom(alice);

  const outsiderMessages = collect(outsider, 'message:received');
  const aliceMessages = collect(alice, 'message:received');

  expect(await ack(outsider, 'message:send', {
    roomId: room.roomId,
    content: 'let me in'
  })).toEqual({
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Join the room before sending messages'
    }
  });

  await ack(outsider, 'system:ping', { nonce: 'messaging-barrier' });

  expect(outsiderMessages).toEqual([]);
  expect(aliceMessages).toEqual([]);
});

test.each([
  null,
  undefined,
  [],
  'room',
  {},
  { roomId: 42 },
  { roomId: 'x'.repeat(129) },
  { roomId: 'missing', content: 'hi' },
  { content: 'no room' }
])('CHAT-14: invalid message:send payload %# gets a failure envelope and no broadcast', async payload => {
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

test('CHAT-16: accepts 2000 code points and rejects 2001 without broadcasting', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const received = collect(bob, 'message:received');

  const exact = '😀'.repeat(2000);

  const accepted = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: exact
  });

  expect(accepted).toMatchObject({
    ok: true,
    data: { content: exact }
  });

  await ack(bob, 'system:ping', { nonce: 'chat-16-accepted' });
  expect(received).toHaveLength(1);

  const rejected = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: '😀'.repeat(2001)
  });

  expect(rejected).toEqual({
    ok: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: expect.any(String)
    }
  });

  await ack(alice, 'system:ping', { nonce: 'chat-16-boundary' });
  expect(received).toHaveLength(1);
});

test.each(['', '   ', '<script>alert(1)</script>'])(
  'CHAT-16: empty or invalid content returns validation failure without broadcasting: %j',
  async content => {
    const alice = await client('alice');
    const bob = await client('bob');
    const room = await joinRoom(alice, bob);

    const received = collect(bob, 'message:received');

    const result = await ack(alice, 'message:send', {
      roomId: room.roomId,
      content
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String)
      }
    });

    await ack(alice, 'system:ping', { nonce: 'chat-16-invalid' });
    expect(received).toEqual([]);
  }
);

test('CHAT-17: recipients and acknowledgement receive sanitized content only', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const received = once(bob, 'message:received');

  const result = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: '<b>Hello</b><script>alert(1)</script> & <i>world</i>'
  });

  const expected = 'Hello &amp; world';

  expect(result).toMatchObject({
    ok: true,
    data: { content: expected }
  });

  await expect(received).resolves.toMatchObject({
    content: expected
  });
});

test('CHAT-17: content empty after sanitization fails and is not broadcast', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const received = collect(bob, 'message:received');

  const result = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: '<script>alert(1)</script>'
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: expect.any(String)
    }
  });

  await ack(alice, 'system:ping', { nonce: 'chat-17-empty' });
  expect(received).toEqual([]);
});

test('CHAT-14: an unacknowledged emit still broadcasts', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const delivered = once(bob, 'message:received');

  alice.emit('message:send', {
    roomId: room.roomId,
    content: 'fire and forget'
  });

  expect((await delivered).content).toBe('fire and forget');
});

// CHAT-15: a server-side defect must produce the failure envelope.
test('CHAT-15: an internal failure returns the failure envelope and broadcasts nothing', async () => {
  await app.stop();
  app = null;

  database.close();
  database = null;

  build({ messageNewId: () => null });

  const address = await app.start(0);
  url = `http://127.0.0.1:${address.port}`;

  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const messages = collect(bob, 'message:received');

  expect(await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'boom'
  })).toEqual({
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred'
    }
  });

  await ack(alice, 'system:ping', { nonce: 'messaging-barrier' });
  expect(messages).toEqual([]);
});

test('CHAT-14: messages are delivered in send order without loss', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const received = collect(bob, 'message:received');
  const latencies = [];

  for (let i = 1; i <= 20; i++) {
    const sent = Date.now();

    const result = await ack(alice, 'message:send', {
      roomId: room.roomId,
      content: `message ${i}`
    });

    latencies.push(Date.now() - sent);
    expect(result.data.content).toBe(`message ${i}`);
  }

  const p90 = latencies.slice().sort((a, b) => a - b)[
    Math.ceil(latencies.length * 0.9) - 1
  ];

  console.info(
    `CHAT-15 sender acknowledgement over real transport: 20 sends, p90=${p90}ms, max=${Math.max(...latencies)}ms`
  );

  await ack(bob, 'system:ping', { nonce: 'order-barrier' });

  expect(received.map(m => m.content)).toEqual(
    Array.from({ length: 20 }, (_, i) => `message ${i + 1}`)
  );

  expect(new Set(received.map(m => m.messageId)).size).toBe(20);
});

test('CHAT-14: a revoked fixture session is rejected by the per-packet validator before the handler', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  await joinRoom(alice, bob);

  const bobMessages = collect(bob, 'message:received');
  const denied = once(alice, 'system:error');
  const gone = once(alice, 'disconnect');

  sessions.get('alice-one').revokedAt = Math.floor(Date.now() / 1000);

  alice.emit('message:send', {
    roomId: 'some-room',
    content: 'after revocation'
  });

  expect(await denied).toMatchObject({
    ok: false,
    error: { code: 'UNAUTHORIZED' }
  });

  await gone;
  expect(bobMessages).toEqual([]);
});

test('CHAT-14: leaving a room stops later messages for that sender', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  await ack(alice, 'room:leave', { roomId: room.roomId });

  const bobMessages = collect(bob, 'message:received');

  expect(await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'ghost post'
  })).toMatchObject({
    ok: false,
    error: { code: 'FORBIDDEN' }
  });

  await ack(alice, 'system:ping', { nonce: 'messaging-barrier' });
  expect(bobMessages).toEqual([]);
});

test('CHAT-23: retrieves room message history in chronological order', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  for (let i = 1; i <= 3; i++) {
    const result = await ack(alice, 'message:send', {
      roomId: room.roomId,
      content: `message ${i}`
    });
    expect(result.ok).toBe(true);
  }

  const history = await ack(bob, 'message:history', {
    roomId: room.roomId
  });

  expect(history.ok).toBe(true);
  expect(history.data.roomId).toBe(room.roomId);
  expect(history.data.messages.map(m => m.content)).toEqual([
    'message 1',
    'message 2',
    'message 3'
  ]);
});

test('CHAT-23: history returns only the latest 50 messages', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  for (let i = 1; i <= 55; i++) {
    const result = await ack(alice, 'message:send', {
      roomId: room.roomId,
      content: `message ${i}`
    });
    expect(result.ok).toBe(true);
  }

  const history = await ack(bob, 'message:history', {
    roomId: room.roomId
  });

  expect(history.ok).toBe(true);
  expect(history.data.messages).toHaveLength(50);
  expect(history.data.messages[0].content).toBe('message 6');
  expect(history.data.messages[49].content).toBe('message 55');
});

test('CHAT-23: non-members cannot retrieve room history', async () => {
  const alice = await client('alice');
  const outsider = await client('outsider');
  const room = await joinRoom(alice);

  await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'private message'
  });

  const result = await ack(outsider, 'message:history', {
    roomId: room.roomId
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Join the room before retrieving messages'
    }
  });
});

// CHAT-24: delivery status is updated after the server broadcasts the message.
test('CHAT-24: broadcasts message:delivered and persists delivered status', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const outsider = await client('outsider');
  const room = await joinRoom(alice, bob);

  const receivedByBob = once(bob, 'message:received');
  const deliveredToBob = once(bob, 'message:delivered');
  const deliveredToAlice = once(alice, 'message:delivered');
  const outsiderDeliveryEvents = collect(outsider, 'message:delivered');

  const result = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'delivery status check'
  });

  expect(result.ok).toBe(true);

  const receivedMessage = await receivedByBob;
  expect(receivedMessage).toEqual(result.data);

  const bobDelivery = await deliveredToBob;
  const aliceDelivery = await deliveredToAlice;
  const expectedDelivery = {
    roomId: room.roomId,
    messageId: result.data.messageId,
    deliveryStatus: 'delivered'
  };

  expect(bobDelivery).toEqual(expectedDelivery);
  expect(aliceDelivery).toEqual(expectedDelivery);

  const history = database.getRecentMessages(room.roomId, 50);
  const savedMessage = history.find(
    message => message.messageId === result.data.messageId
  );

  expect(savedMessage).toMatchObject({
    messageId: result.data.messageId,
    deliveryStatus: 'delivered'
  });

  await ack(outsider, 'system:ping', { nonce: 'chat-24-delivery-barrier' });
  expect(outsiderDeliveryEvents).toEqual([]);
});

test('CHAT-24: each successfully broadcast message receives its own delivered status', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);
  const deliveryEvents = collect(bob, 'message:delivered');

  for (let i = 1; i <= 3; i++) {
    const result = await ack(alice, 'message:send', {
      roomId: room.roomId,
      content: `delivery ${i}`
    });
    expect(result.ok).toBe(true);
  }

  await ack(bob, 'system:ping', { nonce: 'chat-24-multiple-deliveries' });

  expect(deliveryEvents).toHaveLength(3);
  expect(deliveryEvents.map(event => event.deliveryStatus)).toEqual([
    'delivered',
    'delivered',
    'delivered'
  ]);
  expect(new Set(deliveryEvents.map(event => event.messageId)).size).toBe(3);
  expect(deliveryEvents.every(event => event.roomId === room.roomId)).toBe(true);
});

// CHAT-25: A recipient can mark another user's message as read.
test('CHAT-25: recipient marks a message as read and sender receives notification', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const sent = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'read receipt test'
  });

  expect(sent.ok).toBe(true);

  const aliceReadEvent = once(alice, 'message:read');
  const bobReadEvent = once(bob, 'message:read');

  const result = await ack(bob, 'message:read', {
    roomId: room.roomId,
    messageId: sent.data.messageId
  });

  expect(result).toMatchObject({
    ok: true,
    data: {
      roomId: room.roomId,
      messageId: sent.data.messageId,
      readerId: 'bob',
      readAt: expect.any(String),
      alreadyRead: false
    }
  });

  const expectedEvent = result.data;

  expect(await aliceReadEvent).toEqual(expectedEvent);
  expect(await bobReadEvent).toEqual(expectedEvent);

  const receipts = database.getMessageReadReceipts(
    sent.data.messageId
  );

  expect(receipts).toHaveLength(1);
  expect(receipts[0]).toMatchObject({
    messageId: sent.data.messageId,
    userId: 'bob',
    readAt: expect.any(String)
  });
});

// CHAT-25: Repeated read events must not create duplicate database records.
test('CHAT-25: duplicate read events create only one read receipt', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const sent = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'duplicate receipt test'
  });

  const payload = {
    roomId: room.roomId,
    messageId: sent.data.messageId
  };

  const first = await ack(bob, 'message:read', payload);
  const second = await ack(bob, 'message:read', payload);

  expect(first.ok).toBe(true);
  expect(first.data.alreadyRead).toBe(false);

  expect(second.ok).toBe(true);
  expect(second.data.alreadyRead).toBe(true);

  const receipts = database.getMessageReadReceipts(
    sent.data.messageId
  );

  expect(receipts).toHaveLength(1);
  expect(receipts[0].userId).toBe('bob');
});

// CHAT-25: A sender cannot mark their own message as read.
test('CHAT-25: sender cannot mark their own message as read', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const room = await joinRoom(alice, bob);

  const sent = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'own message test'
  });

  const result = await ack(alice, 'message:read', {
    roomId: room.roomId,
    messageId: sent.data.messageId
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'You cannot mark your own message as read'
    }
  });

  expect(
    database.getMessageReadReceipts(sent.data.messageId)
  ).toHaveLength(0);
});

// CHAT-25: A user outside the room cannot mark its messages as read.
test('CHAT-25: non-members cannot mark room messages as read', async () => {
  const alice = await client('alice');
  const bob = await client('bob');
  const outsider = await client('outsider');

  const room = await joinRoom(alice, bob);

  const sent = await ack(alice, 'message:send', {
    roomId: room.roomId,
    content: 'private room message'
  });

  const outsiderEvents = collect(outsider, 'message:read');

  const result = await ack(outsider, 'message:read', {
    roomId: room.roomId,
    messageId: sent.data.messageId
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Join the room before marking messages as read'
    }
  });

  await ack(outsider, 'system:ping', {
    nonce: 'chat-25-outsider-barrier'
  });

  expect(outsiderEvents).toEqual([]);

  expect(
    database.getMessageReadReceipts(sent.data.messageId)
  ).toHaveLength(0);
});

// CHAT-25: A message cannot be marked as read through the wrong room.
test('CHAT-25: users cannot mark messages as read in another room', async () => {
  const alice = await client('alice');
  const bob = await client('bob');

  const firstRoom = await joinRoom(alice, bob);

  const secondRoom = (await ack(alice, 'room:create', {
    name: 'Another Room'
  })).data;

  await ack(alice, 'room:join', {
    roomId: secondRoom.roomId
  });

  const sent = await ack(alice, 'message:send', {
    roomId: firstRoom.roomId,
    content: 'message in first room'
  });

  const result = await ack(alice, 'message:read', {
    roomId: secondRoom.roomId,
    messageId: sent.data.messageId
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Message not found in this room'
    }
  });

  expect(
    database.getMessageReadReceipts(sent.data.messageId)
  ).toHaveLength(0);
});
