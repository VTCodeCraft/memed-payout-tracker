import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ROLES, type Role } from '../models/user.model';
import { AppError } from './app-error';

export interface JwtConfig {
  secret: string;
  expiresInSeconds: number;
}

/** Identity carried by an access token. */
export interface AuthUser {
  id: string;
  role: Role;
}

// Pinned so a token can never select a different (or no) algorithm.
const ALGORITHM = 'HS256';

/**
 * Signs a short-lived access token. Claims are limited to the user id (`sub`) and
 * role: JWT payloads are readable by anyone, so no personal data goes in them.
 */
export function signAccessToken(user: AuthUser, config: JwtConfig): string {
  return jwt.sign({ role: user.role }, config.secret, {
    algorithm: ALGORITHM,
    subject: user.id,
    expiresIn: config.expiresInSeconds,
  });
}

const claimsSchema = z.object({ sub: z.string().min(1), role: z.enum(ROLES) });

/**
 * Verifies signature, algorithm and expiry, then validates the claims.
 * Every failure becomes a 401: TOKEN_EXPIRED, so clients can prompt a fresh
 * login, or INVALID_TOKEN for anything forged, malformed or tampered with.
 */
export function verifyAccessToken(token: string, secret: string): AuthUser {
  let payload: unknown;
  try {
    payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Session expired, please log in again');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token');
    }
    throw error;
  }

  const claims = claimsSchema.safeParse(payload);
  if (!claims.success) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token');
  }
  return { id: claims.data.sub, role: claims.data.role };
}
