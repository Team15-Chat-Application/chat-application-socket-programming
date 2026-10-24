const { createServer } = require('node:http');
const { Server } = require('socket.io');
const { AppError, failure } = require('./errors');

const unavailableAuth = {
  async authenticate() { throw new AppError('AUTH_NOT_IMPLEMENTED', 'Authentication module is not connected yet'); },
  async validate() { return false; }
};

function createApplication({ auth = unavailableAuth, registerHandlers = () => {} } = {}) {
  const httpServer = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
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
        next();
      } catch (error) {
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
