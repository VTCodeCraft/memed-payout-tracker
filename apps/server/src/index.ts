import { existsSync } from 'node:fs';
import { createApp } from './app';
import { loadEnv } from './config/env';

// Local development reads apps/server/.env; deployed environments provide real variables.
if (existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();

createApp({ corsOrigins: env.corsOrigins }).listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`CORS allowed origins: ${env.corsOrigins.join(', ')}`);
});
