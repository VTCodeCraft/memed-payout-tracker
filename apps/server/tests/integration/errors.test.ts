import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createTestApp } from '../helpers/app';
import { AppError } from '../../src/lib/app-error';
import { errorHandler } from '../../src/middleware/errors';

const ALLOWED = 'https://memed-payout-tracker-livid.vercel.app';

describe('error responses', () => {
  const app = createTestApp({ corsOrigins: [ALLOWED] });

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

  it('turns an AppError into its status and code without logging it as a failure', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const conflicting = express()
      .post('/thing', () => {
        throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      })
      .use(errorHandler);

    const res = await request(conflicting).post('/thing');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('turns a zod validation failure into 400 VALIDATION_ERROR with per-field details', async () => {
    const schema = z.object({ email: z.email('must be a valid email address'), age: z.number() });
    const validating = express()
      .use(express.json())
      .post('/thing', (req) => {
        schema.parse(req.body);
      })
      .use(errorHandler);

    const res = await request(validating).post('/thing').send({ email: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          { path: 'email', message: 'must be a valid email address' },
          { path: 'age', message: 'Invalid input: expected number, received undefined' },
        ],
      },
    });
  });
});
