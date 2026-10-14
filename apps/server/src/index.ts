import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { createApp } from './app';
import { createLiveCampaignsCache } from './cache/live-campaigns-cache';
import { createRedisStore } from './cache/redis-store';
import { loadEnv } from './config/env';
import { connectToDatabase } from './db/connection';
import { createShutdown } from './shutdown';

// Render sends SIGTERM on every deploy and kills the process after its grace
// period; finishing within 10 seconds keeps well inside it.
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  // Local development reads apps/server/.env; deployed environments provide real variables.
  if (existsSync('.env')) process.loadEnvFile('.env');

  const env = loadEnv();

  await connectToDatabase(env.mongodbUri);
  console.log(`Connected to MongoDB database "${mongoose.connection.name}"`);

  // Optional, and connected in the background: the API never waits for the cache.
  const redis = env.redisUrl ? createRedisStore(env.redisUrl) : undefined;
  console.log(redis ? 'Redis cache: enabled for the live campaign list' : 'Redis cache: disabled (REDIS_URL not set)');

  const server = createApp({
    corsOrigins: env.corsOrigins,
    jwt: env.jwt,
    liveCampaignsCache: redis ? createLiveCampaignsCache(redis) : undefined,
  }).listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`CORS allowed origins: ${env.corsOrigins.join(', ')}`);
  });

  const shutdown = createShutdown({
    server,
    closeResources: async () => {
      redis?.close();
      await mongoose.disconnect();
    },
    timeoutMs: SHUTDOWN_TIMEOUT_MS,
    exit: (code) => process.exit(code),
  });
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  // Message only: config and driver errors are written not to contain credentials,
  // and a stack trace adds nothing for an operator reading deploy logs.
  console.error(`Server failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
