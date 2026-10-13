import express, { type Express } from 'express';
import { healthRouter } from './modules/health/health.routes';

/**
 * Builds the Express application without binding a port,
 * so tests can exercise it in-process via supertest.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.use('/api', healthRouter);

  return app;
}
