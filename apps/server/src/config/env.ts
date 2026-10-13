import { z } from 'zod';
import { parseCorsOrigins } from './cors';

// mongodb:// or mongodb+srv://, any host list, then a non-empty /<database> path.
const MONGODB_URI_WITH_DATABASE = /^mongodb(\+srv)?:\/\/[^/?]+\/[^/?]+/;

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
});

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongodbUri: string;
  corsOrigins: string[];
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

  const { NODE_ENV, PORT, MONGODB_URI, CORS_ORIGINS } = result.data;

  return {
    nodeEnv: NODE_ENV,
    port: PORT,
    mongodbUri: MONGODB_URI,
    corsOrigins: parseCorsOrigins(CORS_ORIGINS, NODE_ENV),
  };
}
