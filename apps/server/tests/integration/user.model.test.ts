import mongoose from 'mongoose';
import { connectToDatabase } from '../../src/db/connection';
import { User, toPublicUser } from '../../src/models/user.model';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

const validUser = {
  name: 'Acme Snacks',
  email: 'brand@acme.test',
  passwordHash: '$2b$10$abcdefghijklmnopqrstuuK3c0bNlxKyPAz1Nq5YQWkVQhfDmbxW2',
  role: 'brand' as const,
};

describe('User model', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  afterEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  it('normalises email to trimmed lowercase', async () => {
    const user = await User.create({ ...validUser, email: '  Brand@ACME.test ' });

    expect(user.email).toBe('brand@acme.test');
  });

  it('rejects a second account with the same email in different casing', async () => {
    await User.create(validUser);

    await expect(User.create({ ...validUser, email: 'BRAND@acme.test' })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it('accepts only the brand and creator roles', async () => {
    // Untyped on purpose: simulates unvalidated input the type system would reject.
    const adminUser: Record<string, unknown> = { ...validUser, role: 'admin' };

    await expect(User.create(adminUser)).rejects.toBeInstanceOf(
      mongoose.Error.ValidationError,
    );
    await expect(User.create({ ...validUser, role: 'creator' })).resolves.toBeDefined();
  });

  it('does not allow the role to change after creation', async () => {
    const user = await User.create(validUser);

    user.role = 'creator';
    await user.save();

    expect((await User.findById(user.id))?.role).toBe('brand');
  });

  it('leaves the password hash out of queries unless explicitly selected', async () => {
    await User.create(validUser);

    expect((await User.findOne({ email: validUser.email }))?.passwordHash).toBeUndefined();
    expect(
      (await User.findOne({ email: validUser.email }).select('+passwordHash'))?.passwordHash,
    ).toBe(validUser.passwordHash);
  });

  it('exposes only public fields through toPublicUser', async () => {
    const user = await User.create(validUser);

    expect(toPublicUser(user)).toEqual({
      id: user.id,
      name: 'Acme Snacks',
      email: 'brand@acme.test',
      role: 'brand',
      createdAt: user.createdAt.toISOString(),
    });
    expect(JSON.stringify(toPublicUser(user))).not.toContain('$2b$');
  });
});
