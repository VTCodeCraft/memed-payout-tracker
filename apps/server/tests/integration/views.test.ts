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

// The assignment's example ladder with a budget of 6,000.
const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
  { views: 100_000, payout: 5_000 },
];

async function campaign(overrides: Record<string, unknown> = {}) {
  return Campaign.create({
    brandId: new mongoose.Types.ObjectId(),
    name: 'Diwali Drop',
    platform: 'instagram',
    totalBudget: 6_000,
    milestones: ladder,
    ...overrides,
  });
}

async function submission(campaignId: string, shortcode: string) {
  const created = await Submission.create({
    campaignId,
    creatorId: new mongoose.Types.ObjectId(),
    platform: 'instagram',
    postUrl: `https://www.instagram.com/p/${shortcode}/`,
    normalizedUrl: `https://www.instagram.com/p/${shortcode}/`,
  });
  return created.id;
}

const setViews = (id: string, body: unknown) => request(app).patch(`/api/submissions/${id}/views`).send(body as object);

describe('PATCH /api/submissions/:id/views', () => {
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

  describe('request contract', () => {
    it('needs no authentication or role, as the brief specifies', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'NoAuthPost1');
      const brand = await account('brand', 'brand@acme.test');

      expect((await setViews(id, { views: 10 })).status).toBe(200);
      const withToken = await request(app)
        .patch(`/api/submissions/${id}/views`)
        .set('Authorization', brand.auth)
        .send({ views: 20 });
      expect(withToken.status).toBe(200);
    });

    it('rejects a malformed submission id with 400', async () => {
      const res = await setViews('not-an-id', { views: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ path: 'id', message: 'must be a valid id' }]);
    });

    it('returns 404 for a submission that does not exist', async () => {
      const res = await setViews(new mongoose.Types.ObjectId().toString(), { views: 10 });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Submission not found' } });
    });

    it.each([
      ['a numeric string', { views: '60000' }, 'must be a number'],
      ['negative views', { views: -1 }, 'cannot be negative'],
      ['fractional views', { views: 10_000.5 }, 'must be a whole number'],
      ['missing views', {}, 'is required'],
    ])('rejects %s with 400 VALIDATION_ERROR and changes nothing', async (_label, body, message) => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'BadBodyPost');

      const res = await setViews(id, body);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path: 'views', message }] });
      expect(await Submission.findById(id).lean()).toMatchObject({ views: 0, eligiblePayout: 0, paidPayout: 0 });
    });

    it('rejects malformed JSON with 400 INVALID_JSON', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'BadJsonPost');

      const res = await request(app)
        .patch(`/api/submissions/${id}/views`)
        .set('Content-Type', 'application/json')
        .send('{"views": ');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });

    it('ignores payout and ownership fields in the body', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'ExtraFields1');

      const res = await setViews(id, { views: 8_000, paidPayout: 5_000, eligiblePayout: 5_000, campaignId: 'x' });

      expect(res.status).toBe(200);
      expect(res.body.submission).toMatchObject({ views: 8_000, eligiblePayout: 0, paidPayout: 0 });
      expect((await Campaign.findById(campaignId))?.spent).toBe(0);
    });
  });

  describe('payouts', () => {
    it('records views below the first milestone without paying anything', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'BelowFirst1');

      const res = await setViews(id, { views: 9_999 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        submission: expect.objectContaining({ views: 9_999, eligiblePayout: 0, paidPayout: 0 }),
        allocation: { grantedNow: 0, unfundedPayout: 0, outcome: 'no_new_payout' },
        campaign: { remaining: 6_000, status: 'live' },
      });
    });

    it('pays a milestone at exactly its threshold', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'ExactThresh');

      const res = await setViews(id, { views: 10_000 });

      expect(res.body.submission).toMatchObject({ views: 10_000, eligiblePayout: 500, paidPayout: 500 });
      expect(res.body.allocation).toEqual({ grantedNow: 500, unfundedPayout: 0, outcome: 'paid' });
      expect(res.body.campaign).toEqual({ remaining: 5_500, status: 'live' });
      expect((await Campaign.findById(campaignId))?.spent).toBe(500);
    });

    it('pays only the highest milestone when one update crosses several', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'JumpPost123');

      const res = await setViews(id, { views: 60_000 });

      expect(res.body.submission).toMatchObject({ eligiblePayout: 2_000, paidPayout: 2_000 });
      expect(res.body.allocation.grantedNow).toBe(2_000);
      expect((await Campaign.findById(campaignId))?.spent).toBe(2_000);
    });

    it('does not pay again when the same view count is reported repeatedly', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'RepeatPost1');
      await setViews(id, { views: 60_000 });

      const first = await setViews(id, { views: 60_000 });
      const second = await setViews(id, { views: 60_000 });

      for (const res of [first, second]) {
        expect(res.status).toBe(200);
        expect(res.body.allocation).toEqual({ grantedNow: 0, unfundedPayout: 0, outcome: 'no_change' });
      }
      expect((await Campaign.findById(campaignId))?.spent).toBe(2_000);
      expect((await Submission.findById(id))?.paidPayout).toBe(2_000);
    });

    it('pays only the difference when a higher milestone is reached later', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'LaterHigher');
      await setViews(id, { views: 60_000 });

      const res = await setViews(id, { views: 120_000 });

      expect(res.body.submission).toMatchObject({ eligiblePayout: 5_000, paidPayout: 5_000 });
      expect(res.body.allocation).toEqual({ grantedNow: 3_000, unfundedPayout: 0, outcome: 'paid' });
      expect((await Campaign.findById(campaignId))?.spent).toBe(5_000);
    });

    it('rejects a decreasing view count with 409 and leaves everything unchanged', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'DecreasePst');
      await setViews(id, { views: 60_000 });

      const res = await setViews(id, { views: 59_999 });

      expect(res.status).toBe(409);
      expect(res.body.error).toEqual({
        code: 'VIEWS_DECREASED',
        message: 'View count cannot decrease (current 60000, received 59999)',
      });
      expect(await Submission.findById(id).lean()).toMatchObject({ views: 60_000, paidPayout: 2_000 });
      expect((await Campaign.findById(campaignId))?.spent).toBe(2_000);
    });

    it('pays a partial amount when the budget cannot cover it, then marks the campaign exhausted', async () => {
      const { id: campaignId } = await campaign();
      const first = await submission(campaignId, 'BigEarner01');
      const second = await submission(campaignId, 'LateComer01');
      await setViews(first, { views: 120_000 }); // 5,000 of 6,000 spent

      const res = await setViews(second, { views: 50_000 }); // 2,000 earned, 1,000 left

      expect(res.body.submission).toMatchObject({ eligiblePayout: 2_000, paidPayout: 1_000 });
      expect(res.body.allocation).toEqual({ grantedNow: 1_000, unfundedPayout: 1_000, outcome: 'partial' });
      expect(res.body.campaign).toEqual({ remaining: 0, status: 'exhausted' });
      expect(await Campaign.findById(campaignId).lean()).toMatchObject({ spent: 6_000, status: 'exhausted' });
    });

    it('keeps recording views but pays nothing once the campaign is exhausted', async () => {
      const { id: campaignId } = await campaign({ spent: 6_000, status: 'exhausted' });
      const id = await submission(campaignId, 'AfterEmpty1');

      const res = await setViews(id, { views: 100_000 });

      expect(res.status).toBe(200);
      expect(res.body.submission).toMatchObject({ views: 100_000, eligiblePayout: 5_000, paidPayout: 0 });
      expect(res.body.allocation).toEqual({ grantedNow: 0, unfundedPayout: 5_000, outcome: 'budget_exhausted' });
      expect((await Campaign.findById(campaignId))?.spent).toBe(6_000);
    });

    it('exhausts the campaign exactly when its budget reaches zero, not before', async () => {
      const { id: campaignId } = await campaign({ totalBudget: 5_500 });
      const first = await submission(campaignId, 'ExactBudget');
      const second = await submission(campaignId, 'FillsBudget');

      const afterFirst = await setViews(first, { views: 100_000 }); // 5,000 of 5,500
      const afterSecond = await setViews(second, { views: 10_000 }); // the last 500

      expect(afterFirst.body.campaign).toEqual({ remaining: 500, status: 'live' });
      expect(afterSecond.body.allocation).toEqual({ grantedNow: 500, unfundedPayout: 0, outcome: 'paid' });
      expect(afterSecond.body.campaign).toEqual({ remaining: 0, status: 'exhausted' });
    });
  });
});
