
const { createDatabase } = require('../../src/database');
const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { createApplication } = require('../../src/app');
const { createJwtAuth, ISSUER, AUDIENCE } = require('../../src/jwt-auth');
const { RoomStore } = require('../../src/rooms');
const { MessageService, registerMessageHandlers } = require('../../src/messages');

jest.setTimeout(30000);

const SECRET = 'test-only-signing-key-with-at-least-32-bytes';

const USER_COUNT = 20;
const MESSAGES_PER_USER = 5;
const EXPECTED_MESSAGES = USER_COUNT * MESSAGES_PER_USER;

function once(socket, event, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const handler = value => {
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);

    socket.once(event, handler);
  });
}

function ack(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(10000).emit(event, payload, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

function collect(socket, event) {
  const received = [];
  socket.on(event, message => received.push(message));
  return received;
}

async function waitForMessageCount(received, expected, timeout = 15000) {
  const start = Date.now();

  while (received.length < expected) {
    if (Date.now() - start > timeout) {
      throw new Error(
        `Expected ${expected} messages, received ${received.length}`
      );
    }

    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

describe('CHAT-31: Concurrent WebSocket Load Test', () => {
  let app;
  let database;
  let rooms;
  let sessions;
  let clients;
  let url;

  beforeEach(async () => {
    clients = [];
    sessions = new Map();
    rooms = new RoomStore();
    database = createDatabase(':memory:');

    const messages = new MessageService({ rooms, database });

    const auth = createJwtAuth({
      secret: SECRET,
      findSession: async sessionId => sessions.get(sessionId)
    });

    app = createApplication({
      auth,
      rooms,
      registerHandlers: (io, socket) =>
        registerMessageHandlers(socket, messages, io)
    });

    const address = await app.start(0);
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    clients.forEach(socket => socket.disconnect());

    if (app) {
      await app.stop();
      app = null;
    }

    if (database) {
      database.close();
      database = null;
    }
  });

  async function createClient(index) {
    const userId = `load-user-${index}`;
    const sessionId = `load-session-${index}`;

    database.createUser({
      userId,
      username: userId,
      passwordHash: 'test-only-password-hash'
    });

    const now = Math.floor(Date.now() / 1000);

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

    const socket = connect(url, {
      autoConnect: false,
      reconnection: false,
      auth: { token }
    });

    clients.push(socket);

    const connected = once(socket, 'connect');
    socket.connect();

    await connected;

    return socket;
  }

  test('20 simultaneous users connect, join a room and exchange messages', async () => {
    // Phase 1: Connect 20 authenticated users simultaneously.
    const connectionStart = Date.now();

    const users = await Promise.all(
      Array.from({ length: USER_COUNT }, (_, index) =>
        createClient(index)
      )
    );

    const connectionTime = Date.now() - connectionStart;

    expect(users).toHaveLength(USER_COUNT);
    expect(users.every(socket => socket.connected)).toBe(true);

    // Phase 2: Create one room and join all users.
    const roomResult = await ack(users[0], 'room:create', {
      name: 'Concurrent Load Test'
    });

    expect(roomResult.ok).toBe(true);

    const roomId = roomResult.data.roomId;

    const joinResults = await Promise.all(
      users.map(socket =>
        ack(socket, 'room:join', { roomId })
      )
    );

    expect(joinResults.every(result => result.ok)).toBe(true);

    // Phase 3: Start collecting messages before sending.
    const receivedMessages = users.map(socket =>
      collect(socket, 'message:received')
    );

    // Phase 4: All 20 users send 5 messages concurrently.
    const messageStart = Date.now();

    const sendOperations = users.flatMap((socket, userIndex) =>
      Array.from({ length: MESSAGES_PER_USER }, (_, messageIndex) =>
        ack(socket, 'message:send', {
          roomId,
          content: `Load test message ${messageIndex + 1} from user ${userIndex + 1}`
        })
      )
    );

    const sendResults = await Promise.all(sendOperations);

    const messageTime = Date.now() - messageStart;

    // Phase 5: Verify every message was acknowledged successfully.
    expect(sendResults).toHaveLength(EXPECTED_MESSAGES);
    expect(sendResults.every(result => result.ok)).toBe(true);

    // Phase 6: Verify all users received all 100 messages.
    await Promise.all(
      receivedMessages.map(received =>
        waitForMessageCount(received, EXPECTED_MESSAGES)
      )
    );

    for (const received of receivedMessages) {
      expect(received).toHaveLength(EXPECTED_MESSAGES);
    }

    // Phase 7: Verify message uniqueness.
    const messageIds = new Set(
      sendResults.map(result => result.data.messageId)
    );

    expect(messageIds.size).toBe(EXPECTED_MESSAGES);

    // Phase 8: Verify all users remain connected.
    expect(users.every(socket => socket.connected)).toBe(true);

    console.log('\nCHAT-31 LOAD TEST RESULTS');
    console.log('-------------------------');
    console.log(`Concurrent users: ${USER_COUNT}`);
    console.log(`Messages per user: ${MESSAGES_PER_USER}`);
    console.log(`Total messages sent: ${EXPECTED_MESSAGES}`);
    console.log(`Total messages received per user: ${EXPECTED_MESSAGES}`);
    console.log(`Total broadcast deliveries: ${USER_COUNT * EXPECTED_MESSAGES}`);
    console.log(`Connection time: ${connectionTime} ms`);
    console.log(`Message sending time: ${messageTime} ms`);
    console.log('Successful connections: 20/20');
    console.log('Successful message acknowledgements: 100/100');
    console.log('All users received all messages: YES');
    console.log('Duplicate message IDs: 0');
    console.log('Unexpected disconnections: 0');
  });
});
