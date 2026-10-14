import mongoose from 'mongoose';
import request from 'supertest';
import { connectToDatabase } from '../../src/db/connection';
import { Campaign } from '../../src/models/campaign.model';
import { Submission } from '../../src/models/submission.model';
import { User } from '../../src/models/user.model';
import { account } from '../helpers/accounts';
import { createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

const app = createTestApp();
const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
];
const REEL = 'https://www.instagram.com/reel/C8xYz12AbCd/?igsh=abc';

/** Inserts a campaign directly (campaign endpoints are covered by their own tests). */
async function campaign(brandId: string, overrides: Record<string, unknown> = {}) {
  const created = await Campaign.create({
    brandId,
    name: 'Diwali Drop',
    platform: 'instagram',
    totalBudget: 6_000,
    milestones: ladder,
    ...overrides,
  });
  return created.id;
}

const submit = (auth: string | undefined, body: object) => {
  const req = request(app).post('/api/submissions').send(body);
  return auth === undefined ? req : req.set('Authorization', auth);
};

describe('submission endpoints', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  afterEach(async () => {
    await Promise.all([Submission.deleteMany({}), Campaign.deleteMany({}), User.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  describe('POST /api/submissions', () => {
    it('creates a submission owned by the authenticated creator', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id);

      const res = await submit(creator.auth, { campaignId, postUrl: `  ${REEL}  ` });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        submission: {
          id: expect.any(String),
          campaignId,
          platform: 'instagram',
          postUrl: REEL,
          normalizedUrl: 'https://www.instagram.com/p/C8xYz12AbCd/',
          views: 0,
          eligiblePayout: 0,
          paidPayout: 0,
          viewSpike: null,
          createdAt: expect.any(String),
        },
      });
      expect((await Submission.findById(res.body.submission.id))?.creatorId.toString()).toBe(creator.id);
    });

    it('ignores client-supplied ownership, views and payouts', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const otherCreator = await account('creator', 'other@memes.test');
      const campaignId = await campaign(brand.id);

      const res = await submit(creator.auth, {
        campaignId,
        postUrl: REEL,
        creatorId: otherCreator.id,
        views: 1_000_000,
        eligiblePayout: 2_000,
        paidPayout: 2_000,
      });

      expect(res.status).toBe(201);
      expect(res.body.submission).toMatchObject({ views: 0, eligiblePayout: 0, paidPayout: 0 });
      expect((await Submission.findById(res.body.submission.id))?.creatorId.toString()).toBe(creator.id);
    });

    it('accepts YouTube posts for a YouTube campaign', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id, { platform: 'youtube' });

      const res = await submit(creator.auth, { campaignId, postUrl: 'https://youtu.be/dQw4w9WgXcQ?si=x' });

      expect(res.status).toBe(201);
      expect(res.body.submission).toMatchObject({
        platform: 'youtube',
        normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });
    });

    it('returns 401 without a token and 403 for a brand', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const campaignId = await campaign(brand.id);

      expect((await submit(undefined, { campaignId, postUrl: REEL })).status).toBe(401);
      const res = await submit(brand.auth, { campaignId, postUrl: REEL });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(await Submission.countDocuments()).toBe(0);
    });

    it.each([
      ['a malformed campaign id', { campaignId: 'nope', postUrl: REEL }, 'campaignId', 'must be a valid id'],
      [
        'a link that is not a post',
        { postUrl: 'https://www.instagram.com/memepage_99/' },
        'postUrl',
        'must be a link to a single Instagram post or reel, or a YouTube video',
      ],
      ['a blank link', { postUrl: '   ' }, 'postUrl', 'is required'],
      ['a missing link', { postUrl: undefined }, 'postUrl', 'is required'],
    ])('rejects %s with 400 VALIDATION_ERROR', async (_label, body, path, message) => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id);

      const res = await submit(creator.auth, { campaignId, ...body });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toContainEqual({ path, message });
    });

    it('returns 404 for a campaign that does not exist', async () => {
      const creator = await account('creator', 'creator@memes.test');

      const res = await submit(creator.auth, { campaignId: new mongoose.Types.ObjectId().toString(), postUrl: REEL });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
    });

    it('returns 409 CAMPAIGN_NOT_LIVE for an exhausted campaign', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id, { spent: 6_000, status: 'exhausted' });

      const res = await submit(creator.auth, { campaignId, postUrl: REEL });

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'CAMPAIGN_NOT_LIVE',
        message: 'This campaign is no longer accepting submissions',
      });
      expect(await Submission.countDocuments()).toBe(0);
    });

    it('returns 400 PLATFORM_MISMATCH for a post from the other platform', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id);

      const res = await submit(creator.auth, { campaignId, postUrl: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'PLATFORM_MISMATCH',
        message: 'This campaign only accepts instagram posts',
      });
    });

    it('rejects the same post in another link format, by any creator, for any campaign', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const otherCreator = await account('creator', 'other@memes.test');
      const firstCampaign = await campaign(brand.id);
      const secondCampaign = await campaign(brand.id, { name: 'Holi Hype' });
      await submit(creator.auth, { campaignId: firstCampaign, postUrl: REEL });

      const res = await submit(otherCreator.auth, {
        campaignId: secondCampaign,
        postUrl: 'http://instagram.com/p/C8xYz12AbCd?utm_source=copy',
      });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: { code: 'DUPLICATE_POST', message: 'This post has already been submitted' } });
      expect(await Submission.countDocuments()).toBe(1);
    });

    it('treats shortcodes that differ only in case as different posts', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id);

      const upper = await submit(creator.auth, { campaignId, postUrl: 'https://www.instagram.com/p/AbCdEfG/' });
      const lower = await submit(creator.auth, { campaignId, postUrl: 'https://www.instagram.com/p/abcdefg/' });

      expect([upper.status, lower.status]).toEqual([201, 201]);
    });

    it('lets exactly one of several simultaneous duplicate submissions succeed', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id);

      const responses = await Promise.all(Array.from({ length: 5 }, () => submit(creator.auth, { campaignId, postUrl: REEL })));

      expect(responses.map((res) => res.status).sort()).toEqual([201, 409, 409, 409, 409]);
      expect(await Submission.countDocuments()).toBe(1);
    });
  });

  describe('GET /api/submissions/mine', () => {
    const mine = (auth?: string, query = '') => {
      const req = request(app).get(`/api/submissions/mine${query}`);
      return auth === undefined ? req : req.set('Authorization', auth);
    };

    it("returns only the authenticated creator's submissions, newest first", async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const otherCreator = await account('creator', 'other@memes.test');
      const campaignId = await campaign(brand.id);
      const first = (await submit(creator.auth, { campaignId, postUrl: 'https://www.instagram.com/p/FirstPost1/' })).body;
      await submit(otherCreator.auth, { campaignId, postUrl: 'https://www.instagram.com/p/OtherPost1/' });
      const second = (await submit(creator.auth, { campaignId, postUrl: 'https://www.instagram.com/p/SecondPost/' })).body;

      const res = await mine(creator.auth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ submissions: [second.submission, first.submission] });
    });

    it('cannot be pointed at another creator through query parameters', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const otherCreator = await account('creator', 'other@memes.test');
      await submit(otherCreator.auth, { campaignId: await campaign(brand.id), postUrl: REEL });

      const res = await mine(creator.auth, `?creatorId=${otherCreator.id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ submissions: [] });
    });

    it('returns 401 without a token and 403 for a brand', async () => {
      const brand = await account('brand', 'brand@acme.test');

      expect((await mine()).status).toBe(401);
      const res = await mine(brand.auth);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/campaigns/:id/submissions', () => {
    const forCampaign = (id: string, auth?: string) => {
      const req = request(app).get(`/api/campaigns/${id}/submissions`);
      return auth === undefined ? req : req.set('Authorization', auth);
    };

    it("returns a brand's own campaign submissions from every creator, newest first", async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const otherCreator = await account('creator', 'other@memes.test');
      const campaignId = await campaign(brand.id);
      const otherCampaignId = await campaign(brand.id, { name: 'Holi Hype' });
      const first = (await submit(creator.auth, { campaignId, postUrl: 'https://www.instagram.com/p/FirstPost1/' })).body;
      const second = (await submit(otherCreator.auth, { campaignId, postUrl: 'https://www.instagram.com/p/SecondPost/' }))
        .body;
      await submit(creator.auth, { campaignId: otherCampaignId, postUrl: 'https://www.instagram.com/p/ElsewhereX/' });

      const res = await forCampaign(campaignId, brand.auth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ submissions: [second.submission, first.submission] });
    });

    it('returns an empty list for a campaign without submissions', async () => {
      const brand = await account('brand', 'brand@acme.test');

      const res = await forCampaign(await campaign(brand.id), brand.auth);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ submissions: [] });
    });

    it("answers 404 for another brand's campaign, exactly like a missing one", async () => {
      const acme = await account('brand', 'brand@acme.test');
      const globex = await account('brand', 'brand@globex.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(acme.id);
      await submit(creator.auth, { campaignId, postUrl: REEL });

      const otherBrand = await forCampaign(campaignId, globex.auth);
      const missing = await forCampaign(new mongoose.Types.ObjectId().toString(), globex.auth);

      expect(otherBrand.status).toBe(404);
      expect(otherBrand.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } });
      expect(missing.body).toEqual(otherBrand.body);
    });

    it('rejects a malformed campaign id with 400', async () => {
      const brand = await account('brand', 'brand@acme.test');

      const res = await forCampaign('not-an-id', brand.auth);

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ path: 'id', message: 'must be a valid id' }]);
    });

    it('returns 401 without a token and 403 for a creator', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const creator = await account('creator', 'creator@memes.test');
      const campaignId = await campaign(brand.id);

      expect((await forCampaign(campaignId)).status).toBe(401);
      const res = await forCampaign(campaignId, creator.auth);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
