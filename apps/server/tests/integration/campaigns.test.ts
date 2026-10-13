import mongoose from 'mongoose';
import request from 'supertest';
import { connectToDatabase } from '../../src/db/connection';
import { signAccessToken } from '../../src/lib/jwt';
import { Campaign } from '../../src/models/campaign.model';
import { type Role, User } from '../../src/models/user.model';
import { TEST_JWT, createTestApp } from '../helpers/app';
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

/** Creates a real user and returns its id plus a matching Bearer header. */
async function account(role: Role, email: string) {
  const user = await User.create({ name: `${role} account`, email, role, passwordHash: 'not-used-in-these-tests' });
  return { id: user.id, auth: `Bearer ${signAccessToken({ id: user.id, role }, TEST_JWT)}` };
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
    const createAs = async (auth: string, name: string) =>
      (await request(app).post('/api/campaigns').set('Authorization', auth).send({ ...diwaliDrop, name })).body
        .campaign;
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
});
