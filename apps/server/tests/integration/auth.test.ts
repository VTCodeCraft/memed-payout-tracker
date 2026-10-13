import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';
import { connectToDatabase } from '../../src/db/connection';
import { User } from '../../src/models/user.model';
import { TEST_JWT, createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

const app = createTestApp();
const brand = { name: 'Acme Snacks', email: 'brand@acme.test', password: 'correct horse', role: 'brand' };

const signup = (body: object) => request(app).post('/api/auth/signup').send(body);
const login = (body: object) => request(app).post('/api/auth/login').send(body);

describe('auth endpoints', () => {
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

  describe('POST /api/auth/signup', () => {
    it('creates the account and returns a token plus the public user', async () => {
      const res = await signup({ ...brand, email: ' Brand@ACME.test ' });

      expect(res.status).toBe(201);
      expect(res.body.user).toEqual({
        id: expect.any(String),
        name: 'Acme Snacks',
        email: 'brand@acme.test',
        role: 'brand',
        createdAt: expect.any(String),
      });
      expect(jwt.verify(res.body.token, TEST_JWT.secret)).toMatchObject({ sub: res.body.user.id, role: 'brand' });
      expect(res.text).not.toMatch(/passwordHash|correct horse|\$2b\$/);
    });

    it('stores a bcrypt hash, never the plaintext password', async () => {
      await signup(brand);

      const stored = await User.findOne({ email: brand.email }).select('+passwordHash');
      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(stored?.passwordHash).not.toContain(brand.password);
    });

    it('returns 409 EMAIL_TAKEN for an email that already exists, in any casing', async () => {
      await signup(brand);

      const res = await signup({ ...brand, email: 'BRAND@acme.test', role: 'creator' });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
      });
      expect(await User.countDocuments()).toBe(1);
    });

    it('lets exactly one of several simultaneous signups with the same email succeed', async () => {
      const responses = await Promise.all(Array.from({ length: 5 }, () => signup(brand)));

      expect(responses.map((res) => res.status).sort()).toEqual([201, 409, 409, 409, 409]);
      expect(await User.countDocuments()).toBe(1);
    });

    it('rejects invalid input with 400 VALIDATION_ERROR and per-field details', async () => {
      const res = await signup({ name: 'A', email: 'not-an-email', password: 'short', role: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
        'email',
        'name',
        'password',
        'role',
      ]);
      expect(await User.countDocuments()).toBe(0);
    });

    it('rejects a request without a JSON body', async () => {
      const res = await request(app).post('/api/auth/signup');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await signup(brand);
    });

    it('returns a token and the public user for correct credentials', async () => {
      const res = await login({ email: brand.email, password: brand.password });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: 'brand@acme.test', role: 'brand' });
      expect(jwt.verify(res.body.token, TEST_JWT.secret)).toMatchObject({ sub: res.body.user.id, role: 'brand' });
      expect(res.text).not.toMatch(/passwordHash|\$2b\$/);
    });

    it('matches the email case-insensitively', async () => {
      const res = await login({ email: 'BRAND@Acme.Test', password: brand.password });

      expect(res.status).toBe(200);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await login({ email: brand.email, password: 'wrong password' });
      const unknownEmail = await login({ email: 'nobody@acme.test', password: brand.password });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('rejects a missing password with 400 VALIDATION_ERROR', async () => {
      const res = await login({ email: brand.email });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ path: 'password', message: 'is required' }]);
    });
  });
});
