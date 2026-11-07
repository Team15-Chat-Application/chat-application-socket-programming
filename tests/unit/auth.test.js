
const { createDatabase } = require('../../src/database');
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
});
