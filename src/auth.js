
const { ISSUER, AUDIENCE, createJwtAuth } = require('./jwt-auth');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { AppError } = require('./errors');
const { hashPassword, verifyPassword } = require('./passwords');
const { sanitizeUsername } = require('./input');

const TOKEN_LIFETIME_SECONDS = 60 * 60;
const LOCKOUT_SECONDS = 15 * 60;
const MAX_FAILED_ATTEMPTS = 5;

function createAuthService({ database, secret, clock = () => Date.now() }) {
  if (!database) {
    throw new TypeError('database is required');
  }

  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new TypeError('JWT secret must contain at least 32 UTF-8 bytes');
  }

  function nowSeconds() {
    return Math.floor(clock() / 1000);
  }

  function publicUser(user) {
    return {
      userId: user.userId,
      username: user.username,
      role: user.role
    };
  }

  async function register({ username, password } = {}) {
    const validUsername = sanitizeUsername(username);

    if (typeof password !== 'string' || password.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'password is required');
    }

    const passwordHash = await hashPassword(password);

    try {
      database.createUser({
        userId: randomUUID(),
        username: validUsername,
        passwordHash
      });
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new AppError('CONFLICT', 'Username is already taken');
      }
      throw new AppError('INTERNAL_ERROR', 'Could not create account');
    }

    return publicUser(database.findUserByUsername(validUsername));
  }

  async function login({ username, password } = {}) {
    let validUsername;

    try {
      validUsername = sanitizeUsername(username);
    } catch {
      throw new AppError('UNAUTHORIZED', 'Invalid username or password');
    }

    if (typeof password !== 'string' || password.length === 0) {
      throw new AppError('UNAUTHORIZED', 'Invalid username or password');
    }

    const user = database.findUserByUsername(validUsername);

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'Invalid username or password');
    }

    const now = nowSeconds();

    if (user.lockedUntil != null && user.lockedUntil > now) {
      throw new AppError('ACCOUNT_LOCKED', 'Account is temporarily locked');
    }

    if (user.lockedUntil != null && user.lockedUntil <= now) {
      database.resetFailedLogins(user.userId);
    }

    const passwordIsValid = await verifyPassword(password, user.passwordHash);

    if (!passwordIsValid) {
      const attempts = user.lockedUntil != null && user.lockedUntil <= now
        ? 1
        : user.failedAttempts + 1;

      const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
        ? now + LOCKOUT_SECONDS
        : null;

      database.recordFailedLogin(user.userId, attempts, lockedUntil);

      if (lockedUntil !== null) {
        throw new AppError('ACCOUNT_LOCKED', 'Account is temporarily locked');
      }

      throw new AppError('UNAUTHORIZED', 'Invalid username or password');
    }

    database.resetFailedLogins(user.userId);

    const sessionId = randomUUID();
    const issuedAt = nowSeconds();
    const expiresAt = issuedAt + TOKEN_LIFETIME_SECONDS;

    database.createSession({ sessionId, userId: user.userId, expiresAt });

    const token = jwt.sign(
      { sub: user.userId, jti: sessionId, iat: issuedAt, exp: expiresAt },
      secret,
      { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE }
    );

    return { token, expiresAt, user: publicUser(user) };
  }

  async function logout({ token } = {}) {
    const auth = getJwtAuth();
    const identity = await auth.authenticate({ token });
    const changed = database.revokeSession(identity.sessionId, nowSeconds());

    if (changed !== 1) {
      throw new AppError('UNAUTHORIZED', 'Session is not valid');
    }
  }

  function getJwtAuth() {
    return createJwtAuth({
      secret,
      findSession: sessionId => database.findSession(sessionId)
    });
  }

  return {
    register,
    login,
    logout,
    getJwtAuth
  };
}

module.exports = {
  createAuthService,
  TOKEN_LIFETIME_SECONDS,
  LOCKOUT_SECONDS,
  MAX_FAILED_ATTEMPTS
};
