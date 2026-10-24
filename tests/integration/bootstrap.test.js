const { io: connect } = require('socket.io-client');
const { createApplication } = require('../../src/app');

function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('Timed out waiting for ' + event)); }, 3000);
    const handler = value => { clearTimeout(timer); resolve(value); };
    socket.once(event, handler);
  });
}
function acknowledge(socket, payload) {
  return new Promise((resolve, reject) => socket.timeout(3000).emit('system:ping', payload, (error, response) => error ? reject(error) : resolve(response)));
}
let app;
let url;
let clients;
let valid;
const testAuth = {
  async authenticate() { return { userId: 'fixture-user', sessionId: 'fixture-session' }; },
  async validate() { return valid; }
};
async function start(options) {
  app = createApplication(options);
  const address = await app.start(0);
  url = `http://127.0.0.1:${address.port}`;
}
function client() {
  const socket = connect(url, { autoConnect: false, reconnection: false, auth: { token: 'test-fixture-only' } });
  clients.push(socket);
  return socket;
}
beforeEach(() => { clients = []; valid = true; });
afterEach(async () => { clients.forEach(socket => socket.disconnect()); if (app) await app.stop(); app = null; });

test('HTTP health responds over a real ephemeral listener', async () => {
  await start();
  const response = await fetch(url + '/api/health');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, data: { service: 'node', status: 'ok' } });
});
test('unimplemented REST endpoints return a structured 404', async () => {
  await start();
  const response = await fetch(url + '/api/auth/login', { method: 'POST' });
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
});
test('default server denies socket authentication until the auth module is supplied', async () => {
  await start();
  const socket = client();
  const failed = once(socket, 'connect_error');
  socket.connect();
  expect((await failed).data.code).toBe('AUTH_NOT_IMPLEMENTED');
});
test('test-injected auth permits diagnostic acknowledgements', async () => {
  await start({ auth: testAuth });
  const socket = client();
  const connected = once(socket, 'connect');
  socket.connect();
  await connected;
  expect(await acknowledge(socket, { nonce: 'setup-check' })).toEqual({ ok: true, data: { nonce: 'setup-check' } });
  expect(await acknowledge(socket, {})).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
});
test('a session that becomes invalid after connection is disconnected before its next event', async () => {
  await start({ auth: testAuth });
  const socket = client();
  const connected = once(socket, 'connect');
  socket.connect();
  await connected;
  valid = false;
  const rejected = once(socket, 'system:error');
  const disconnected = once(socket, 'disconnect');
  socket.emit('system:ping', { nonce: 'blocked' });
  expect(await rejected).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  await disconnected;
  expect(socket.connected).toBe(false);
});
