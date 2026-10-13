import express from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { errorHandler } from '../../src/middleware/errors';

const ALLOWED = 'https://memed-payout-tracker-livid.vercel.app';

describe('error responses', () => {
  const app = createApp({ corsOrigins: [ALLOWED] });

  it('returns a JSON 404 for an unknown path, readable cross-origin', async () => {
    const res = await request(app).get('/api/nope').set('Origin', ALLOWED);

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'No route for GET /api/nope' },
    });
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('returns a JSON 404 for an unsupported method on an existing path', async () => {
    const res = await request(app).delete('/api/health');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON with 400 INVALID_JSON and no parser internals', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"views": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
    });
    expect(res.text).not.toMatch(/SyntaxError|at JSON\.parse|node_modules/);
  });

  it('rejects a body over the 10kb limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(11 * 1024) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('hides unexpected errors behind a generic 500 and logs them server-side', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failing = express()
      .get('/boom', () => {
        throw new Error('db password is hunter2');
      })
      .use(errorHandler);

    const res = await request(failing).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(res.text).not.toContain('hunter2');
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: 'db password is hunter2' }));
    consoleError.mockRestore();
  });

  it('forwards rejected async handlers to the error handler (Express 5)', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failing = express()
      .get('/async-boom', async () => {
        await Promise.resolve();
        throw new Error('async failure');
      })
      .use(errorHandler);

    const res = await request(failing).get('/async-boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: 'async failure' }));
    consoleError.mockRestore();
  });
});
