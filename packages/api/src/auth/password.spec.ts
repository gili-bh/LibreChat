import bcrypt from 'bcryptjs';
import { hashPassword } from './password';

describe('hashPassword', () => {
  it('creates a bcrypt hash that accepts only the new password', async () => {
    const hash = await hashPassword('new-password');

    expect(hash).not.toBe('new-password');
    await expect(bcrypt.compare('new-password', hash)).resolves.toBe(true);
    await expect(bcrypt.compare('old-password', hash)).resolves.toBe(false);
  });
});
