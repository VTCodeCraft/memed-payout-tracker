import { createLiveCampaignsCache } from '../../src/cache/live-campaigns-cache';
import { type RedisStore, createRedisStore } from '../../src/cache/redis-store';

// Nothing listens on port 1, so every connection attempt is refused. The password in the
// URL must never appear in a log line.
const UNREACHABLE = 'redis://default:s3cret-pa55@127.0.0.1:1';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(condition: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await sleep(25);
  }
}

// Every store is closed after its test, even one that timed out: a client left open keeps
// reconnecting and would stop Jest from exiting instead of letting the test fail.
const opened: RedisStore[] = [];
afterEach(() => opened.splice(0).forEach((store) => store.close()));

function openStore(url: string, log = { log: jest.fn(), warn: jest.fn() }) {
  const store = createRedisStore(url, { log });
  opened.push(store);
  return { store, log };
}

describe('Redis store when Redis cannot be reached', () => {
  it('keeps the process running, rejects commands at once, logs the outage once, and stops cleanly', async () => {
    const { store, log } = openStore(UNREACHABLE);

    // Commands are rejected as offline at once, not queued behind the connection attempt
    // (a queued command would wait until Redis came back).
    await expect(store.get('key')).rejects.toThrow('The client is offline');
    await expect(store.set('key', 'value', 60)).rejects.toThrow('The client is offline');
    await expect(store.del('key')).rejects.toThrow('The client is offline');

    // Refused connections are reported once, however many retries follow.
    await waitFor(() => log.warn.mock.calls.length > 0, 10_000);
    await sleep(2_000);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn.mock.calls[0]?.[0]).toMatch(/^Redis cache unavailable, serving from MongoDB until it reconnects/);
    expect(log.warn.mock.calls[0]?.[0]).not.toContain('s3cret-pa55');
    expect(log.log).not.toHaveBeenCalled();

    store.close();
    store.close(); // shutdown may run it twice; it must not throw
    await expect(store.get('key')).rejects.toThrow('The client is closed');
    await sleep(1_000); // no reconnect attempts, and so no more logging, after closing
    expect(log.warn).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('lets the cache fall back at once rather than waiting out its timeout', async () => {
    const { store } = openStore(UNREACHABLE);
    const report = jest.fn();
    const cache = createLiveCampaignsCache(store, { report });

    expect(await cache.read()).toBeUndefined();
    await cache.write([]);
    await cache.invalidate();

    // Reported once, and as offline: the 250 ms timeout never had to run out.
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(expect.stringContaining('The client is offline'));
  });
});

// Needs a real Redis, which this machine does not run; Jest reports it as skipped unless
// REDIS_TEST_URL points at one (planned with the Docker setup).
const realRedis = process.env.REDIS_TEST_URL;
(realRedis ? describe : describe.skip)('Redis store against a real Redis', () => {
  it('sets with an expiry, gets and deletes', async () => {
    const { store } = openStore(realRedis ?? '');
    const key = `memed:test:${Date.now()}`;

    // Commands reject until the background connection is ready, so retry the first one.
    const deadline = Date.now() + 5_000;
    for (;;) {
      try {
        await store.set(key, 'value', 60);
        break;
      } catch (error) {
        if (Date.now() > deadline) throw error;
        await sleep(100);
      }
    }
    expect(await store.get(key)).toBe('value');
    await store.del(key);
    expect(await store.get(key)).toBeNull();
  });
});
