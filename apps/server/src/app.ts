import cors from 'cors';
import express, { type Express } from 'express';
import { type LiveCampaignsCache, noLiveCampaignsCache } from './cache/live-campaigns-cache';
import type { JwtConfig } from './lib/jwt';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { DEFAULT_RATE_LIMITS, type RateLimits, createRateLimiter } from './middleware/rate-limit';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createCampaignsRouter } from './modules/campaigns/campaigns.routes';
import { healthRouter } from './modules/health/health.routes';
import { createSubmissionsRouter } from './modules/submissions/submissions.routes';

export interface AppOptions {
  /** Browser origins allowed to read API responses (exact scheme://host[:port]). */
  corsOrigins: string[];
  jwt: JwtConfig;
  /** Per-client request limits; production defaults unless a test overrides them. */
  rateLimits?: RateLimits;
  /** Cache for the creators' live campaign list; none unless Redis is configured. */
  liveCampaignsCache?: LiveCampaignsCache;
}

/**
 * Builds the Express application without binding a port,
 * so tests can exercise it in-process via supertest.
 */
export function createApp({
  corsOrigins,
  jwt,
  rateLimits = DEFAULT_RATE_LIMITS,
  liveCampaignsCache = noLiveCampaignsCache,
}: AppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  // Unlisted origins get no Access-Control-Allow-Origin header, so browsers block
  // the response. Requests without an Origin header (health checks, curl) pass through.
  app.use(cors({ origin: corsOrigins, maxAge: 600 }));
  app.use(express.json({ limit: '10kb' }));

  app.use('/api', healthRouter);
  app.use('/api/auth', createAuthRouter(jwt, createRateLimiter(rateLimits.auth)));
  app.use('/api/campaigns', createCampaignsRouter(jwt.secret, liveCampaignsCache));
  app.use(
    '/api/submissions',
    createSubmissionsRouter(jwt.secret, createRateLimiter(rateLimits.viewUpdates), liveCampaignsCache),
  );

  // Registered last: anything unmatched is a 404, and every error becomes JSON.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
