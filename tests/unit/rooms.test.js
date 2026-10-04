const { RoomStore, validateRoomName } = require('../../src/rooms');
const identity = { userId: 'verified-user', sessionId: 'verified-session' };

test.each([null, [], {}, { name: null }, { name: 42 }, { name: '' },
  { name: ' \t\n ' }, { name: 'a'.repeat(65) }, { name: '😀'.repeat(65) },
  { name: 'bad\u0000name' }, { name: 'bad\nname' }, { name: '\ud800' }])(
  'rejects malformed, empty, overlong or control-containing payload %#', payload => {
    const rooms = new RoomStore();
    expect(() => rooms.create(identity, payload)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(rooms.list()).toEqual([]);
  }
);
test('accepts one character, 64 characters and 64 Unicode code points', () => {
  for (const name of ['a', 'a'.repeat(64), '😀'.repeat(64)]) {
    expect(validateRoomName({ name })).toBe(name);
  }
  expect(validateRoomName({ name: ' \t General \r\n' })).toBe('General');
});
test.each([null, { userId: 'forged' }, { userId: '', sessionId: 's' }])(
  'requires a complete verified identity %#', identityValue => {
    const rooms = new RoomStore();
    expect(() => rooms.create(identityValue, { name: 'General' })).toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }));
    expect(rooms.list()).toEqual([]);
  }
);
test('uses unique server IDs for duplicate names and returns isolated snapshots', () => {
  const rooms = new RoomStore();
  const first = rooms.create(identity, { name: 'General', roomId: 'forged', userId: 'forged' });
  const second = rooms.create(identity, { name: 'General' });
  expect(first.roomId).not.toBe(second.roomId);
  expect(first.roomId).not.toBe('forged');
  expect(first).toEqual({ roomId: expect.any(String), name: 'General', memberCount: 0 });
  first.name = 'changed';
  const listed = rooms.list();
  listed[0].memberCount = 123;
  listed.pop();
  expect(rooms.list()).toEqual([
    { roomId: first.roomId, name: 'General', memberCount: 0 }, second
  ]);
});
test('ID collision cannot overwrite an existing room', () => {
  const rooms = new RoomStore({ newId: () => 'same-id' });
  const first = rooms.create(identity, { name: 'First' });
  expect(() => rooms.create(identity, { name: 'Second' })).toThrow('Room ID allocation failed');
  expect(rooms.list()).toEqual([first]);
});
test('catalogues are isolated between server instances', () => {
  const first = new RoomStore();
  first.create(identity, { name: 'First' });
  expect(new RoomStore().list()).toEqual([]);
});
