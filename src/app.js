const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { AppError, failure } = require('./errors');
const { RoomStore, registerRoomHandlers } = require('./rooms');
const { LoginLimiter } = require('./login-limit');
const { audit } = require('./audit');

const unavailableAuth = {
  async authenticate() { throw new AppError('AUTH_NOT_IMPLEMENTED', 'Authentication module is not connected yet'); },
  async validate() { return false; }
};

function createApplication({ auth = unavailableAuth, registerHandlers = () => {}, rooms = new RoomStore(),
  loginLimiter = new LoginLimiter(), loginHandler } = {}) {
  const httpServer = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST' && req.url.split('?')[0] === '/api/auth/login') {
      // Forwarded headers are untrusted until a deployment proxy policy is configured.
      const limit = loginLimiter.consume(req.socket.remoteAddress);
      if (!limit.allowed) {
        audit('login', 'RATE_LIMITED');
        res.statusCode = 429;
        res.setHeader('Retry-After', String(limit.retryAfter));
        res.end(JSON.stringify(failure(new AppError('RATE_LIMITED', 'Too many login attempts'))));
        return;
      }
      if (typeof loginHandler === 'function') {
        Promise.resolve().then(() => loginHandler(req, res)).catch(() => {
          audit('login', 'INTERNAL_ERROR');
          if (res.writableEnded) return;
          if (!res.headersSent) res.statusCode = 500;
          res.end(JSON.stringify(failure(new AppError('INTERNAL_ERROR', 'An internal error occurred'))));
        });
        return;
      }
    }
    if (req.method === 'GET' && req.url === '/api/health') {
      res.end(JSON.stringify({ ok: true, data: { status: 'ok', service: 'node', stage: 'development-foundation' } }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify(failure(new AppError('NOT_FOUND', 'Endpoint not found'))));
  });
  const io = new Server(httpServer);
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const identity = await auth.authenticate({ token });
      if (!identity || typeof identity.userId !== 'string' || !identity.userId ||
          typeof identity.sessionId !== 'string' || !identity.sessionId) {
        throw new AppError('UNAUTHORIZED', 'Authentication returned an invalid identity');
      }
      socket.data.identity = Object.freeze({ userId: identity.userId, sessionId: identity.sessionId });
      socket.data.token = token;
      next();
    } catch (error) {
      const response = failure(error);
      audit('socket-connect', response.error.code);
      const denied = new Error(response.error.message);
      denied.data = response.error;
      next(denied);
    }
  });
  io.on('connection', socket => {
    socket.use(async (_packet, next) => {
      try {
        const valid = await auth.validate({ token: socket.data.token, identity: socket.data.identity });
        if (valid !== true) throw new AppError('UNAUTHORIZED', 'Session is no longer valid');
        // This runs after validation; onAny would run before packet middleware.
        if (socket.listenerCount(_packet[0]) === 0) {
          const respond = _packet[_packet.length - 1];
          if (typeof respond === 'function') respond(failure(new AppError('NOT_FOUND', 'Event not found')));
          return;
        }
        next();
      } catch (error) {
        audit('socket-event', failure(error).error.code);
        socket.emit('system:error', failure(error));
        socket.disconnect(true);
        next(new Error('Event rejected'));
      }
    });
    socket.on('error', () => {}); // Packet rejection is already reported using the safe envelope.
    socket.on('system:ping', (payload, acknowledge) => {
      if (typeof acknowledge !== 'function') return;
      if (!payload || typeof payload.nonce !== 'string' || !payload.nonce || payload.nonce.length > 64) {
        acknowledge(failure(new AppError('VALIDATION_ERROR', 'nonce must contain 1 to 64 characters')));
        return;
      }
      acknowledge({ ok: true, data: { nonce: payload.nonce } });
    });
    registerRoomHandlers(socket, rooms, io, () => auth.validate({ token: socket.data.token, identity: socket.data.identity }));
    registerHandlers(io, socket);
  });
  return {
    io, httpServer,
    async start(port = 3000, host = '127.0.0.1') {
      await new Promise((resolve, reject) => {
        const onError = error => reject(error);
        httpServer.once('error', onError);
        httpServer.listen(port, host, () => { httpServer.off('error', onError); resolve(); });
      });
      return httpServer.address();
    },
    async stop() { await new Promise(resolve => io.close(resolve)); }
  };
}
module.exports = { createApplication };
