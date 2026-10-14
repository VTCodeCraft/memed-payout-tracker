import mongoose from 'mongoose';
import request from 'supertest';
import { type CacheStore, LIVE_CAMPAIGNS_KEY, createLiveCampaignsCache } from '../../src/cache/live-campaigns-cache';
import { connectToDatabase } from '../../src/db/connection';
import { Campaign } from '../../src/models/campaign.model';
import { Submission } from '../../src/models/submission.model';
import { User } from '../../src/models/user.model';
import { account } from '../helpers/accounts';
import { createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';
import { expectPayoutInvariants } from '../helpers/payout-invariants';

// The assignment's example ladder.
const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
  { views: 100_000, payout: 5_000 },
];

/** An in-memory stand-in for Redis with every command spied on; overrides make one fail or hang. */
function memoryStore(overrides: Partial<CacheStore> = {}) {
  const data = new Map<string, string>();
  const store = {
    get: jest.fn(overrides.get ?? (async (key: string) => data.get(key) ?? null)),
    set: jest.fn(
      overrides.set ??
        (async (key: string, value: string) => {
          data.set(key, value);
        }),
    ),
    del: jest.fn(
      overrides.del ??
        (async (key: string) => {
          data.delete(key);
        }),
    ),
  };
  return { store, data };
}

const appWith = (store: CacheStore) => createTestApp({ liveCampaignsCache: createLiveCampaignsCache(store, { report: jest.fn() }) });

async function campaignInDb(name: string, overrides: Record<string, unknown> = {}) {
  return Campaign.create({ brandId: new mongoose.Types.ObjectId(), name, platform: 'instagram', totalBudget: 6_000, milestones: ladder, ...overrides });
}

async function submissionInDb(campaignId: string, shortcode: string) {
  const url = `https://www.instagram.com/p/${shortcode}/`;
  const created = await Submission.create({ campaignId, creatorId: new mongoose.Types.ObjectId(), platform: 'instagram', postUrl: url, normalizedUrl: url });
  return created.id as string;
}

const names = (res: request.Response) => res.body.campaigns.map((campaign: { name: string }) => campaign.name);

