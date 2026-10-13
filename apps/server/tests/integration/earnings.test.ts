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
  { views: 100_000, payout: 5_000 },
];

async function campaign(overrides: Record<string, unknown> = {}) {
  const created = await Campaign.create({
    brandId: new mongoose.Types.ObjectId(),
    name: 'Diwali Drop',
    platform: 'instagram',
    totalBudget: 6_000,
    milestones: ladder,
    ...overrides,
  });
  return created.id;
}

/** Creates a submission and drives its payout through the real views endpoint. */
async function postWithViews(creatorId: string, campaignId: string, shortcode: string, views: number) {
  const { id } = await Submission.create({
    campaignId,
    creatorId,
    platform: 'instagram',
    postUrl: `https://www.instagram.com/p/${shortcode}/`,
    normalizedUrl: `https://www.instagram.com/p/${shortcode}/`,
  });
  if (views > 0) {
    const res = await request(app).patch(`/api/submissions/${id}/views`).send({ views });
    expect(res.status).toBe(200);
  }
}

const earnings = (auth?: string, query = '') => {
  const req = request(app).get(`/api/submissions/earnings${query}`);
  return auth === undefined ? req : req.set('Authorization', auth);
};

describe('GET /api/submissions/earnings', () => {
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

  it('returns zeros for a creator with no submissions', async () => {
    const creator = await account('creator', 'creator@memes.test');

    const res = await earnings(creator.auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      earnings: { totalPaid: 0, totalEligible: 0, totalUnfunded: 0, submissionCount: 0 },
    });
  });

  it('totals paid, eligible and unfunded amounts across campaigns, including a partial payout', async () => {
    const creator = await account('creator', 'creator@memes.test');
    const diwali = await campaign(); // budget 6,000
    const holi = await campaign({ name: 'Holi Hype', totalBudget: 10_000 });
    await postWithViews(creator.id, diwali, 'BigEarner01', 120_000); // eligible 5,000, paid 5,000
    await postWithViews(creator.id, diwali, 'PartialPay1', 50_000); // eligible 2,000, paid the last 1,000
    await postWithViews(creator.id, holi, 'SmallPost01', 10_000); // eligible 500, paid 500
    await postWithViews(creator.id, holi, 'NoViewsYet1', 0); // nothing yet

    const res = await earnings(creator.auth);

    expect(res.body).toEqual({
      earnings: { totalPaid: 6_500, totalEligible: 7_500, totalUnfunded: 1_000, submissionCount: 4 },
    });
    expect((await Campaign.findById(diwali))?.status).toBe('exhausted');
  });

  it('counts views earned on an already exhausted campaign as eligible but unfunded', async () => {
    const creator = await account('creator', 'creator@memes.test');
    const exhausted = await campaign({ spent: 6_000, status: 'exhausted' });
    await postWithViews(creator.id, exhausted, 'TooLate0001', 100_000);

    const res = await earnings(creator.auth);

    expect(res.body.earnings).toEqual({ totalPaid: 0, totalEligible: 5_000, totalUnfunded: 5_000, submissionCount: 1 });
  });

  it("never includes another creator's submissions, even when asked through the query string", async () => {
    const creator = await account('creator', 'creator@memes.test');
    const other = await account('creator', 'other@memes.test');
    const shared = await campaign({ totalBudget: 20_000 });
    await postWithViews(creator.id, shared, 'MinePost001', 10_000);
    await postWithViews(other.id, shared, 'TheirPost01', 120_000);

    const mine = await earnings(creator.auth);
    const tampered = await earnings(creator.auth, `?creatorId=${other.id}`);
    const theirs = await earnings(other.auth);

    expect(mine.body.earnings).toEqual({ totalPaid: 500, totalEligible: 500, totalUnfunded: 0, submissionCount: 1 });
    expect(tampered.body).toEqual(mine.body);
    expect(theirs.body.earnings).toEqual({ totalPaid: 5_000, totalEligible: 5_000, totalUnfunded: 0, submissionCount: 1 });
  });

  it('returns 401 without a token and 403 for a brand', async () => {
    const brand = await account('brand', 'brand@acme.test');

    expect((await earnings()).status).toBe(401);
    const res = await earnings(brand.auth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
