import type { Express } from 'express';
import { type AppOptions, createApp } from '../../src/app';
import type { JwtConfig } from '../../src/lib/jwt';

export const TEST_JWT: JwtConfig = {
  secret: 'test-only-secret-0f3c9a7e5b1d4c2a8e6f0b9d7c5a3e1f',
  expiresInSeconds: 3_600,
};

/** createApp with test defaults; pass overrides for what a test cares about. */
export function createTestApp(overrides: Partial<AppOptions> = {}): Express {
  return createApp({ corsOrigins: [], jwt: TEST_JWT, ...overrides });
}
