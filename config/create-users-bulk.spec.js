const { MAX_USERS, createInputSchema, normalizeUsers, parseArgs } = require('./create-users-bulk');

describe('bulk user creation CLI', () => {
  const validUser = {
    name: 'Test User',
    email: 'TEST@example.com',
    password: 'Password1!',
  };

  it('normalizes email and derives a username without changing the password', () => {
    expect(normalizeUsers([validUser], 10)).toEqual([
      {
        ...validUser,
        email: 'test@example.com',
        username: 'test',
        emailVerified: true,
      },
    ]);
  });

  it('rejects duplicate identities in the same array', () => {
    expect(() => normalizeUsers([validUser, { ...validUser, name: 'Another User' }], 10)).toThrow(
      'Duplicate email in input',
    );
  });

  it('validates a username derived from the email address', () => {
    expect(() => normalizeUsers([{ ...validUser, email: 'not-allowed@example.com' }], 10)).toThrow(
      '0.username: Invalid username',
    );
  });

  it('enforces the configured password length and batch limit', () => {
    expect(createInputSchema(10).safeParse([{ ...validUser, password: 'short' }]).success).toBe(
      false,
    );
    expect(
      createInputSchema(10).safeParse(Array.from({ length: MAX_USERS + 1 }, () => validUser))
        .success,
    ).toBe(false);
  });

  it('requires an input file and tenant administrator', () => {
    expect(
      parseArgs(['--file=users.json', '--tenant-admin-email=ADMIN@example.com', '--apply']),
    ).toEqual({
      file: 'users.json',
      tenantAdminEmail: 'admin@example.com',
      apply: true,
    });
    expect(() => parseArgs(['--file=users.json'])).toThrow('Missing --tenant-admin-email');
  });
});
