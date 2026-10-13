import { createApp } from './app';
import { parseCorsOrigins } from './config/cors';

const port = Number(process.env.PORT) || 4000;
const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS, process.env.NODE_ENV);

createApp({ corsOrigins }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`CORS allowed origins: ${corsOrigins.join(', ')}`);
});
