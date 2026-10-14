import { z } from 'zod';
import type { JwtConfig } from '../lib/jwt';
import { parseCorsOrigins } from './cors';

// mongodb:// or mongodb+srv://, any host list, then a non-empty /<database> path.
const MONGODB_URI_WITH_DATABASE = /^mongodb(\+srv)?:\/\/[^/?]+\/[^/?]+/;

// A positive whole number followed by a unit, e.g. 7d, 12h, 30m, 45s.
const DURATION = /^([1-9]\d*)([smhd])$/;
const SECONDS_PER_UNIT: Record<string, number> = { s: 1, m: 60, h: 3_600, d: 86_400 };

/** Converts a value already matched by DURATION to seconds. */
function durationToSeconds(value: string): number {
  const [, amount = '0', unit = 's'] = DURATION.exec(value) ?? [];
  return Number(amount) * (SECONDS_PER_UNIT[unit] ?? 0);
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z
    .string({ error: 'is required' })
    .trim()
    .regex(
      MONGODB_URI_WITH_DATABASE,
      'must be a mongodb:// or mongodb+srv:// URI that names a database, e.g. .../memed_dev?...',
    ),
  CORS_ORIGINS: z.string().optional(),
  JWT_SECRET: z
    .string({ error: 'is required' })
    .min(32, 'must be at least 32 characters of random data')
    // The .env.example placeholder is long enough to pass the length rule.
    .refine((secret) => !secret.includes('replace-with'), 'is still the .env.example placeholder'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(DURATION, 'must be a positive duration such as 7d, 12h, 30m or 45s')
    .default('7d')
    .transform(durationToSeconds),
  // Optional: without it the live campaign list is read from MongoDB on every request.
  REDIS_URL: z
    .string()
    .trim()
    .regex(/^rediss?:\/\/\S+$/, 'must be a redis:// or rediss:// URL')
    .optional(),
});

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongodbUri: string;
  corsOrigins: string[];
  jwt: JwtConfig;
  /** Set to cache the live campaign list in Redis; unset to go without a cache. */
  redisUrl: string | undefined;
}

/**
 * Validates server configuration. Error messages name the variable and the rule
 * but never echo values, so secrets such as MONGODB_URI never reach the logs.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }

  const { NODE_ENV, PORT, MONGODB_URI, CORS_ORIGINS, JWT_SECRET, JWT_EXPIRES_IN, REDIS_URL } = result.data;

  return {
    nodeEnv: NODE_ENV,
    port: PORT,
    mongodbUri: MONGODB_URI,
    corsOrigins: parseCorsOrigins(CORS_ORIGINS, NODE_ENV),
    jwt: { secret: JWT_SECRET, expiresInSeconds: JWT_EXPIRES_IN },
    redisUrl: REDIS_URL,
  };
}
