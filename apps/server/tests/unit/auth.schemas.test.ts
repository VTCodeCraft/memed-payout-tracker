import { loginSchema, signupSchema } from '../../src/modules/auth/auth.schemas';

const valid = { name: 'Acme Snacks', email: 'brand@acme.test', password: 'correct horse', role: 'brand' };

/** Maps each failing field to its message, e.g. { email: 'must be a valid email address' }. */
function fieldErrors(schema: typeof signupSchema | typeof loginSchema, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
}

describe('signupSchema', () => {
  it('normalises email and name but leaves the password untouched', () => {
    expect(
      signupSchema.parse({ ...valid, name: '  Acme Snacks ', email: ' Brand@ACME.test ', password: ' spaced pass ' }),
    ).toEqual({ name: 'Acme Snacks', email: 'brand@acme.test', password: ' spaced pass ', role: 'brand' });
  });

  it('accepts the creator role', () => {
    expect(signupSchema.parse({ ...valid, role: 'creator' }).role).toBe('creator');
  });

  it.each(['not-an-email', 'a@b', 'brand@', '@acme.test', 'brand acme@test.com'])(
    'rejects malformed email %p',
    (email) => {
      expect(fieldErrors(signupSchema, { ...valid, email })).toEqual({ email: 'must be a valid email address' });
    },
  );

  it.each(['admin', 'Brand', ''])('rejects role %p', (role) => {
    expect(fieldErrors(signupSchema, { ...valid, role })).toEqual({ role: 'must be "brand" or "creator"' });
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(fieldErrors(signupSchema, { ...valid, password: 'short7!' })).toEqual({
      password: 'must be at least 8 characters',
    });
  });

  it('rejects passwords over 72 bytes, counting multi-byte characters', () => {
    // 37 characters but 74 bytes: bcrypt would silently drop the tail.
    expect(fieldErrors(signupSchema, { ...valid, password: 'é'.repeat(37) })).toEqual({
      password: 'must be at most 72 bytes',
    });
    expect(signupSchema.safeParse({ ...valid, password: 'a'.repeat(72) }).success).toBe(true);
  });

  it('rejects a name that is too short after trimming', () => {
    expect(fieldErrors(signupSchema, { ...valid, name: ' A ' })).toEqual({ name: 'must be at least 2 characters' });
  });

  it('reports every missing field as required', () => {
    expect(fieldErrors(signupSchema, {})).toEqual({
      name: 'is required',
      email: 'is required',
      password: 'is required',
      role: 'must be "brand" or "creator"',
    });
  });
});

describe('loginSchema', () => {
  it('normalises the email', () => {
    expect(loginSchema.parse({ email: ' Brand@ACME.test', password: 'x' })).toEqual({
      email: 'brand@acme.test',
      password: 'x',
    });
  });

  it('requires an email and a non-empty password, without signup password rules', () => {
    expect(fieldErrors(loginSchema, { email: 'brand@acme.test', password: '' })).toEqual({ password: 'is required' });
    expect(fieldErrors(loginSchema, { password: 'x' })).toEqual({ email: 'is required' });
  });
});
