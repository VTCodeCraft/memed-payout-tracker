import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { signAccessToken } from '../../src/lib/jwt';
import { getAuthUser, requireAuth, requireRole } from '../../src/middleware/auth';
import { errorHandler } from '../../src/middleware/errors';
import { TEST_JWT } from '../helpers/app';

const { secret } = TEST_JWT;

const app = express()
  .get('/private', requireAuth(secret), (req, res) => {
    res.json(getAuthUser(req));
  })
  .get('/brand-only', requireAuth(secret), requireRole('brand'), (_req, res) => {
    res.json({ ok: true });
  })
  .get('/missing-require-auth', requireRole('brand'), (_req, res) => {
    res.json({ ok: true });
  })
  .use(errorHandler);

const tokenFor = (role: 'brand' | 'creator', id = 'user-123') => signAccessToken({ id, role }, TEST_JWT);
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('requireAuth', () => {
  it('sets the authenticated user from a valid Bearer token', async () => {
    const res = await request(app).get('/private').set('Authorization', `Bearer ${tokenFor('creator')}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'user-123', role: 'creator' });
  });

  it('accepts the Bearer scheme in any letter case', async () => {
    const res = await request(app).get('/private').set('Authorization', `bearer ${tokenFor('brand')}`);

    expect(res.status).toBe(200);
  });

  it.each([
    ['no Authorization header', undefined],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['an empty Bearer value', 'Bearer '],
  ])('returns 401 UNAUTHENTICATED for %s', async (_label, header) => {
    const req = request(app).get('/private');
    const res = await (header === undefined ? req : req.set('Authorization', header));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
  });

  it('returns 401 TOKEN_EXPIRED for an expired token', async () => {
    const expired = jwt.sign({ role: 'brand', exp: Math.floor(Date.now() / 1000) - 60 }, secret, {
      subject: 'user-123',
    });

    const res = await request(app).get('/private').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it.each([
    ['a malformed token', 'not.a.jwt'],
    ['a token signed with another secret', jwt.sign({ role: 'brand' }, 'another-secret-that-is-long-enough!!', { subject: 'u' })],
    ['a token signed with another algorithm', jwt.sign({ role: 'brand' }, secret, { subject: 'u', algorithm: 'HS512' })],
    ['an unsigned alg:none token', `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: 'u', role: 'brand' })}.`],
    ['a token with an unknown role', jwt.sign({ role: 'admin' }, secret, { subject: 'u' })],
    ['a token without a subject', jwt.sign({ role: 'brand' }, secret)],
  ])('returns 401 INVALID_TOKEN for %s', async (_label, token) => {
    const res = await request(app).get('/private').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' } });
  });

  it('rejects a token whose role claim was tampered with', async () => {
    const [header, , signature] = tokenFor('creator').split('.');
    const tampered = `${header}.${base64url({ sub: 'user-123', role: 'brand' })}.${signature}`;

    const res = await request(app).get('/brand-only').set('Authorization', `Bearer ${tampered}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('requireRole', () => {
  it('allows a user with the required role', async () => {
    const res = await request(app).get('/brand-only').set('Authorization', `Bearer ${tokenFor('brand')}`);

    expect(res.status).toBe(200);
  });

  it('returns 403 FORBIDDEN for an authenticated user with another role', async () => {
    const res = await request(app).get('/brand-only').set('Authorization', `Bearer ${tokenFor('creator')}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: 'This action requires a brand account' } });
  });

  it('fails closed with 401 when mounted without requireAuth', async () => {
    const res = await request(app).get('/missing-require-auth').set('Authorization', `Bearer ${tokenFor('brand')}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