describe('live campaign list with a cache', () => {
  let db: TestDatabase;
  let creator: { id: string; auth: string };
  let brand: { id: string; auth: string };

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  beforeEach(async () => {
    creator = await account('creator', 'creator@memes.test');
    brand = await account('brand', 'brand@acme.test');
  });

  afterEach(async () => {
    await Promise.all([Submission.deleteMany({}), Campaign.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  const live = (app: ReturnType<typeof appWith>, auth = creator.auth) => request(app).get('/api/campaigns/live').set('Authorization', auth);
  const setViews = (app: ReturnType<typeof appWith>, id: string, views: number) =>
    request(app).patch(`/api/submissions/${id}/views`).send({ views });

  it('fills the cache on a miss and serves the next request from it, in the same shape as MongoDB', async () => {
    const { store } = memoryStore();
    const app = appWith(store);
    await campaignInDb('Diwali Drop');

    const miss = await live(app);
    // Written straight to MongoDB, bypassing the API, so nothing invalidates the cache.
    await campaignInDb('Unseen Until Invalidated');
    const hit = await live(app);

    expect(store.set).toHaveBeenCalledWith(LIVE_CAMPAIGNS_KEY, expect.any(String), 60);
    expect(hit.status).toBe(200);
    expect(hit.body).toEqual(miss.body);
    expect(names(hit)).toEqual(['Diwali Drop']);
    // Without a cache, the same request sees both campaigns, in the same response shape.
    const uncached = await request(createTestApp()).get('/api/campaigns/live').set('Authorization', creator.auth);
    expect(names(uncached)).toEqual(['Unseen Until Invalidated', 'Diwali Drop']);
    expect(uncached.body.campaigns[1]).toEqual(hit.body.campaigns[0]);
  });

  it('shows a campaign to creators as soon as a brand creates it, but not after a rejected create', async () => {
    const { store } = memoryStore();
    const app = appWith(store);
    await live(app); // warm, with no campaigns

    const rejected = await request(app).post('/api/campaigns').set('Authorization', brand.auth).send({ name: '' });
    expect(rejected.status).toBe(400);
    expect(store.del).not.toHaveBeenCalled();

    const created = await request(app)
      .post('/api/campaigns')
      .set('Authorization', brand.auth)
      .send({ name: 'Holi Reels', platform: 'instagram', totalBudget: 6_000, milestones: ladder });
    expect(created.status).toBe(201);
    expect(store.del).toHaveBeenCalledWith(LIVE_CAMPAIGNS_KEY);
    expect(names(await live(app))).toEqual(['Holi Reels']);
  });

  it('refreshes spent and remaining after a payment, and drops a campaign once its budget is spent', async () => {
    const { store } = memoryStore();
    const app = appWith(store);
    const big = await campaignInDb('Big Budget');
    const small = await campaignInDb('Small Budget', { totalBudget: 5_000, milestones: [{ views: 10_000, payout: 5_000 }] });
    const onBig = await submissionInDb(big.id, 'PaysPartOf1');
    const onSmall = await submissionInDb(small.id, 'SpendsItAll');
    await live(app); // warm

    expect((await setViews(app, onBig, 60_000)).body.allocation.grantedNow).toBe(2_000);
    const afterPayment = await live(app);
    expect(afterPayment.body.campaigns.find((c: { name: string }) => c.name === 'Big Budget')).toMatchObject({ spent: 2_000, remaining: 4_000 });

    expect((await setViews(app, onSmall, 10_000)).body.campaign).toEqual({ remaining: 0, status: 'exhausted' });
    expect(names(await live(app))).toEqual(['Big Budget']);
  });

  it('leaves the cache alone for view updates that pay nothing', async () => {
    const { store } = memoryStore();
    const app = appWith(store);
    const { id: campaignId } = await campaignInDb('Diwali Drop');
    const id = await submissionInDb(campaignId, 'NoPayYet001');
    await live(app);

    expect((await setViews(app, id, 5_000)).body.allocation.outcome).toBe('no_new_payout');
    expect((await setViews(app, id, 5_000)).body.allocation.outcome).toBe('no_change');
    expect((await setViews(app, id, 4_000)).status).toBe(409);

    expect(store.del).not.toHaveBeenCalled();
  });

  it('keeps every route working from MongoDB when the cache rejects everything', async () => {
    const failing = () => Promise.reject(new Error('connection refused'));
    const { store } = memoryStore({ get: failing, set: failing, del: failing });
    const app = appWith(store);
    const { id: campaignId } = await campaignInDb('Diwali Drop');
    const id = await submissionInDb(campaignId, 'CacheIsDown');

    expect(names(await live(app))).toEqual(['Diwali Drop']);
    const created = await request(app)
      .post('/api/campaigns')
      .set('Authorization', brand.auth)
      .send({ name: 'Holi Reels', platform: 'youtube', totalBudget: 6_000, milestones: ladder });
    expect(created.status).toBe(201);
    expect((await setViews(app, id, 60_000)).body.allocation).toEqual({ grantedNow: 2_000, unfundedPayout: 0, outcome: 'paid' });
    expect(names(await live(app))).toEqual(['Holi Reels', 'Diwali Drop']);
  });

  it('delays a request by no more than the cache timeout when the cache hangs', async () => {
    const hangs = () => new Promise<never>(() => {});
    const { store } = memoryStore({ get: hangs, set: hangs, del: hangs });
    const app = appWith(store);
    const { id: campaignId } = await campaignInDb('Diwali Drop');
    const id = await submissionInDb(campaignId, 'CacheHangs1');

    for (const send of [
      () => live(app),
      () => request(app).post('/api/campaigns').set('Authorization', brand.auth).send({ name: 'Holi Reels', platform: 'instagram', totalBudget: 6_000, milestones: ladder }),
      () => setViews(app, id, 60_000),
    ]) {
      const started = Date.now();
      const res = await send();
      expect(res.status).toBeLessThan(300);
      expect(Date.now() - started).toBeLessThan(1_500);
    }
  });

  it('checks the token and role before it ever reads the cache', async () => {
    const { store } = memoryStore();
    const app = appWith(store);
    await campaignInDb('Diwali Drop');
    await live(app); // warm
    const reads = store.get.mock.calls.length;

    expect((await request(app).get('/api/campaigns/live')).status).toBe(401);
    expect((await live(app, 'Bearer not-a-token')).status).toBe(401);
    expect((await live(app, brand.auth)).status).toBe(403);
    expect(store.get).toHaveBeenCalledTimes(reads);
  });

  it('refuses a post to a campaign the cache still lists as live, because the submission reads MongoDB', async () => {
    const { store } = memoryStore();
    const app = appWith(store);
    const { id: campaignId } = await campaignInDb('Diwali Drop');
    await live(app); // warm
    // Exhausted behind the cache's back, as if an invalidation had been lost.
    await Campaign.updateOne({ _id: campaignId }, { $set: { spent: 6_000, status: 'exhausted' } });

    expect(names(await live(app))).toEqual(['Diwali Drop']); // stale, as allowed for up to 60 s
    const res = await request(app)
      .post('/api/submissions')
      .set('Authorization', creator.auth)
      .send({ campaignId, postUrl: 'https://www.instagram.com/p/StaleListPst/' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAMPAIGN_NOT_LIVE');
  });

  it('caps payments by the budget in MongoDB, whatever the cached list claims', async () => {
    const { store, data } = memoryStore();
    const app = appWith(store);
    const { id: campaignId } = await campaignInDb('Diwali Drop');
    await setViews(app, await submissionInDb(campaignId, 'TakesMost01'), 100_000); // 5,000 of 6,000
    const warm = await live(app);
    expect(warm.body.campaigns[0]).toMatchObject({ spent: 5_000, remaining: 1_000 });
    // The cached list now claims the whole budget is still there.
    data.set(LIVE_CAMPAIGNS_KEY, JSON.stringify([{ ...warm.body.campaigns[0], spent: 0, remaining: 6_000 }]));
    expect((await live(app)).body.campaigns[0].remaining).toBe(6_000);

    const res = await setViews(app, await submissionInDb(campaignId, 'WantsMore01'), 100_000);

    expect(res.body.allocation).toEqual({ grantedNow: 1_000, unfundedPayout: 4_000, outcome: 'partial' });
    expect((await Campaign.findById(campaignId))?.spent).toBe(6_000);
    await expectPayoutInvariants(campaignId);
  });
});
