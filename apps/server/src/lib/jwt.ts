import jwt from 'jsonwebtoken';
import type { Role } from '../models/user.model';

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
