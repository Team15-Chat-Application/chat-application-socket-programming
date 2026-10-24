const { hashPassword, verifyPassword, DEFAULT_COST } = require('../../src/passwords');

test('TC-Sec-02: default cost is 12; passwords verify and wrong passwords fail', async () => {
  const password = 'fixture-password-🔐';
  const hash = await hashPassword(password);
  expect(DEFAULT_COST).toBe(12);
  expect(hash).toMatch(/^\$2b\$12\$/);
  expect(hash).not.toContain(password);
  expect(await verifyPassword(password, hash)).toBe(true);
  expect(await verifyPassword('wrong-password', hash)).toBe(false);
});
test('minimum cost 10 uses a fresh random salt for each hash', async () => {
  const first = await hashPassword('fixture-password', { cost: 10 });
  const second = await hashPassword('fixture-password', { cost: 10 });
  expect(first).toMatch(/^\$2b\$10\$/);
  expect(first).not.toBe(second);
  expect(await verifyPassword('fixture-password', second)).toBe(true);
});
test.each([null, 123, '', 'a'.repeat(73), '😀'.repeat(19), '\ud800'])(
  'rejects invalid or over-72-byte passwords without echoing input %#', async password => {
    const expected = { code: 'VALIDATION_ERROR', message: 'password must contain 1 to 72 UTF-8 bytes' };
    await expect(hashPassword(password)).rejects.toMatchObject(expected);
    await expect(verifyPassword(password, 'not-a-hash')).rejects.toMatchObject(expected);
  }
);
test.each([9, 15, 10.5, '10', true])('rejects unsupported cost %s', async cost => {
  await expect(hashPassword('fixture-password', { cost })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
test.each(['a'.repeat(72), '😀'.repeat(18), 'prefix\u0000suffix'])(
  'preserves accepted byte boundaries and NUL suffixes %#', async password => {
    const hash = await hashPassword(password, { cost: 10 });
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('prefix', hash)).toBe(false);
  }
);
test.each([null, 123, '', 'plaintext', '$2b$09$' + 'a'.repeat(53), '$2b$31$' + 'a'.repeat(53)])(
  'fails closed on malformed, plaintext or unsupported stored hashes %#', async hash => {
    expect(await verifyPassword('fixture-password', hash)).toBe(false);
  }
);
test('hashing and verification do not log plaintext', async () => {
  const spies = ['log', 'error', 'warn'].map(method => jest.spyOn(console, method).mockImplementation(() => {}));
  try {
    const hash = await hashPassword('fixture-log-secret', { cost: 10 });
    await verifyPassword('fixture-log-secret', hash);
    await verifyPassword('wrong-log-secret', hash);
    spies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  } finally { spies.forEach(spy => spy.mockRestore()); }
});
test('native hashing failures expose a generic error without credentials', async () => {
  const spy = jest.spyOn(require('bcrypt'), 'hash').mockRejectedValue(new Error('fixture-secret'));
  try {
    await expect(hashPassword('fixture-secret')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR', message: 'Password hashing failed'
    });
  } finally { spy.mockRestore(); }
});
