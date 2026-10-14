import { createClient } from '@redis/client';
import mongoose from 'mongoose';
import request from 'supertest';
import { LIVE_CAMPAIGNS_KEY, createLiveCampaignsCache } from '../../src/cache/live-campaigns-cache';
import { type RedisStore, createRedisStore } from '../../src/cache/redis-store';
import { connectToDatabase } from '../../src/db/connection';
import { Campaign } from '../../src/models/campaign.model';
import { Submission } from '../../src/models/submission.model';
import { User } from '../../src/models/user.model';
import { account } from '../helpers/accounts';
import { createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';
import { expectPayoutInvariants } from '../helpers/payout-invariants';

// These tests need a real Redis: `docker compose up -d redis`, then run Jest with
// REDIS_TEST_URL=redis://127.0.0.1:6379. Without it Jest reports them as skipped. They delete
// keys, drop connections and pause the server, so only a throwaway local Redis is accepted,
// and they all live in this one file so that no other test file shares the server meanwhile.
const realRedisUrl = (() => {
  const raw = process.env.REDIS_TEST_URL;
  if (!raw) return undefined;
  const { hostname } = new URL(raw);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error(`REDIS_TEST_URL must point at a throwaway local Redis, not ${hostname}`);
  }
  return raw;
})();

const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(realRedisUrl ? describe : describe.skip)('against a real Redis', () => {
  const url = realRedisUrl ?? '';
  // A separate connection for inspecting and disturbing the server; CLIENT KILL skips it.
  const admin = createClient({ url });
  const opened: RedisStore[] = [];
  const testKeys: string[] = [];
  let db: TestDatabase;

  function openStore() {
    const log = { log: jest.fn(), warn: jest.fn() };
    const store = createRedisStore(url, { log });
    opened.push(store);
    return { store, log };
  }

  /** Waits for the background connection: commands are rejected until it is ready. */
  async function ready(store: RedisStore) {
    const deadline = Date.now() + 5_000;
    for (;;) {
      try {
        await store.get('memed:test:ping');
        return;
      } catch (error) {
        if (Date.now() > deadline) throw error;
        await sleep(50);
      }
    }
  }

  beforeAll(async () => {
    await admin.connect();
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  // Runs even when a test fails: the server is unpaused, test keys and the cached list are
  // removed, and every store is closed. Each pause also expires on its own after a second.
  afterEach(async () => {
    await admin.sendCommand(['CLIENT', 'UNPAUSE']).catch(() => {});
    await admin.del([LIVE_CAMPAIGNS_KEY, ...testKeys.splice(0)]);
    opened.splice(0).forEach((store) => store.close());
    await Promise.all([Submission.deleteMany({}), Campaign.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    admin.destroy();
    await mongoose.disconnect();
    await db.stop();
  });

  describe('Redis store', () => {
    it('sets with an expiry, gets and deletes', async () => {
      const { store } = openStore();
      const key = `memed:test:${Date.now()}`;
      testKeys.push(key);
      await ready(store);

      await store.set(key, 'value', 60);
      expect(await store.get(key)).toBe('value');
      expect(await admin.ttl(key)).toBeGreaterThan(55);
      await store.del(key);
      expect(await store.get(key)).toBeNull();
    });

    it('lets a key expire after its time to live', async () => {
      const { store } = openStore();
      const key = `memed:test:expiry:${Date.now()}`;
      testKeys.push(key);
      await ready(store);

      await store.set(key, 'value', 1);
      expect(await store.get(key)).toBe('value');
      await sleep(1_200);

      expect(await store.get(key)).toBeNull();
    });

    it('reconnects by itself after Redis drops the connection, logging the outage once', async () => {
      const { store, log } = openStore();
      await ready(store);
      expect(log.log).toHaveBeenCalledWith('Redis cache connected');

      await admin.sendCommand(['CLIENT', 'KILL', 'TYPE', 'normal']); // every client but admin
      await ready(store);

      expect(await store.get('memed:test:after-reconnect')).toBeNull();
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn.mock.calls[0]?.[0]).toMatch(/^Redis cache unavailable/);
      expect(log.log.mock.calls.filter(([message]) => message === 'Redis cache connected')).toHaveLength(2);
    }, 20_000);
  });

  describe('live campaign list through the API', () => {
    let creator: { id: string; auth: string };
    let brand: { id: string; auth: string };

    beforeEach(async () => {
      creator = await account('creator', 'creator@redis.test');
      brand = await account('brand', 'brand@redis.test');
    });

    async function appWithRealCache() {
      const { store } = openStore();
      await ready(store);
      return createTestApp({ liveCampaignsCache: createLiveCampaignsCache(store, { report: jest.fn() }) });
    }

    const live = (app: Awaited<ReturnType<typeof appWithRealCache>>) =>
      request(app).get('/api/campaigns/live').set('Authorization', creator.auth);
    const names = (res: request.Response) => res.body.campaigns.map((campaign: { name: string }) => campaign.name);
    const campaignInDb = (name: string, totalBudget = 6_000) =>
      Campaign.create({ brandId: new mongoose.Types.ObjectId(), name, platform: 'instagram', totalBudget, milestones: ladder });

    it('stores the list for 60 seconds on a miss and serves the next request from Redis', async () => {
      const app = await appWithRealCache();
      await campaignInDb('Diwali Drop');

      const miss = await live(app);
      expect(await admin.exists(LIVE_CAMPAIGNS_KEY)).toBe(1);
      const ttl = await admin.ttl(LIVE_CAMPAIGNS_KEY);
      expect(ttl).toBeGreaterThan(55);
      expect(ttl).toBeLessThanOrEqual(60);

      await campaignInDb('Behind The Cache'); // straight to MongoDB: nothing invalidates
      const hit = await live(app);

      expect(hit.body).toEqual(miss.body);
      expect(names(hit)).toEqual(['Diwali Drop']);
    });

    it('drops the cached list when a campaign is created and when a payment lands, and keeps payouts within budget', async () => {
      const app = await appWithRealCache();
      await live(app);
      expect(await admin.exists(LIVE_CAMPAIGNS_KEY)).toBe(1);

      const created = await request(app)
        .post('/api/campaigns')
        .set('Authorization', brand.auth)
        .send({ name: 'Small Budget', platform: 'instagram', totalBudget: 2_000, milestones: ladder });
      expect(created.status).toBe(201);
      expect(await admin.exists(LIVE_CAMPAIGNS_KEY)).toBe(0);
      expect(names(await live(app))).toEqual(['Small Budget']);

      const campaignId = created.body.campaign.id as string;
      const posts = await Promise.all(
        ['RealRedisA1', 'RealRedisB2'].map(async (code) => {
          const url = `https://www.instagram.com/p/${code}/`;
          return (await Submission.create({ campaignId, creatorId: new mongoose.Types.ObjectId(), platform: 'instagram', postUrl: url, normalizedUrl: url })).id as string;
        }),
      );
      // Both owed 2,000 against a 2,000 budget, at the same moment.
      const paid = await Promise.all(posts.map((id) => request(app).patch(`/api/submissions/${id}/views`).send({ views: 60_000 })));

      expect(paid.map((res) => res.body.allocation.grantedNow).sort()).toEqual([0, 2_000]);
      expect(await admin.exists(LIVE_CAMPAIGNS_KEY)).toBe(0);
      expect(names(await live(app))).toEqual([]); // exhausted, so no longer live
      await expectPayoutInvariants(campaignId);
    });

    it('answers from MongoDB within the timeout while Redis is paused', async () => {
      const app = await appWithRealCache();
      await campaignInDb('Cached Before The Pause');
      await live(app); // cached: one campaign
      await campaignInDb('Only In MongoDB');

      await admin.sendCommand(['CLIENT', 'PAUSE', '1000', 'ALL']); // Redis stops answering for 1 s
      const started = Date.now();
      const res = await live(app);
      const elapsed = Date.now() - started;

      expect(res.status).toBe(200);
      // Both campaigns: the answer came from MongoDB, not from the cached single-campaign list,
      // so the request did not wait for the pause to end (the cache would have answered then).
      expect(names(res)).toEqual(['Only In MongoDB', 'Cached Before The Pause']);
      expect(elapsed).toBeGreaterThanOrEqual(240); // the cache read did wait out its 250 ms timeout
    }, 20_000);
  });
});
