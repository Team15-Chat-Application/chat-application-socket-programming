const { RoomStore, registerRoomHandlers, roomChannel, MAX_PENDING_ROOM_EVENTS } = require('../../src/rooms');

function setup(validate = async () => true) {
  const rooms = new RoomStore();
  const identity = { userId: 'alice', sessionId: 'session' };
  const payload = { roomId: rooms.create(identity, { name: 'Room' }).roomId };
  const handlers = {};
  const socket = {
    id: 'socket', connected: true, data: { identity }, rooms: new Set(),
    on: (name, handler) => { handlers[name] = handler; }, emit: jest.fn(),
    async join(channel) { this.rooms.add(channel); },
    async leave(channel) { this.rooms.delete(channel); },
    disconnect() { this.connected = false; this.rooms.clear(); handlers.disconnect?.(); }
  };
  registerRoomHandlers(socket, rooms, { to: () => ({ emit: jest.fn() }) }, validate);
  const send = (event, value = payload) => new Promise(resolve => handlers[event](value, resolve));
  return { rooms, socket, payload, handlers, send };
}

test.each(['join', 'leave'])('a store %s failure preserves store/transport membership equality', async operation => {
  const { rooms, socket, payload, send } = setup();
  if (operation === 'leave') await send('room:join');
  jest.spyOn(rooms, operation).mockImplementationOnce(() => { throw new Error('store failure'); });
  expect(await send(`room:${operation}`)).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });
  const expected = operation === 'leave';
  expect(rooms.hasSocket(payload.roomId, socket.id)).toBe(expected);
  expect(socket.rooms.has(roomChannel(payload.roomId))).toBe(expected);
});

test.each(['join', 'leave'])('a partially applied transport %s failure rolls back both memberships', async operation => {
  const { rooms, socket, payload, send } = setup();
  if (operation === 'leave') await send('room:join');
  const original = socket[operation].bind(socket);
  jest.spyOn(socket, operation).mockImplementationOnce(async channel => {
    await original(channel);
    throw new Error('adapter failed after side effect');
  });
  expect(await send(`room:${operation}`)).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });
  const expected = operation === 'leave';
  expect(rooms.hasSocket(payload.roomId, socket.id)).toBe(expected);
  expect(socket.rooms.has(roomChannel(payload.roomId))).toBe(expected);
});

test('room queue rejects overflow and admits new work after draining', async () => {
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const { handlers, send } = setup(async () => { await blocked; return true; });
  const waiting = Array.from({ length: MAX_PENDING_ROOM_EVENTS }, () => send('room:list', {}));
  const overflow = jest.fn();
  handlers['room:list']({}, overflow);
  expect(overflow).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'RATE_LIMITED' }) }));
  release();
  expect((await Promise.all(waiting)).every(result => result.ok)).toBe(true);
  expect((await send('room:list', {})).ok).toBe(true);
});
