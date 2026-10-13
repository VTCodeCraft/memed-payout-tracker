import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

// Reads the driver's monitored connection state instead of pinging MongoDB, so
// frequent platform health probes add no database load. 503 tells the platform
// this instance cannot serve requests.
healthRouter.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === mongoose.ConnectionStates.connected;

  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    database: connected ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
  });
});
