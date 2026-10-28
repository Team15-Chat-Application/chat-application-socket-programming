
const { createDatabase } = require('../../src/database');
const bcrypt = require('bcrypt');
const {
  createAuthService,
  LOCKOUT_SECONDS
} = require('../../src/auth');

const SECRET =
  'test-only-signing-key-with-at-least-32-bytes-never-use-in-production';

describe('Authentication account lockout', () => {
  let database;
  let auth;
  let now;

  beforeEach(async () => {
    database = createDatabase(':memory:');
    now = 1_800_000_000_000;

    auth = createAuthService({
      database,
      secret: SECRET,
      clock: () => now
    });

    await auth.register({
      username: 'lockout_test',
      password: 'ValidTestPassword_2026!'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    database.close();
  });

  test('locks after five failed attempts and unlocks after 15 minutes', async () => {
    const credentials = {
      username: 'lockout_test',
      password: 'ValidTestPassword_2026!'
    };

    for (let attempt = 1; attempt <= 4; attempt++) {
      await expect(
        auth.login({
          username: credentials.username,
          password: 'WrongPassword_123!'
        })
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    }

    await expect(
      auth.login({
        username: credentials.username,
        password: 'WrongPassword_123!'
      })
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });

    await expect(auth.login(credentials))
      .rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });

    now += LOCKOUT_SECONDS * 1000;

    const result = await auth.login(credentials);

    expect(result.token).toEqual(expect.any(String));
    expect(result.user.username).toBe('lockout_test');
  });

  test('concurrent failures after an expired lock do not overwrite the new failure count', async () => {
    const user = database.findUserByUsername('lockout_test');
    database.recordFailedLogin(user.userId, 5, Math.floor(now / 1000) - 1);
    let finishFirst;
    jest.spyOn(bcrypt, 'compare')
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockResolvedValue(false);
    const first = auth.login({ username: user.username, password: 'wrong' }).catch(error => error);
    for (let i = 0; i < 4; i++) {
      await expect(auth.login({ username: user.username, password: 'wrong' }))
        .rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    }
    finishFirst(false);
    expect((await first).code).toBe('ACCOUNT_LOCKED');
    expect(database.findUserByUsername(user.username).failedAttempts).toBe(5);
  });

  test('a successful password comparison cannot clear a lock set while it was pending', async () => {
    const user = database.findUserByUsername('lockout_test');
    database.recordFailedLogin(user.userId, 4, null);
    let finishValid;
    jest.spyOn(bcrypt, 'compare')
      .mockImplementationOnce(() => new Promise(resolve => { finishValid = resolve; }))
      .mockResolvedValue(false);
    const pending = auth.login({ username: user.username, password: 'valid' }).catch(error => error);
    await expect(auth.login({ username: user.username, password: 'wrong' }))
      .rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    finishValid(true);
    expect((await pending).code).toBe('ACCOUNT_LOCKED');
    expect(database.findUserByUsername(user.username).failedAttempts).toBe(5);
  });
});
