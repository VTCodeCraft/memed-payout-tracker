import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/app-error';

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimits {
  /** Shared by signup and login: slows password guessing and account spam. */
  auth: RateLimitRule;
  /** The public view-update endpoint, which takes no authentication. */
  viewUpdates: RateLimitRule;
}

export const DEFAULT_RATE_LIMITS: RateLimits = {
  auth: { limit: 20, windowMs: 15 * 60_000 },
  viewUpdates: { limit: 120, windowMs: 60_000 },
};

/**
 * Who is calling. On Render the API is served through Cloudflare, which sets
 * CF-Connecting-IP to the real client address and rejects requests that try to
 * supply it themselves. X-Forwarded-For is never trusted (Express's trust proxy
 * stays off), so without Cloudflare (local development, tests) the socket
 * address is used. IPv6 addresses are grouped by /56 subnet.
 */
function clientKey(req: Request): string {
  return ipKeyGenerator(req.get('cf-connecting-ip') ?? req.ip ?? 'unknown');
}

/** An in-memory, per-process limiter answering 429 RATE_LIMITED in the API's error format. */
export function createRateLimiter({ limit, windowMs }: RateLimitRule): RequestHandler {
  return rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: clientKey,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
    },
    // Forwarded headers are ignored on purpose, so the library's warning about
    // seeing X-Forwarded-For without trust proxy does not apply.
    validate: { xForwardedForHeader: false },
  });
}
