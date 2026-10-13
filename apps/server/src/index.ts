import { existsSync } from 'node:fs';
import mongoose from 'mongoose';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { connectToDatabase } from './db/connection';

async function main(): Promise<void> {
  // Local development reads apps/server/.env; deployed environments provide real variables.
  if (existsSync('.env')) process.loadEnvFile('.env');

  const env = loadEnv();

  await connectToDatabase(env.mongodbUri);
  console.log(`Connected to MongoDB database "${mongoose.connection.name}"`);

  createApp({ corsOrigins: env.corsOrigins, jwt: env.jwt }).listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    console.log(`CORS allowed origins: ${env.corsOrigins.join(', ')}`);
  });
}

main().catch((error: unknown) => {
  // Message only: config and driver errors are written not to contain credentials,
  // and a stack trace adds nothing for an operator reading deploy logs.
  console.error(`Server failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
