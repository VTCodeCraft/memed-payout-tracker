import { createClient } from '@redis/client';
import type { CacheStore } from './live-campaigns-cache';

const CONNECT_TIMEOUT_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 5_000;

export interface RedisStore extends CacheStore {
  /** Stops reconnecting and drops the connection; a cache has nothing worth draining. */
  close(): void;
}

interface RedisStoreOptions {
  log?: Pick<Console, 'log' | 'warn'>;
}

/**
 * A CacheStore on Redis that can never stop the API: it connects in the background, keeps
 * reconnecting with a capped backoff, and while disconnected rejects commands at once
 * instead of queueing them, so the cache falls back to MongoDB straight away.
 */
export function createRedisStore(url: string, { log = console }: RedisStoreOptions = {}): RedisStore {
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: CONNECT_TIMEOUT_MS,
      // Retries forever, also for the first connection: the cache is optional, so the API
      // serves from MongoDB until Redis is back.
      reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, MAX_RECONNECT_DELAY_MS),
    },
  });

  let closed = false;
  let available = false;
  let reportedDown = false;

  // node-redis emits 'error' on every failed attempt, and an emitter with no 'error'
  // listener throws, which would crash the process. Only changes of state are logged.
  client.on('error', (error: Error) => {
    if (closed || reportedDown) return;
    available = false;
    reportedDown = true;
    // The error's name and message only, never the URL, which may hold a password.
    log.warn(`Redis cache unavailable, serving from MongoDB until it reconnects (${error.name}: ${error.message})`);
  });
  client.on('ready', () => {
    available = true;
    reportedDown = false;
    log.log('Redis cache connected');
  });

  // Not awaited: startup must not wait for, or fail because of, the cache. It rejects
  // only once the client is closed, which is expected during shutdown.
  client.connect().catch((error: unknown) => {
    if (!closed) log.warn(`Redis cache stopped connecting: ${error instanceof Error ? error.name : String(error)}`);
  });

  return {
    get: (key) => client.get(key),
    async set(key, value, ttlSeconds) {
      await client.set(key, value, { expiration: { type: 'EX', value: ttlSeconds } });
    },
    async del(key) {
      await client.del(key);
    },
    close() {
      closed = true;
      if (available) log.log('Redis cache connection closed');
      client.destroy();
    },
  };
}
