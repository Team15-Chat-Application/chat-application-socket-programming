
const { createRuntime } = require('../../src/runtime');
const { io: connect } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const secret = 'test-real-account-issuer-only-not-for-production-123456';

let runtime;
let url;
let clients;

const ack = (socket, event, payload) =>
  new Promise((resolve, reject) => {
    socket.timeout(3000).emit(event, payload, (err, result) =>
      err ? reject(err) : resolve(result)
    );
  });

async function request(route, body, token) {
  const response = await fetch(url + '/api/auth/' + route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json()
  };
}

async function user(username) {
  await request('register', {
    username,
    password: 'test-password'
  });

  return (
    await request('login', {
      username,
      password: 'test-password'
    })
  ).body.data;
}

async function client(login) {
  const socket = connect(url, {
    autoConnect: false,
    reconnection: false,
    auth: { token: login.token }
  });

  clients.push(socket);

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });

  return socket;
}

beforeEach(async () => {
  clients = [];

  runtime = createRuntime({
    env: {},
    secret,
    filename: ':memory:'
  });

  const address = await runtime.app.start(0);
  url = 'http://127.0.0.1:' + address.port;
});

afterEach(async () => {
  clients.forEach(socket => socket.disconnect());
  clients = [];

  if (runtime) {
    await runtime.close();
    runtime = null;
  }
});

test('real HTTP registration/login, cross-user chat, history and read receipts', async () => {
  expect(runtime.history.db).toBe(runtime.database.db);

  const a = await user('Alice');
  const b = await user('Bob');

  const sa = await client(a);
  const sb = await client(b);

  const room = (await ack(sa, 'room:create', { name: 'Team' })).data;

  await ack(sa, 'room:join', { roomId: room.roomId });
  await ack(sb, 'room:join', { roomId: room.roomId });

  const outsider = await client(await user('Outside'));

  expect(
    (await ack(outsider, 'room:history', { roomId: room.roomId })).error.code
  ).toBe('FORBIDDEN');

  expect(
    (await request('register', {
      username: 'ALICE',
      password: 'different'
    })).status
  ).toBe(409);
});

test('CHAT-22: messages, rooms, sessions and receipts survive a runtime restart', async () => {
  clients.forEach(socket => socket.disconnect());
  clients = [];

  await runtime.close();
  runtime = null;

  const folder = fs.mkdtempSync(
    path.join(os.tmpdir(), 'team15-runtime-restart-')
  );

  let first;
  let second;
  let socket;

  try {
    const filename = path.join(folder, 'chat.sqlite');

    first = createRuntime({
      env: {},
      secret,
      filename
    });

    let address = await first.app.start(0);
    url = 'http://127.0.0.1:' + address.port;

    const account = await user('RestartUser');
    socket = await client(account);

    const room = (
      await ack(socket, 'room:create', { name: 'Persistent' })
    ).data;

    await ack(socket, 'room:join', { roomId: room.roomId });

    const sent = (
      await ack(socket, 'message:send', {
        roomId: room.roomId,
        content: 'Keep this message'
      })
    ).data;

    const reader = await client(await user('RestartReader'));

    await ack(reader, 'room:join', { roomId: room.roomId });

    const read = await ack(reader, 'message:read', {
      messageId: sent.messageId
    });

    expect(read.data.readBy).toHaveLength(1);

    socket.disconnect();
    socket = null;

    await first.close();
    first = null;

    second = createRuntime({
      env: {},
      secret,
      filename
    });

    address = await second.app.start(0);
    url = 'http://127.0.0.1:' + address.port;

    const resumed = await client(account);

    const joined = await ack(resumed, 'room:join', {
      roomId: room.roomId
    });

    expect(joined.data.history).toContainEqual(
      expect.objectContaining({
        messageId: sent.messageId,
        status: 'Read',
        readBy: [
          expect.objectContaining({
            userId: expect.any(String)
          })
        ]
      })
    );

    expect(second.history.db).toBe(second.database.db);
  } finally {
    clients.forEach(socket => socket.disconnect());
    clients = [];

    if (first) await first.close();
    if (second) await second.close();

    fs.rmSync(folder, {
      recursive: true,
      force: true
    });
  }
});

test('logout revokes real issued JWT and immediately disconnects its live socket', async () => {
  const a = await user('Alice');
  const socket = await client(a);

  const gone = new Promise(resolve =>
    socket.once('disconnect', resolve)
  );

  expect(
    (await request('logout', undefined, a.token)).status
  ).toBe(204);

  await gone;

  const denied = connect(url, {
    autoConnect: false,
    reconnection: false,
    auth: { token: a.token }
  });

  clients.push(denied);

  const result = new Promise(resolve =>
    denied.once('connect_error', resolve)
  );

  denied.connect();

  expect((await result).data.code).toBe('UNAUTHORIZED');
});

