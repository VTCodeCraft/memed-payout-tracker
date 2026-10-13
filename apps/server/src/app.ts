import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { healthRouter } from './modules/health/health.routes';

export interface AppOptions {
  /** Browser origins allowed to read API responses (exact scheme://host[:port]). */
  corsOrigins: string[];
}

/**
 * Builds the Express application without binding a port,
 * so tests can exercise it in-process via supertest.
 */
export function createApp({ corsOrigins }: AppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  // Unlisted origins get no Access-Control-Allow-Origin header, so browsers block
  // the response. Requests without an Origin header (health checks, curl) pass through.
  app.use(cors({ origin: corsOrigins, maxAge: 600 }));
  app.use(express.json({ limit: '10kb' }));

  app.use('/api', healthRouter);

  // Registered last: anything unmatched is a 404, and every error becomes JSON.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
