const jwt = require('jsonwebtoken');
const { AppError } = require('./errors');

const ISSUER = 'team15-chat';
const AUDIENCE = 'chat-application';
const validId = value => typeof value === 'string' && value.length > 0 &&
  [...value].length <= 128 && !/\p{Cs}/u.test(value);
function createJwtAuth({ secret, findSession }) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32 || typeof findSession !== 'function') {
    throw new TypeError('JWT configuration requires a secret of at least 32 bytes and a session lookup');
  }
  async function authenticate({ token } = {}) {
    try {
      if (typeof token !== 'string' || token.length > 8192) throw new Error();
      const claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
      const now = Math.floor(Date.now() / 1000);
      if (!validId(claims.sub) || !validId(claims.jti) || !Number.isSafeInteger(claims.iat) ||
          !Number.isSafeInteger(claims.exp) || claims.iat > now || claims.exp <= claims.iat ||
          (claims.nbf !== undefined && !Number.isSafeInteger(claims.nbf))) throw new Error();
      const session = await findSession(claims.jti);
      if (!session || session.sessionId !== claims.jti || session.userId !== claims.sub ||
          !Object.hasOwn(session, 'revokedAt') || session.revokedAt !== null ||
          !Number.isSafeInteger(session.expiresAt)) throw new Error();
      // A lookup may cross either the token expiry or session expiry boundary.
      const checkedAt = Math.floor(Date.now() / 1000);
      if (claims.exp <= checkedAt || session.expiresAt <= checkedAt) throw new Error();
      return { userId: claims.sub, sessionId: claims.jti };
    } catch {
      throw new AppError('UNAUTHORIZED', 'Session is not valid');
    }
  }
  return {
    authenticate,
    async validate({ token, identity } = {}) {
      try {
        const verified = await authenticate({ token });
        return identity?.userId === verified.userId && identity?.sessionId === verified.sessionId;
      } catch { return false; }
    }
  };
}
module.exports = { createJwtAuth, ISSUER, AUDIENCE };
