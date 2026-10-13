import mongoose from 'mongoose';
import request from 'supertest';
import { connectToDatabase } from '../../src/db/connection';
import { Campaign } from '../../src/models/campaign.model';
import { User } from '../../src/models/user.model';
import { account } from '../helpers/accounts';
import { createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

const app = createTestApp();

const diwaliDrop = {
  name: 'Diwali Drop',
  platform: 'instagram',
  totalBudget: 6_000,
  milestones: [
    { views: 10_000, payout: 500 },
    { views: 50_000, payout: 2_000 },
    { views: 100_000, payout: 5_000 },
  ],
};

/** Creates a campaign through the API as the given brand and returns the response body. */
async function createAs(auth: string, name: string) {
  return (await request(app).post('/api/campaigns').set('Authorization', auth).send({ ...diwaliDrop, name })).body
    .campaign;
}

describe('campaign endpoints', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  afterEach(async () => {
    await Promise.all([Campaign.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  describe('POST /api/campaigns', () => {
    const create = (auth: string | undefined, body: object) => {
      const req = request(app).post('/api/campaigns').send(body);
      return auth === undefined ? req : req.set('Authorization', auth);
    };

    it('creates a live campaign for the authenticated brand with nothing spent', async () => {
      const brand = await account('brand', 'brand@acme.test');

      const res = await create(brand.auth, diwaliDrop);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        campaign: {
          id: expect.any(String),
          ...diwaliDrop,
          spent: 0,
          remaining: 6_000,
          status: 'live',
          createdAt: expect.any(String),
        },
      });
      const stored = await Campaign.findById(res.body.campaign.id);
      expect(stored?.brandId.toString()).toBe(brand.id);
    });

    it('ignores client-supplied ownership, spending and status', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const otherBrand = await account('brand', 'other@acme.test');

      const res = await create(brand.auth, { ...diwaliDrop, brandId: otherBrand.id, spent: 5_999, status: 'exhausted' });

      expect(res.status).toBe(201);
      expect(res.body.campaign).toMatchObject({ spent: 0, remaining: 6_000, status: 'live' });
      expect((await Campaign.findById(res.body.campaign.id))?.brandId.toString()).toBe(brand.id);
    });

    it('returns 401 without a token', async () => {
      const res = await create(undefined, diwaliDrop);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('returns 403 for a creator account', async () => {
      const creator = await account('creator', 'creator@memes.test');

      const res = await create(creator.auth, diwaliDrop);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(await Campaign.countDocuments()).toBe(0);
    });

    it.each([
      ['a fractional budget', { totalBudget: 6_000.5 }, 'totalBudget', 'must be a whole number of rupees'],
      ['a zero budget', { totalBudget: 0 }, 'totalBudget', 'must be at least 1'],
      ['a budget beyond int32', { totalBudget: 2_147_483_648 }, 'totalBudget', 'must be at most 2147483647'],
      ['a budget sent as a string', { totalBudget: '6000' }, 'totalBudget', 'must be a number'],
      ['an unknown platform', { platform: 'tiktok' }, 'platform', 'must be "instagram" or "youtube"'],
      ['a blank name', { name: '   ' }, 'name', 'is required'],
      ['no milestones', { milestones: [] }, 'milestones', 'must contain at least one milestone'],
      [
        'unordered view thresholds',
        { milestones: [{ views: 50_000, payout: 500 }, { views: 10_000, payout: 2_000 }] },
        'milestones',
        'milestone 2: views must be greater than the previous milestone',
      ],
      [
        'a payout above the budget',
        { totalBudget: 4_000 },
        'milestones',
        'milestone 3: payout cannot exceed the total budget',
      ],
      ['a fractional payout', { milestones: [{ views: 10_000, payout: 500.5 }] }, 'milestones.0.payout', 'must be a whole number of rupees'],
    ])('rejects %s with 400 VALIDATION_ERROR', async (_label, override, path, message) => {
      const brand = await account('brand', 'brand@acme.test');

      const res = await create(brand.auth, { ...diwaliDrop, ...override });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toContainEqual({ path, message });
      expect(await Campaign.countDocuments()).toBe(0);
    });

    it('reports every missing field', async () => {
      const brand = await account('brand', 'brand@acme.test');

      const res = await create(brand.auth, {});

      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
        'milestones',
        'name',
        'platform',
        'totalBudget',
      ]);
    });
  });

  describe('GET /api/campaigns/mine', () => {
    const mine = (auth?: string, query = '') => {
      const req = request(app).get(`/api/campaigns/mine${query}`);
      return auth === undefined ? req : req.set('Authorization', auth);
    };

    it("returns only the authenticated brand's campaigns, newest first", async () => {
      const acme = await account('brand', 'brand@acme.test');
      const globex = await account('brand', 'brand@globex.test');
      const first = await createAs(acme.auth, 'Acme first');
      await createAs(globex.auth, 'Globex only');
      const second = await createAs(acme.auth, 'Acme second');

      const res = await mine(acme.auth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ campaigns: [second, first] });
      expect((await mine(globex.auth)).body.campaigns.map((c: { name: string }) => c.name)).toEqual(['Globex only']);
    });

    it('cannot be pointed at another brand through query parameters', async () => {
      const acme = await account('brand', 'brand@acme.test');
      const globex = await account('brand', 'brand@globex.test');
      await createAs(globex.auth, 'Globex secret plan');

      const res = await mine(acme.auth, `?brandId=${globex.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ campaigns: [] });
    });

    it('reports spent and remaining budget for each campaign', async () => {
      const acme = await account('brand', 'brand@acme.test');
      const { id } = await createAs(acme.auth, 'Partly spent');
      await Campaign.updateOne({ _id: id }, { $set: { spent: 2_500 } });

      const [campaign] = (await mine(acme.auth)).body.campaigns;

      expect(campaign).toMatchObject({ totalBudget: 6_000, spent: 2_500, remaining: 3_500 });
    });

    it('returns 401 without a token and 403 for a creator', async () => {
      const creator = await account('creator', 'creator@memes.test');

      expect((await mine()).status).toBe(401);
      const res = await mine(creator.auth);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/campaigns/live', () => {
    const live = (auth?: string) => {
      const req = request(app).get('/api/campaigns/live');
      return auth === undefined ? req : req.set('Authorization', auth);
    };

    it('shows creators every live campaign across brands, newest first, and hides exhausted ones', async () => {
      const acme = await account('brand', 'brand@acme.test');
      const globex = await account('brand', 'brand@globex.test');
      const creator = await account('creator', 'creator@memes.test');
      const acmeLive = await createAs(acme.auth, 'Acme live');
      const exhausted = await createAs(globex.auth, 'Globex exhausted');
      const globexLive = await createAs(globex.auth, 'Globex live');
      await Campaign.updateOne({ _id: exhausted.id }, { $set: { spent: 6_000, status: 'exhausted' } });

      const res = await live(creator.auth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ campaigns: [globexLive, acmeLive] });
    });

    it('reveals nothing about the brand accounts', async () => {
      const acme = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      await createAs(acme.auth, 'Acme live');

      const res = await live(creator.auth);

      expect(res.body.campaigns).toHaveLength(1);
      expect(res.text).not.toContain(acme.id);
      expect(res.text).not.toContain('brand@acme.test');
      expect(res.body.campaigns[0]).not.toHaveProperty('brandId');
    });

    it('returns 401 without a token and 403 for a brand', async () => {
      const brand = await account('brand', 'brand@acme.test');

      expect((await live()).status).toBe(401);
      const res = await live(brand.auth);
      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'This action requires a creator account' });
    });
  });

  describe('GET /api/campaigns/:id', () => {
    const detail = (id: string, auth?: string) => {
      const req = request(app).get(`/api/campaigns/${id}`);
      return auth === undefined ? req : req.set('Authorization', auth);
    };

    it('lets a brand open its own campaign', async () => {
      const acme = await account('brand', 'brand@acme.test');
      const created = await createAs(acme.auth, 'Acme campaign');

      const res = await detail(created.id, acme.auth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ campaign: created });
    });

    it("answers 404 for another brand's campaign without revealing it exists", async () => {
      const acme = await account('brand', 'brand@acme.test');
      const globex = await account('brand', 'brand@globex.test');
      const created = await createAs(acme.auth, 'Acme campaign');

      const res = await detail(created.id, globex.auth);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    });

    it('lets a creator open live and exhausted campaigns without brand details', async () => {
      const acme = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const created = await createAs(acme.auth, 'Acme campaign');

      const liveRes = await detail(created.id, creator.auth);
      expect(liveRes.status).toBe(200);
      expect(liveRes.body).toEqual({ campaign: created });
      expect(liveRes.text).not.toContain(acme.id);

      await Campaign.updateOne({ _id: created.id }, { $set: { spent: 6_000, status: 'exhausted' } });
      const exhaustedRes = await detail(created.id, creator.auth);
      expect(exhaustedRes.status).toBe(200);
      expect(exhaustedRes.body.campaign).toMatchObject({ status: 'exhausted', spent: 6_000, remaining: 0 });
    });

    it('answers 404 for a well-formed id that does not exist', async () => {
      const creator = await account('creator', 'creator@memes.test');

      const res = await detail(new mongoose.Types.ObjectId().toString(), creator.auth);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it.each(['not-an-id', '12345', 'zzzzzzzzzzzzzzzzzzzzzzzz'])('rejects malformed id %p with 400', async (id) => {
      const creator = await account('creator', 'creator@memes.test');

      const res = await detail(id, creator.auth);

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ path: 'id', message: 'must be a valid id' }],
      });
    });

    it('returns 401 without a token', async () => {
      const res = await detail(new mongoose.Types.ObjectId().toString());

      expect(res.status).toBe(401);
    });
  });
});
