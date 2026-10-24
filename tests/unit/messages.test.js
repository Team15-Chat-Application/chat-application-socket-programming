const { RoomStore } = require('../../src/rooms');
const { MessageService, registerMessageHandlers } = require('../../src/messages');

const ALICE = { userId: 'alice', sessionId: 'alice-1' };
const BOB = { userId: 'bob', sessionId: 'bob-1' };
const FIXED_TIME = '2026-10-20T09:00:00.000Z';

function codeOf(action) {
  try { action(); } catch (error) { return error.code || `NON_APP_ERROR:${error.constructor.name}`; }
  return 'NO_ERROR';
}

function setup({ member = true } = {}) {
  let roomSeq = 0, messageSeq = 0;
  const rooms = new RoomStore({ newId: () => `room-${++roomSeq}` });
  const service = new MessageService({ rooms, newId: () => `msg-${++messageSeq}`, clock: () => FIXED_TIME });
  const room = rooms.create(ALICE, { name: 'General' });
  if (member) rooms.join(ALICE, 'sock-alice', { roomId: room.roomId });
  return { rooms, service, room, payload: { roomId: room.roomId, content: 'hello' } };
}

test('CHAT-14: the server issues identity, ID and timestamp, so payload fields cannot forge them', () => {
  const { service, room, payload } = setup();
  expect(service.send(ALICE, 'sock-alice', {
    ...payload, senderId: 'mallory', userId: 'mallory', messageId: 'forged', createdAt: '1970-01-01T00:00:00.000Z'
  })).toEqual({
    messageId: 'msg-1', roomId: room.roomId, senderId: 'alice', content: 'hello', createdAt: FIXED_TIME
  });
});

test('CHAT-14: repeated messages receive distinct IDs', () => {
  const { service, payload } = setup();
  expect(service.send(ALICE, 'sock-alice', payload).messageId).toBe('msg-1');
  expect(service.send(ALICE, 'sock-alice', payload).messageId).toBe('msg-2');
});

test.each([undefined, {}, { rooms: null }])('CHAT-14: the service cannot run without a shared RoomStore %#', options => {
  expect(() => new MessageService(options)).toThrow('RoomStore');
});

test.each([undefined, null, 'alice', [], { userId: 'alice' }, { userId: '', sessionId: 's' },
  { userId: 'alice', sessionId: 42 }])('CHAT-14: an unverified identity is rejected %#', identity => {
  const { service, payload } = setup();
  expect(() => service.send(identity, 'sock-alice', payload)).toThrow(
    expect.objectContaining({ code: 'UNAUTHORIZED' })
  );
});

test.each([null, undefined, [], 'room', {}, { roomId: '' }, { roomId: 42 }, { roomId: 'x'.repeat(129) }])
  ('CHAT-14: malformed room payloads are validation errors %#', payload => {
    const { service } = setup();
    expect(codeOf(() => service.send(ALICE, 'sock-alice', payload))).toBe('VALIDATION_ERROR');
  });

test.each([{ roomId: 'missing-room', content: 'hi' }, { roomId: 'sock-alice', content: 'hi' },
  { roomId: 'chat:room:room-1', content: 'hi' }])
  ('CHAT-14: unknown rooms and internal channel names are not addressable %#', payload => {
    const { service } = setup();
    expect(codeOf(() => service.send(ALICE, 'sock-alice', payload))).toBe('NOT_FOUND');
  });

test('CHAT-14: membership gates sending, and leaving withdraws that right', () => {
  const { rooms, service, room, payload } = setup();
  expect(codeOf(() => service.send(BOB, 'sock-bob', payload))).toBe('FORBIDDEN');
  expect(codeOf(() => service.send(ALICE, 'sock-alice-other', payload))).toBe('FORBIDDEN');
  rooms.leave(ALICE, 'sock-alice', { roomId: room.roomId });
  expect(codeOf(() => service.send(ALICE, 'sock-alice', payload))).toBe('FORBIDDEN');
});

test('CHAT-14: a second socket for the same member may send', () => {
  const { rooms, service, room, payload } = setup();
  rooms.join(ALICE, 'sock-alice-tab', { roomId: room.roomId });
  expect(service.send(ALICE, 'sock-alice-tab', payload).roomId).toBe(room.roomId);
});

test('CHAT-14: a missing or empty content is a validation error', () => {
  const { service, room } = setup();
  for (const content of [undefined, null, 42, '', '   ', '<script></script>']) {
    expect(codeOf(() => service.send(ALICE, 'sock-alice', { roomId: room.roomId, content }))).toBe('VALIDATION_ERROR');
  }
});

test('CHAT-16: accepts 2000 Unicode code points and rejects 2001', () => {
  const { service, room } = setup();
  const send = content => service.send(ALICE, 'sock-alice', { roomId: room.roomId, content });
  expect(send('a'.repeat(2000)).content).toBe('a'.repeat(2000));
  expect(codeOf(() => send('a'.repeat(2001)))).toBe('VALIDATION_ERROR');
  // Code points, not UTF-16 units: 2000 emoji are 4000 code units and must still be accepted.
  expect(send('😀'.repeat(2000)).content).toBe('😀'.repeat(2000));
  expect('😀'.repeat(2000).length).toBe(4000);
  expect(codeOf(() => send('😀'.repeat(2001)))).toBe('VALIDATION_ERROR');
});

test('CHAT-17: strips script content, removes markup, and escapes text safely', () => {
  const { service, room } = setup();
  expect(service.send(ALICE, 'sock-alice', { roomId: room.roomId, content: '<b>hello</b>' }).content).toBe('hello');
  expect(service.send(ALICE, 'sock-alice', { roomId: room.roomId, content: '<script>alert(1)</script>hi' }).content).toBe('hi');
  expect(service.send(ALICE, 'sock-alice', { roomId: room.roomId, content: 'Tom & Jerry' }).content).toBe('Tom &amp; Jerry');
});

test('CHAT-14: a failed ID allocation is a defect, never a partial message', () => {
  const rooms = new RoomStore();
  const room = rooms.create(ALICE, { name: 'General' });
  rooms.join(ALICE, 'sock-alice', { roomId: room.roomId });
  const service = new MessageService({ rooms, newId: () => null });
  // The shared failure() helper maps a non-AppError to INTERNAL_ERROR; the envelope itself is
  // asserted over the transport in tests/integration/messaging.test.js.
  expect(() => service.send(ALICE, 'sock-alice', { roomId: room.roomId, content: 'hi' }))
    .toThrow('Message ID allocation failed');
});

test('CHAT-15: a broadcast failure returns a safe error without escaping or acknowledging success', () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { service, payload } = setup();
  const handlers = {};
  const socket = {
    id: 'sock-alice', data: { identity: ALICE },
    on: (event, handler) => { handlers[event] = handler; }
  };
  const io = { to: () => ({ emit: () => { throw new Error('private adapter detail'); } }) };
  const respond = jest.fn();
  registerMessageHandlers(socket, service, io);
  expect(() => handlers['message:send'](payload, respond)).not.toThrow();
  expect(respond).toHaveBeenCalledTimes(1);
  expect(respond).toHaveBeenCalledWith({
    ok: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' }
  });
  expect(warning).toHaveBeenCalledWith(JSON.stringify({ event: 'message-send', code: 'INTERNAL_ERROR' }));
  expect(JSON.stringify(warning.mock.calls)).not.toContain('private adapter detail');
  warning.mockRestore();
});
