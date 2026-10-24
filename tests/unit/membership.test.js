const { RoomStore } = require('../../src/rooms');
const alice = { userId: 'alice', sessionId: 'alice-s' };
const bob = { userId: 'bob', sessionId: 'bob-s' };
let rooms, payload;
beforeEach(() => {
  rooms = new RoomStore();
  payload = { roomId: rooms.create(alice, { name: 'General' }).roomId };
});

test('TC-Room-02/04: counts unique users across sockets and returns isolated snapshots', () => {
  expect(rooms.join(alice, 'a1', payload)).toMatchObject({ changed: true, room: { memberCount: 1 } });
  expect(rooms.join(alice, 'a1', payload).changed).toBe(false);
  expect(rooms.join(alice, 'a2', payload).changed).toBe(false);
  expect(rooms.join(bob, 'b1', payload).room.memberCount).toBe(2);
  const snapshot = rooms.get(payload);
  snapshot.memberCount = 500;
  expect(rooms.list()[0].memberCount).toBe(2);
  expect(rooms.hasMember(payload.roomId, 'alice')).toBe(true);
  expect(rooms.hasSocket(payload.roomId, 'a2')).toBe(true);
  expect(rooms.hasSocket(payload.roomId, 'other')).toBe(false);
});

test('TC-Room-03: leave and disconnect notify only when the last user socket departs', () => {
  rooms.join(alice, 'a1', payload); rooms.join(alice, 'a2', payload); rooms.join(bob, 'b1', payload);
  expect(rooms.leave(alice, 'a1', payload).changed).toBe(false);
  expect(rooms.leave(alice, 'a1', payload).changed).toBe(false);
  expect(rooms.disconnect('a2')).toEqual([{ ...payload, userId: 'alice', action: 'leave', memberCount: 1 }]);
  expect(rooms.disconnect('a2')).toEqual([]);
  expect(rooms.hasMember(payload.roomId, 'alice')).toBe(false);
  expect(rooms.hasSocket(payload.roomId, 'a2')).toBe(false);
});

test('disconnect removes a socket from every joined room without removing empty rooms', () => {
  const second = { roomId: rooms.create(alice, { name: 'Second' }).roomId };
  rooms.join(alice, 'a1', payload); rooms.join(alice, 'a1', second);
  expect(rooms.disconnect('a1')).toHaveLength(2);
  expect(rooms.list().map(room => room.memberCount)).toEqual([0, 0]);
});

test.each([null, [], {}, { roomId: '' }, { roomId: 3 }, { roomId: 'x'.repeat(129) }])(
  'rejects malformed room IDs without mutating membership %#', value => {
    expect(() => rooms.join(alice, 'a1', value)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(rooms.list()[0].memberCount).toBe(0);
  });

test('unknown rooms and forged socket identities fail without changing membership', () => {
  expect(() => rooms.join(alice, 'a1', { roomId: 'missing' })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  rooms.join(alice, 'a1', payload);
  for (const operation of ['join', 'leave']) {
    expect(() => rooms[operation](bob, 'a1', payload)).toThrow(expect.objectContaining({ code: 'FORBIDDEN' }));
  }
  expect(rooms.list()[0].memberCount).toBe(1);
});
