import request from 'supertest';
import { createTestApp } from '../helpers/app';

// Requests here fail validation (400) or authentication (401) before touching the
// database, which is enough to exercise the limiters in front of them.
const tightLimits = () =>
  createTestApp({ rateLimits: { auth: { limit: 3, windowMs: 60_000 }, viewUpdates: { limit: 2, windowMs: 60_000 } } });

const MALFORMED_VIEWS_URL = '/api/submissions/not-an-id/views';

describe('rate limits', () => {
  it('answers 429 RATE_LIMITED in the standard error format once the auth limit is used', async () => {
    const app = tightLimits();
    for (let i = 0; i < 3; i++) {
      expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    }

    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } });
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.headers['ratelimit']).toBeDefined();
  });

  it('gives signup and login one shared budget', async () => {
    const app = tightLimits();
    await request(app).post('/api/auth/signup').send({});
    await request(app).post('/api/auth/signup').send({});
    await request(app).post('/api/auth/login').send({});

    expect((await request(app).post('/api/auth/login').send({})).status).toBe(429);
    expect((await request(app).post('/api/auth/signup').send({})).status).toBe(429);
  });

  it('does not limit the authenticated /me endpoint', async () => {
    const app = tightLimits();

    for (let i = 0; i < 10; i++) {
      expect((await request(app).get('/api/auth/me')).status).toBe(401);
    }
  });

  it('limits the public view-update endpoint on its own budget', async () => {
    const app = tightLimits();
    for (let i = 0; i < 3; i++) await request(app).post('/api/auth/login').send({}); // auth budget used up

    expect((await request(app).patch(MALFORMED_VIEWS_URL).send({ views: 1 })).status).toBe(400);
    expect((await request(app).patch(MALFORMED_VIEWS_URL).send({ views: 1 })).status).toBe(400);
    const res = await request(app).patch(MALFORMED_VIEWS_URL).send({ views: 1 });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('leaves other routes alone after both limits are exhausted', async () => {
    const app = tightLimits();
    for (let i = 0; i < 4; i++) await request(app).post('/api/auth/login').send({});
    for (let i = 0; i < 3; i++) await request(app).patch(MALFORMED_VIEWS_URL).send({ views: 1 });

    expect((await request(app).get('/api/campaigns/live')).status).toBe(401);
    expect((await request(app).get('/api/submissions/earnings')).status).toBe(401);
    expect((await request(app).get('/api/health')).status).not.toBe(429);
  });

  it('tells clients apart by the Cloudflare client-IP header', async () => {
    const app = tightLimits();
    const fromClientA = () => request(app).post('/api/auth/login').set('CF-Connecting-IP', '203.0.113.10').send({});
    for (let i = 0; i < 3; i++) await fromClientA();

    expect((await fromClientA()).status).toBe(429);
    const fromClientB = await request(app).post('/api/auth/login').set('CF-Connecting-IP', '203.0.113.20').send({});
    expect(fromClientB.status).toBe(400);
  });

  it('ignores X-Forwarded-For, so a forged header does not buy a fresh budget', async () => {
    const app = tightLimits();
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').set('X-Forwarded-For', `198.51.100.${i}`).send({});
    }

    const forged = await request(app).post('/api/auth/login').set('X-Forwarded-For', '198.51.100.99').send({});

    expect(forged.status).toBe(429);
  });
});
