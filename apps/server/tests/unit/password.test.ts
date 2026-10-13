import { hashPassword, verifyPassword } from '../../src/lib/password';

describe('password hashing', () => {
  it('stores a bcrypt hash with cost 10, never the plaintext', async () => {
    const hash = await hashPassword('correct horse battery');

    expect(hash).not.toContain('correct horse battery');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('salts every hash, so equal passwords produce different hashes', async () => {
    const [first, second] = await Promise.all([hashPassword('same-password'), hashPassword('same-password')]);

    expect(first).not.toBe(second);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');

    await expect(verifyPassword('correct horse battery', hash)).resolves.toBe(true);
    await expect(verifyPassword('correct horse batterY', hash)).resolves.toBe(false);
  });
});
