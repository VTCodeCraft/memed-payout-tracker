import {
  type CacheStore,
  LIVE_CAMPAIGNS_KEY,
  createLiveCampaignsCache,
} from '../../src/cache/live-campaigns-cache';
import type { CampaignResponse } from '../../src/models/campaign.model';

const campaign: CampaignResponse = {
  id: '665f1c2e8b3e4a0000000001',
  name: 'Diwali Drop',
  platform: 'instagram',
  totalBudget: 6_000,
  spent: 500,
  remaining: 5_500,
  milestones: [{ views: 10_000, payout: 500 }],
  status: 'live',
  createdAt: '2026-10-14T06:00:00.000Z',
};

/** An in-memory store; pass overrides to make a command fail or hang. */
function memoryStore(overrides: Partial<CacheStore> = {}) {
  const data = new Map<string, string>();
  const store: CacheStore = {
    get: jest.fn(async (key: string) => data.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      data.delete(key);
    }),
    ...overrides,
  };
  return { store, data };
}

const never = () => new Promise<never>(() => {});
const rejects = () => Promise.reject(new Error('connection refused'));

describe('live campaigns cache', () => {
  afterEach(() => jest.useRealTimers());

  it('returns what was written, stored under one versioned key for 60 seconds', async () => {
    const { store } = memoryStore();
    const cache = createLiveCampaignsCache(store, { report: jest.fn() });

    await cache.write([campaign]);

    expect(store.set).toHaveBeenCalledWith(LIVE_CAMPAIGNS_KEY, JSON.stringify([campaign]), 60);
    expect(LIVE_CAMPAIGNS_KEY).toBe('memed:campaigns:live:v1');
    expect(await cache.read()).toEqual([campaign]);
  });

  it('misses when nothing is cached, and again after invalidation', async () => {
    const { store } = memoryStore();
    const cache = createLiveCampaignsCache(store, { report: jest.fn() });
    expect(await cache.read()).toBeUndefined();

    await cache.write([campaign]);
    await cache.invalidate();

    expect(store.del).toHaveBeenCalledWith(LIVE_CAMPAIGNS_KEY);
    expect(await cache.read()).toBeUndefined();
  });

  it('treats a rejecting store as a miss and never throws', async () => {
    const report = jest.fn();
    const { store } = memoryStore({ get: rejects, set: rejects, del: rejects });
    const cache = createLiveCampaignsCache(store, { report });

    await expect(cache.read()).resolves.toBeUndefined();
    await expect(cache.write([campaign])).resolves.toBeUndefined();
    await expect(cache.invalidate()).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledWith(expect.stringContaining('read failed, using MongoDB instead: Error: connection refused'));
  });

  it('treats a store that throws synchronously as a miss', async () => {
    const thrower = () => {
      throw new TypeError('client is closed');
    };
    const { store } = memoryStore({ get: thrower, set: thrower, del: thrower });
    const cache = createLiveCampaignsCache(store, { report: jest.fn() });

    await expect(cache.read()).resolves.toBeUndefined();
    await expect(cache.write([campaign])).resolves.toBeUndefined();
    await expect(cache.invalidate()).resolves.toBeUndefined();
  });

  it.each([
    ['read', (cache: ReturnType<typeof createLiveCampaignsCache>) => cache.read()],
    ['write', (cache: ReturnType<typeof createLiveCampaignsCache>) => cache.write([campaign])],
    ['invalidate', (cache: ReturnType<typeof createLiveCampaignsCache>) => cache.invalidate()],
  ])('gives up on a hanging store after 250 ms (%s)', async (operation, run) => {
    jest.useFakeTimers();
    const report = jest.fn();
    const { store } = memoryStore({ get: never, set: never, del: never });
    const cache = createLiveCampaignsCache(store, { report });

    let settled = false;
    const pending = run(cache).then((value) => {
      settled = true;
      return value;
    });

    await jest.advanceTimersByTimeAsync(249);
    expect(settled).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect(await pending).toBeUndefined();
    expect(report).toHaveBeenCalledWith(expect.stringContaining(`${operation} failed, using MongoDB instead: CacheTimeoutError: no answer within 250 ms`));
  });

  it('leaves no unhandled rejection when the store fails after the timeout', async () => {
    jest.useFakeTimers();
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      const late = () => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('late failure')), 1_000));
      const { store } = memoryStore({ get: late });
      const cache = createLiveCampaignsCache(store, { report: jest.fn() });

      const pending = cache.read();
      await jest.advanceTimersByTimeAsync(250);
      expect(await pending).toBeUndefined();
      await jest.advanceTimersByTimeAsync(1_000); // the store rejects now
      jest.useRealTimers();
      await new Promise((resolve) => setImmediate(resolve)); // let Node report it, if it would

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it.each([
    ['text that is not JSON', 'not json'],
    ['JSON that is not a list', '{}'],
    ['a campaign with an extra field, such as an owner id', JSON.stringify([{ ...campaign, brandId: '665f1c2e8b3e4a0000000002' }])],
    ['a campaign that is not live', JSON.stringify([{ ...campaign, status: 'exhausted' }])],
    ['a campaign with a mistyped figure', JSON.stringify([{ ...campaign, spent: '500' }])],
    ['a campaign missing a field', JSON.stringify([{ ...campaign, remaining: undefined }])],
    // Well-typed, but nothing the API could have sent:
    ['an id that is not an ObjectId', JSON.stringify([{ ...campaign, id: '../../admin' }])],
    ['an empty name', JSON.stringify([{ ...campaign, name: '' }])],
    ['a name longer than 80 characters', JSON.stringify([{ ...campaign, name: 'x'.repeat(81) }])],
    ['negative spend', JSON.stringify([{ ...campaign, spent: -500, remaining: 6_500 }])],
    ['spend above the budget', JSON.stringify([{ ...campaign, spent: 7_000, remaining: -1_000 }])],
    ['a remaining figure that disagrees with the budget', JSON.stringify([{ ...campaign, remaining: 6_000 }])],
    ['fractional rupees', JSON.stringify([{ ...campaign, totalBudget: 6_000.5, remaining: 5_500.5 }])],
    ['an empty milestone ladder', JSON.stringify([{ ...campaign, milestones: [] }])],
    ['a ladder whose payouts do not increase', JSON.stringify([{ ...campaign, milestones: [{ views: 10_000, payout: 500 }, { views: 50_000, payout: 500 }] }])],
    ['a milestone paying more than the budget', JSON.stringify([{ ...campaign, milestones: [{ views: 10_000, payout: 7_000 }] }])],
    ['a creation date that is not a date', JSON.stringify([{ ...campaign, createdAt: 'yesterday' }])],
  ])('ignores %s instead of serving it', async (_label, raw) => {
    const report = jest.fn();
    const { store, data } = memoryStore();
    data.set(LIVE_CAMPAIGNS_KEY, raw);
    const cache = createLiveCampaignsCache(store, { report });

    expect(await cache.read()).toBeUndefined();
    expect(report).toHaveBeenCalledWith(expect.stringContaining('malformed data'));
  });

  it('reports a run of failures once, and again only after the store has recovered', async () => {
    const report = jest.fn();
    let healthy = false;
    const { store } = memoryStore({ get: async () => (healthy ? null : rejects()) });
    const cache = createLiveCampaignsCache(store, { report });

    await cache.read();
    await cache.read();
    expect(report).toHaveBeenCalledTimes(1);

    healthy = true;
    await cache.read();
    healthy = false;
    await cache.read();
    expect(report).toHaveBeenCalledTimes(2);
  });
});