test('logout closes every socket for the verified session while preserving a different login', async () => {
  const a = await user('Alice');

  const first = await client(a);

  const sameSession = {
    ...a,
    token: jwt.sign(
      { ...jwt.decode(a.token), tab: 'second' },
      secret,
      { algorithm: 'HS256' }
    )
  };

  expect(sameSession.token === a.token).toBe(false);

  const second = await client(sameSession);

  const otherLogin = (
    await request('login', {
      username: 'Alice',
      password: 'test-password'
    })
  ).body.data;

  const other = await client(otherLogin);

  const gone = Promise.all(
    [first, second].map(socket =>
      new Promise(resolve => socket.once('disconnect', resolve))
    )
  );

  expect(
    (await request('logout', undefined, a.token)).status
  ).toBe(204);

  await gone;

  expect(other.connected).toBe(true);

  expect(
    (await ack(other, 'system:ping', {
      nonce: 'remaining-session'
    })).ok
  ).toBe(true);
});

test('actual login handler keeps five-per-minute limit and rejects malformed JSON', async () => {
  for (let i = 0; i < 5; i++) {
    expect((await request('login', {})).status).toBe(401);
  }

  expect((await request('login', {})).status).toBe(429);
  expect((await request('register', [])).status).toBe(400);
});

test('production refuses plaintext, weak signing configuration and flag spellings', () => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'chat-tls-')
  );

  try {
    fs.writeFileSync(dir + '/cert.pem', 'placeholder');
    fs.writeFileSync(dir + '/key.pem', 'placeholder');

    for (const spelling of [
      'production',
      'Production',
      'PRODUCTION',
      'production ',
      '"production"'
    ]) {
      expect(() =>
        createRuntime({ env: { NODE_ENV: spelling } })
      ).toThrow('TLS');

      expect(() =>
        createRuntime({
          env: {
            NODE_ENV: spelling,
            TLS_CERT_PATH: dir + '/cert.pem',
            TLS_KEY_PATH: dir + '/key.pem'
          },
          filename: ':memory:'
        })
      ).toThrow('JWT_SECRET');
    }
  } finally {
    fs.rmSync(dir, {
      recursive: true,
      force: true
    });
  }

  expect(() =>
    createRuntime({
      env: {
        NODE_ENV: 'development',
        TLS_CERT_PATH: 'unused.pem'
      }
    })
  ).toThrow('Both TLS_CERT_PATH and TLS_KEY_PATH');

  expect(() =>
    createRuntime({
      env: {
        NODE_ENV: 'development',
        TLS_KEY_PATH: 'unused.pem'
      }
    })
  ).toThrow('Both TLS_CERT_PATH and TLS_KEY_PATH');
});

test('typing debounce, room-scoped presence, and outsider rejection use real credentials', async () => {
  const a = await user('Alice');
  const b = await user('Bob');

  const sa = await client(a);
  const sb = await client(b);

  const room = (
    await ack(sa, 'room:create', { name: 'Team' })
  ).data;

  await ack(sa, 'room:join', { roomId: room.roomId });

  const presence = new Promise(resolve =>
    sa.once('presence:changed', resolve)
  );

  await ack(sb, 'room:join', { roomId: room.roomId });

  expect((await presence).status).toBe('online');

  expect(
    (await ack(sa, 'presence:list', { roomId: room.roomId })).data.users
  ).toHaveLength(2);

  const typing = new Promise(resolve =>
    sa.once('presence:typing', resolve)
  );

  await ack(sb, 'typing:set', {
    roomId: room.roomId,
    typing: true
  });

  expect((await typing).typing).toBe(true);

  expect(
    (await ack(sb, 'typing:set', {
      roomId: room.roomId,
      typing: true
    })).data.debounced
  ).toBe(true);

  const gone = new Promise(resolve =>
    sa.once('presence:changed', resolve)
  );

  sb.disconnect();

  expect((await gone).status).toBe('offline');
});

test('serves static assets and rejects unknown paths with 404', async () => {
  expect((await fetch(url + '/')).status).toBe(200);
  expect((await fetch(url + '/app.js')).status).toBe(200);
  expect((await fetch(url + '/style.css')).status).toBe(200);
  expect((await fetch(url + '/vendor/socket.io.min.js')).status).toBe(200);
  expect((await fetch(url + '/unknown-file')).status).toBe(404);

  expect(
    (await fetch(url + '/api/auth/register', {
      method: 'GET'
    })).status
  ).toBe(404);
});

test('typing indicator auto-expires after 1500ms', async () => {
  const a = await user('Alice');
  const b = await user('Bob');

  const sa = await client(a);
  const sb = await client(b);

  const room = (
    await ack(sa, 'room:create', { name: 'TypingRoom' })
  ).data;

  await ack(sa, 'room:join', { roomId: room.roomId });
  await ack(sb, 'room:join', { roomId: room.roomId });

  const cleared = new Promise(resolve => {
    sa.on('presence:typing', payload => {
      if (!payload.typing) resolve(payload);
    });
  });

  await ack(sb, 'typing:set', {
    roomId: room.roomId,
    typing: true
  });

  const result = await cleared;

  expect(result.typing).toBe(false);
  expect(result.userId).toBe(b.user.userId);
});
