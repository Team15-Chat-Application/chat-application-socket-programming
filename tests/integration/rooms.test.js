const { io: connect } = require('socket.io-client');
const { createApplication } = require('../../src/app');
const { RoomStore } = require('../../src/rooms');

function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error('Timed out: ' + event)); }, 3000);
    const handler = value => { clearTimeout(timer); resolve(value); };
    socket.once(event, handler);
  });
}
const ack = (socket, event, payload) => new Promise((resolve, reject) =>
  socket.timeout(3000).emit(event, payload, (error, response) => error ? reject(error) : resolve(response)));
let app, url, clients, valid, rooms;
const fixtureAuth = {
  async authenticate({ token }) {
    if (token !== 'fixture-only') throw new Error('fixture credential rejected');
    return { userId: 'fixture-user', sessionId: 'fixture-session' };
  },
  async validate() { return valid; }
};
async function start(options = {}) {
  app = createApplication({ auth: fixtureAuth, rooms, ...options });
  const address = await app.start(0);
  url = `http://127.0.0.1:${address.port}`;
}
async function client() {
  const socket = connect(url, { autoConnect: false, reconnection: false, auth: { token: 'fixture-only' } });
  clients.push(socket);
  const ready = once(socket, 'connect');
  socket.connect();
  await ready;
  return socket;
}
beforeEach(() => { clients = []; valid = true; rooms = new RoomStore(); });
afterEach(async () => { clients.forEach(socket => socket.disconnect()); if (app) await app.stop(); app = null; });

test('TC-Room-01: created named room is visible to another authenticated client', async () => {
  await start();
  const creator = await client();
  const observer = await client();
  expect(await ack(observer, 'room:list', {})).toEqual({ ok: true, data: { rooms: [] } });
  const result = await ack(creator, 'room:create', { name: ' General ', roomId: 'forged', userId: 'forged' });
  expect(result).toEqual({ ok: true, data: { roomId: expect.any(String), name: 'General', memberCount: 0 } });
  expect(result.data.roomId).not.toBe('forged');
  expect(await ack(observer, 'room:list', {})).toEqual({ ok: true, data: { rooms: [result.data] } });
  expect((await ack(creator, 'room:create', { name: 'General' })).data.roomId).not.toBe(result.data.roomId);
});
test('invalid names do not change the room catalogue; boundary Unicode names pass', async () => {
  await start();
  const socket = await client();
  for (const payload of [null, [], {}, { name: ' ' }, { name: 'a'.repeat(65) }, { name: 'bad\u0000' }]) {
    expect(await ack(socket, 'room:create', payload)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  }
  expect((await ack(socket, 'room:list', {})).data.rooms).toEqual([]);
  expect(await ack(socket, 'room:list', [])).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  expect((await ack(socket, 'room:create', { name: '😀'.repeat(64) })).ok).toBe(true);
});
test('concurrent creation by two clients retains both distinct room records', async () => {
  await start();
  const first = await client(), second = await client();
  const results = await Promise.all([ack(first, 'room:create', { name: 'A' }), ack(second, 'room:create', { name: 'B' })]);
  expect(results.every(result => result.ok)).toBe(true);
  expect(new Set(results.map(result => result.data.roomId)).size).toBe(2);
  expect((await ack(first, 'room:list', {})).data.rooms).toEqual(expect.arrayContaining(results.map(result => result.data)));
});
test.each(['room:create', 'room:list'])('invalidated sessions cannot dispatch %s', async event => {
  await start();
  const socket = await client();
  valid = false;
  const denied = once(socket, 'system:error'), gone = once(socket, 'disconnect');
  socket.emit(event, { name: 'Blocked' });
  expect(await denied).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
  await gone;
  expect(rooms.list()).toEqual([]);
});
test('default authentication denies access before any room can be created', async () => {
  app = createApplication({ rooms });
  const address = await app.start(0);
  const socket = connect(`http://127.0.0.1:${address.port}`, { autoConnect: false, reconnection: false });
  clients.push(socket);
  const denied = once(socket, 'connect_error');
  socket.connect();
  expect((await denied).data.code).toBe('AUTH_NOT_IMPLEMENTED');
  expect(rooms.list()).toEqual([]);
});
test('unexpected allocation failures return safe errors without corrupting rooms', async () => {
  rooms = new RoomStore({ newId: () => { throw new Error('secret database credentials'); } });
  await start();
  const socket = await client();
  expect(await ack(socket, 'room:create', { name: 'General' })).toEqual({
    ok: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' }
  });
  expect(rooms.list()).toEqual([]);
});
