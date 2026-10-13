import request from 'supertest';
import { createApp } from '../../src/app';

describe('GET /api/health', () => {
  it('responds 200 with an ok status', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: 'ok', uptime: expect.any(Number) });
  });

  it('does not advertise the framework', async () => {
    const res = await request(createApp()).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
