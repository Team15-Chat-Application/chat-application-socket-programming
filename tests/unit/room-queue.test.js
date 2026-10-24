const { RoomStore, registerRoomHandlers } = require('../../src/rooms');

function setup(rooms = new RoomStore()) {
  const handlers = {};
  const socket = {
    id: 'queue-socket', connected: true,
    data: { identity: { userId: 'alice', sessionId: 'alice-session' } },
    on: (event, handler) => { handlers[event] = handler; },
    join: jest.fn(), leave: jest.fn(), emit: jest.fn(),
    disconnect() { this.connected = false; }
  };
  const io = { to: () => ({ emit: jest.fn() }) };
  registerRoomHandlers(socket, rooms, io, async () => true);
  return { handlers, socket, rooms };
}

test('CHAT-19: queued operations recover after an acknowledgement callback throws', async () => {
  const { handlers, rooms } = setup();
  const brokenAck = jest.fn(() => { throw new Error('ack transport failed'); });
  handlers['room:create']({ name: 'First' }, brokenAck);
  // Queue both events before the first operation/acknowledgement has completed.
  const recovered = new Promise(resolve => handlers['room:list']({}, resolve));
  await expect(recovered).resolves.toMatchObject({
    ok: true, data: { rooms: [{ name: 'First', memberCount: 0 }] }
  });
  expect(brokenAck).toHaveBeenCalled();
  expect(rooms.list()).toHaveLength(1);
});

test('CHAT-19: an operation failing after disconnection does not acknowledge a dead socket', async () => {
  const { handlers, socket, rooms } = setup();
  rooms.create = () => {
    socket.connected = false;
    throw new Error('operation failed after disconnect');
  };
  const respond = jest.fn();
  handlers['room:create']({ name: 'Disconnected' }, respond);
  await new Promise(resolve => setImmediate(resolve));
  expect(respond).not.toHaveBeenCalled();
});
