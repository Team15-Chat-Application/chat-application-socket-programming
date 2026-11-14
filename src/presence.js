const { roomChannel } = require('./rooms');
const { AppError, failure } = require('./errors');

function createPresenceState() {
  return { typingByRoom: new Map() };
}

function registerPresenceHandlers(io, socket, rooms, usernameFor = id => id.slice(0, 8), state = createPresenceState()) {
  const timers = new Map();
  const last = new Map();
  const activeRooms = new Set();
  const identity = socket.data.identity;
  const userInfo = (userId, status) => ({ userId, username: usernameFor(userId), status });

  function online(roomId) {
    const ids = new Set();
    for (const peer of io.of('/').sockets.values()) {
      if (rooms.hasSocket(roomId, peer.id)) ids.add(peer.data.identity.userId);
    }
    return [...ids].map(id => userInfo(id, 'online'));
  }

  function requireRoom(payload) {
    rooms.get(payload);
    if (!rooms.hasSocket(payload.roomId, socket.id)) {
      throw new AppError('FORBIDDEN', 'Join the room first');
    }
  }

  function emitTyping(roomId, typing) {
    io.to(roomChannel(roomId)).emit('presence:typing', {
      roomId,
      ...userInfo(identity.userId, 'online'),
      typing
    });
  }

  function stopTyping(roomId, { timerExpired = false } = {}) {
    const timer = timers.get(roomId);
    if (timer && !timerExpired) clearTimeout(timer);
    timers.delete(roomId);
    activeRooms.delete(roomId);

    const users = state.typingByRoom.get(roomId);
    const sockets = users?.get(identity.userId);
    if (!sockets?.delete(socket.id)) return;
    if (sockets.size) return;

    users.delete(identity.userId);
    if (!users.size) state.typingByRoom.delete(roomId);
    emitTyping(roomId, false);
  }

  socket.on('presence:list', (payload, ack) => {
    try {
      requireRoom(payload);
      if (typeof ack === 'function') {
        ack({ ok: true, data: { roomId: payload.roomId, users: online(payload.roomId) } });
      }
    } catch (err) {
      if (typeof ack === 'function') ack(failure(err));
    }
  });

  socket.on('typing:set', (payload, ack) => {
    try {
      requireRoom(payload);
      if (typeof payload.typing !== 'boolean') {
        throw new AppError('VALIDATION_ERROR', 'typing must be boolean');
      }

      const now = Date.now();
      const roomId = payload.roomId;
      if (payload.typing && now - (last.get(roomId) || 0) < 500) {
        if (typeof ack === 'function') ack({ ok: true, data: { debounced: true } });
        return;
      }
      last.set(roomId, now);

      if (!payload.typing) {
        stopTyping(roomId);
      } else {
        let users = state.typingByRoom.get(roomId);
        if (!users) {
          users = new Map();
          state.typingByRoom.set(roomId, users);
        }
        let sockets = users.get(identity.userId);
        if (!sockets) {
          sockets = new Set();
          users.set(identity.userId, sockets);
        }
        const firstTypingSocket = sockets.size === 0;
        sockets.add(socket.id);
        activeRooms.add(roomId);
        if (firstTypingSocket) emitTyping(roomId, true);

        clearTimeout(timers.get(roomId));
        const timer = setTimeout(() => {
          if (timers.get(roomId) !== timer) return;
          stopTyping(roomId, { timerExpired: true });
        }, 1500);
        timer.unref();
        timers.set(roomId, timer);
      }

      if (typeof ack === 'function') ack({ ok: true, data: { accepted: true } });
    } catch (err) {
      if (typeof ack === 'function') ack(failure(err));
    }
  });

  // Leaving a room is also the end of this socket's typing activity there. The
  // room handler serializes the leave itself; this listener only clears presence.
  socket.on('room:leave', payload => {
    if (typeof payload?.roomId === 'string' && activeRooms.has(payload.roomId)) {
      stopTyping(payload.roomId);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId of [...activeRooms]) stopTyping(roomId);
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });
}

module.exports = { createPresenceState, registerPresenceHandlers };
