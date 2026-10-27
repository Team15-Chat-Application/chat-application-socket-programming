
const { readConfig } = require('./config');
const { createApplication } = require('./app');
const { RoomStore } = require('./rooms');
const { MessageService, registerMessageHandlers } = require('./messages');
const { createDatabase } = require('./database');
const { createAuthService } = require('./auth');
const { AppError, failure } = require('./errors');

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 10_000) {
        reject(new AppError('VALIDATION_ERROR', 'Request body is too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new AppError('VALIDATION_ERROR', 'Invalid JSON'));
      }
    });

    req.on('error', reject);
  });
}

function sendError(res, error) {
  if (res.writableEnded) return;

  const isExpected = error instanceof AppError;
  const statusByCode = {
    UNAUTHORIZED: 401,
    ACCOUNT_LOCKED: 423,
    VALIDATION_ERROR: 400,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    AUTH_NOT_IMPLEMENTED: 503
  };

  if (res.headersSent) {
    res.destroy();
    return;
  }

  res.statusCode = isExpected
    ? (statusByCode[error.code] || 400)
    : 500;

  const responseError = isExpected
    ? error
    : new AppError('INTERNAL_ERROR', 'An internal error occurred');

  res.end(JSON.stringify(failure(responseError)));
}

function bearerToken(req) {
  const header = req.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }

  return header.slice(7);
}

async function main() {
  const config = readConfig();
  const rooms = new RoomStore();
  const messages = new MessageService({ rooms });

  const database = createDatabase();
  const secret = process.env.JWT_SECRET;
  let authService = null;

  if (typeof secret === 'string' && Buffer.byteLength(secret, 'utf8') >= 32) {
    authService = createAuthService({ database, secret });
  } else {
    console.warn(
      'JWT_SECRET is missing or too short. Authentication routes are unavailable.'
    );
  }

  const auth = authService
    ? authService.getJwtAuth()
    : undefined;

  const app = createApplication({
    auth,
    rooms,
    registerHandlers: (io, socket) =>
      registerMessageHandlers(socket, messages, io),

    registerHandler: async (req, res) => {
      if (!authService) {
        res.statusCode = 503;
        res.end(JSON.stringify({
          ok: false,
          error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured' }
        }));
        return;
      }

      try {
        const result = await authService.register(await readRequestBody(req));
        res.statusCode = 201;
        res.end(JSON.stringify({ user: result }));
      } catch (error) {
        sendError(res, error);
      }
    },

    loginHandler: async (req, res) => {
      if (!authService) {
        res.statusCode = 503;
        res.end(JSON.stringify({
          ok: false,
          error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured' }
        }));
        return;
      }

      try {
        const result = await authService.login(await readRequestBody(req));
        res.statusCode = 200;
        res.end(JSON.stringify(result));
      } catch (error) {
        sendError(res, error);
      }
    },

    logoutHandler: async (req, res) => {
      if (!authService) {
        res.statusCode = 503;
        res.end(JSON.stringify({
          ok: false,
          error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured' }
        }));
        return;
      }

      try {
        await authService.logout({ token: bearerToken(req) });
        res.statusCode = 204;
        res.end();
      } catch (error) {
        sendError(res, error);
      }
    }
  });

  const address = await app.start(config.port, config.host);

  console.log(
    `Node development server: http://${config.host}:${address.port}/api/health`
  );
  console.log(
    authService
      ? 'Authentication routes and messaging handlers are registered.'
      : 'Authentication is not configured; protected access remains denied.'
  );

  let stopping = false;

  const stop = async () => {
    if (stopping) return;
    stopping = true;

    try {
      await app.stop();
    } finally {
      database.close();
    }
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
