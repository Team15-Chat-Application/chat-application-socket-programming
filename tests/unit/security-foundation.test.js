const jwt = require('jsonwebtoken');
const { createJwtAuth, ISSUER, AUDIENCE } = require('../../src/jwt-auth');
const { LoginLimiter } = require('../../src/login-limit');
const { sanitizePlainText, sanitizeUsername, sanitizeMessage } = require('../../src/input');
const vectors = require('../../contracts/input-vectors.json');
const SECRET = 'test-only-signing-key-with-at-least-32-bytes-never-use-in-production';
const token = (claims = {}, key = SECRET, algorithm = 'HS256') => {
  const payload = { sub: 'alice', jti: 'session', iss: ISSUER, aud: AUDIENCE,
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+600, ...claims };
  for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
  return jwt.sign(payload, key, { algorithm });
};

test('TC-Sec-03: verifies signed identity and fresh session state, including revocation', async () => {
  const session = { userId: 'alice', sessionId: 'session', expiresAt: Math.floor(Date.now()/1000)+600, revokedAt: null };
  const auth = createJwtAuth({ secret: SECRET, findSession: async () => session });
  const context = { token: token(), identity: { userId: 'alice', sessionId: 'session' } };
  expect(await auth.authenticate(context)).toEqual(context.identity);
  expect(await auth.validate(context)).toBe(true);
  expect(await auth.validate({ ...context, identity: { userId: 'mallory', sessionId: 'session' } })).toBe(false);
  session.revokedAt = 1;
  expect(await auth.validate(context)).toBe(false);
});

test.each(['expired', 'wrong-key', 'wrong-algorithm', 'missing-expiry', 'wrong-audience', 'future-iat']) (
  'TC-Sec-03 rejects %s tokens', async kind => {
    const now = Math.floor(Date.now()/1000);
    const session = { userId: 'alice', sessionId: 'session', expiresAt: now+600, revokedAt: null };
    const auth = createJwtAuth({ secret: SECRET, findSession: async () => session });
    const invalid = {
      expired: () => token({ exp: now-1 }),
      'wrong-key': () => token({}, 'different-test-only-key-with-32-bytes'),
      'wrong-algorithm': () => token({}, SECRET, 'HS384'),
      'missing-expiry': () => token({ exp: undefined }),
      'wrong-audience': () => token({ aud: 'other-app' }),
      'future-iat': () => token({ iat: now+60 })
    }[kind]();
    await expect(auth.authenticate({ token: invalid })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Session is not valid' });
  });

test('missing/revoked session records and weak configuration fail closed', async () => {
  expect(() => createJwtAuth({ secret: 'short', findSession() {} })).toThrow(TypeError);
  const auth = createJwtAuth({ secret: SECRET, findSession: async () => null });
  await expect(auth.authenticate({ token: token() })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});

test('TC-Sec-04: sliding window accepts five, rejects sixth, and reopens exactly at 60 seconds', () => {
  let now = 0;
  const limiter = new LoginLimiter({ clock: () => now });
  for (let i=0; i<5; i++) expect(limiter.consume('192.0.2.1').allowed).toBe(true);
  expect(limiter.consume('192.0.2.1')).toEqual({ allowed: false, retryAfter: 60 });
  expect(limiter.consume('192.0.2.2').allowed).toBe(true);
  now = 59999;
  expect(limiter.consume('192.0.2.1')).toEqual({ allowed: false, retryAfter: 1 });
  now = 60000;
  expect(limiter.consume('192.0.2.1').allowed).toBe(true);
});

test('bounded limiter capacity fails closed and expired keys can be reused', () => {
  let now=0;
  const limiter = new LoginLimiter({ clock: () => now, maxKeys: 1 });
  expect(limiter.consume('a').allowed).toBe(true);
  expect(limiter.consume('b').allowed).toBe(false);
  now=60000;
  expect(limiter.consume('b').allowed).toBe(true);
});

test.each(vectors)('TC-Sec-05 shared sanitisation vector $input', ({ input, output }) => {
  expect(sanitizePlainText(input)).toBe(output);
});
test.each([null, {}, '', '<script>x</script>', 'x'.repeat(2001), '\ud800', 'bad\x00'])('rejects unsafe/empty message %#', value => {
  expect(() => sanitizeMessage(value)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
});
test('Unicode message boundaries and strict username validation', () => {
  expect(sanitizeMessage('😀'.repeat(2000))).toBe('😀'.repeat(2000));
  expect(() => sanitizeMessage('😀'.repeat(2001))).toThrow();
  expect(sanitizeUsername('alice_01.test')).toBe('alice_01.test');
  for (const value of ["x' OR 1=1 --", '<b>alice</b>', '$ne', 'alice bob', 'x'.repeat(33)]) {
    expect(() => sanitizeUsername(value)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  }
});
