import mongoose from 'mongoose';
import request from 'supertest';
import { createTestApp } from '../helpers/app';
import { connectToDatabase } from '../../src/db/connection';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

describe('GET /api/health', () => {
  const app = createTestApp();
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 120_000);

  afterEach(async () => {
    await mongoose.disconnect();
  });

  afterAll(async () => {
    await db.stop();
  });

  it('responds 200 when the database is connected', async () => {
    await connectToDatabase(db.uri);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: 'ok', database: 'connected', uptime: expect.any(Number) });
  });

  it('responds 503 without internal details when the database is disconnected', async () => {
    await connectToDatabase(db.uri);
    await mongoose.disconnect();

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'unavailable',
      database: 'disconnected',
      uptime: expect.any(Number),
    });
  });

  it('does not advertise the framework', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
