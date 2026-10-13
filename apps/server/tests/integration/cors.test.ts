import request from 'supertest';
import { createApp } from '../../src/app';

const ALLOWED = 'https://memed-payout-tracker-livid.vercel.app';
const BLOCKED = 'https://evil.example.com';

describe('CORS policy', () => {
  const app = createApp({ corsOrigins: [ALLOWED, 'http://localhost:3001'] });

  it('echoes an allowed origin so the browser can read the response', async () => {
    const res = await request(app).get('/api/health').set('Origin', ALLOWED);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['vary']).toMatch(/Origin/);
  });

  it('omits the allow-origin header for an unlisted origin', async () => {
    const res = await request(app).get('/api/health').set('Origin', BLOCKED);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never sends a wildcard or credentials header', async () => {
    const res = await request(app).get('/api/health').set('Origin', ALLOWED);

    expect(res.headers['access-control-allow-origin']).not.toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('approves a PATCH preflight from an allowed origin', async () => {
    const res = await request(app)
      .options('/api/submissions/123/views')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(res.headers['access-control-allow-methods']).toMatch(/PATCH/);
    expect(res.headers['access-control-allow-headers']).toBe('content-type,authorization');
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('does not approve a preflight from an unlisted origin', async () => {
    const res = await request(app)
      .options('/api/submissions/123/views')
      .set('Origin', BLOCKED)
      .set('Access-Control-Request-Method', 'PATCH');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves requests without an Origin header (health checks, server-to-server)', async () => {
    const res = await request(app).get('/api/health');

    // Reached the route handler (its status depends on the database, not on CORS).
    expect(res.body).toHaveProperty('status');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
