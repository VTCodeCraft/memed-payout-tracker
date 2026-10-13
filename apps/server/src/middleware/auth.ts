import type { Request, RequestHandler } from 'express';
import { AppError } from '../lib/app-error';
import { type AuthUser, verifyAccessToken } from '../lib/jwt';
import type { Role } from '../models/user.model';

// "Bearer <token>"; the scheme name is case-insensitive per RFC 7235.
const BEARER_TOKEN = /^Bearer\s+(\S+)$/i;

/** Rejects requests without a valid access token and sets req.user. */
export function requireAuth(jwtSecret: string): RequestHandler {
  return (req, _res, next) => {
    const token = BEARER_TOKEN.exec(req.get('authorization') ?? '')?.[1];
    if (!token) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    req.user = verifyAccessToken(token, jwtSecret);
    next();
  };
}

/** Allows only the given roles. Must run after requireAuth. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const { role } = getAuthUser(req);
    if (!roles.includes(role)) {
      throw new AppError(403, 'FORBIDDEN', `This action requires a ${roles.join(' or ')} account`);
    }
    next();
  };
}

/** The authenticated user. Fails closed with 401 if requireAuth did not run. */
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  return req.user;
}
