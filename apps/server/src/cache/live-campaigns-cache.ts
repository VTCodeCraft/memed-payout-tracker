import { z } from 'zod';
import { type CampaignResponse, PLATFORMS } from '../models/campaign.model';

// A read-through cache for the creators' live campaign list: discovery data only. Nothing
// that decides a payout, a budget, a submission or ownership ever reads it; those read
// MongoDB. Every operation fails open: an error, a timeout or bad data counts as a miss.

export const LIVE_CAMPAIGNS_KEY = 'memed:campaigns:live:v1'; // bump the version if the shape changes
export const LIVE_CAMPAIGNS_TTL_SECONDS = 60; // the most a missed invalidation can leave stale
export const CACHE_TIMEOUT_MS = 250;

/** The three commands the cache needs. The Redis adapter implements them; tests fake them. */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface LiveCampaignsCache {
  /** The cached list, or undefined on a miss or when the cache cannot answer in time. */
  read(): Promise<CampaignResponse[] | undefined>;
  /** Best effort: never throws. */
  write(campaigns: CampaignResponse[]): Promise<void>;
  /** Best effort: never throws. */
  invalidate(): Promise<void>;
}

/** Used when no Redis is configured: every read misses, so the route reads MongoDB. */
export const noLiveCampaignsCache: LiveCampaignsCache = {
  read: async () => undefined,
  write: async () => {},
  invalidate: async () => {},
};

// The cache lives outside this process, so what it returns is checked like any other input.
// Strict objects reject extra fields, so a tampered entry cannot add an owner id to the response.
const cachedCampaignsSchema = z.array(
  z.strictObject({
    id: z.string(),
    name: z.string(),
    platform: z.enum(PLATFORMS),
    totalBudget: z.number().int(),
    spent: z.number().int(),
    remaining: z.number().int(),
    milestones: z.array(z.strictObject({ views: z.number().int(), payout: z.number().int() })),
    status: z.literal('live'),
    createdAt: z.string(),
  }),
);

class CacheTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`no answer within ${timeoutMs} ms`);
    this.name = 'CacheTimeoutError';
  }
}

/**
 * Settles with the operation or rejects after timeoutMs, whichever comes first. A store
 * that answers or rejects later is ignored: Promise.race has already subscribed to it, so
 * its late rejection is handled rather than reported as unhandled.
 */
function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CacheTimeoutError(timeoutMs)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

interface CacheOptions {
  timeoutMs?: number;
  /** Where failures are reported; once per run of failures, so an outage does not flood the log. */
  report?: (message: string) => void;
}

export function createLiveCampaignsCache(
  store: CacheStore,
  { timeoutMs = CACHE_TIMEOUT_MS, report = (message) => console.warn(message) }: CacheOptions = {},
): LiveCampaignsCache {
  let failing = false;

  /** Runs one store command within the timeout; undefined if it failed for any reason. */
  async function attempt<T>(operation: string, command: () => Promise<T>): Promise<{ value: T } | undefined> {
    try {
      const value = await withTimeout(command(), timeoutMs);
      failing = false;
      return { value };
    } catch (error) {
      if (!failing) {
        failing = true;
        // The error's name and message only: Redis client errors name hosts, never passwords.
        report(`Live campaigns cache ${operation} failed, using MongoDB instead: ${errorText(error)}`);
      }
      return undefined;
    }
  }

  return {
    async read() {
      const result = await attempt('read', () => store.get(LIVE_CAMPAIGNS_KEY));
      if (!result || result.value === null) return undefined;

      try {
        return cachedCampaignsSchema.parse(JSON.parse(result.value));
      } catch {
        report('Live campaigns cache held malformed data; ignoring it and using MongoDB instead');
        return undefined;
      }
    },
    async write(campaigns) {
      await attempt('write', () => store.set(LIVE_CAMPAIGNS_KEY, JSON.stringify(campaigns), LIVE_CAMPAIGNS_TTL_SECONDS));
    },
    async invalidate() {
      await attempt('invalidate', () => store.del(LIVE_CAMPAIGNS_KEY));
    },
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
