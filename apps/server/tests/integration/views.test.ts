import mongoose from 'mongoose';
import request from 'supertest';
import { connectToDatabase } from '../../src/db/connection';
import { Campaign } from '../../src/models/campaign.model';
import { Submission } from '../../src/models/submission.model';
import { User } from '../../src/models/user.model';
import { account } from '../helpers/accounts';
import { createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';
import { expectPayoutInvariants } from '../helpers/payout-invariants';

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

const HOUR = 60 * 60 * 1000;

/** Backdates when the current count was recorded, as if the feed's next report came later. */
async function recordedAgo(id: string, ms: number, fields: { createdAt?: Date } = {}) {
  // The raw driver skips Mongoose's timestamps, which would otherwise reset updatedAt.
  await Submission.collection.updateOne(
    { _id: new mongoose.Types.ObjectId(id) },
    { $set: { updatedAt: new Date(Date.now() - ms), ...fields } },
  );
}

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
        viewSpikeDetected: false,
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

  describe('view spikes', () => {
    it('flags a fast jump and pays exactly what an unflagged update would', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'SpikeJump01');

      const res = await setViews(id, { views: 60_000 }); // straight after submission

      expect(res.status).toBe(200);
      expect(res.body.viewSpikeDetected).toBe(true);
      expect(res.body.submission.viewSpike).toEqual({ detectedAt: expect.any(String), fromViews: 0, toViews: 60_000, viewsPerHour: 60_000 });
      expect(res.body.submission).toMatchObject({ views: 60_000, eligiblePayout: 2_000, paidPayout: 2_000 });
      expect(res.body.allocation).toEqual({ grantedNow: 2_000, unfundedPayout: 0, outcome: 'paid' });
      expect(res.body.campaign).toEqual({ remaining: 4_000, status: 'live' });
      expect((await Submission.findById(id).lean())?.viewSpike).toMatchObject({ fromViews: 0, toViews: 60_000, viewsPerHour: 60_000 });
      await expectPayoutInvariants(campaignId);
    });

    it('does not flag ordinary growth, even when it crosses milestones', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'SteadyGrow1');

      expect((await setViews(id, { views: 9_000 })).body.viewSpikeDetected).toBe(false); // under 10,000 in the first hour
      await recordedAgo(id, 2 * HOUR);
      const crossesFirst = await setViews(id, { views: 10_500 }); // +1,500 in two hours
      await recordedAgo(id, 24 * HOUR);
      const crossesTwoMore = await setViews(id, { views: 100_000 }); // +89,500 in a day

      expect(crossesFirst.body).toMatchObject({ viewSpikeDetected: false, allocation: { grantedNow: 500, outcome: 'paid' } });
      expect(crossesTwoMore.body).toMatchObject({ viewSpikeDetected: false, allocation: { grantedNow: 4_500, outcome: 'paid' } });
      expect(crossesTwoMore.body.submission).toMatchObject({ eligiblePayout: 5_000, paidPayout: 5_000, viewSpike: null });
    });

    it('measures from the previous recorded count, not from when the post was submitted', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'OldPostJump');
      await setViews(id, { views: 50_000 });
      // Submitted three days ago; the last count arrived ten minutes ago.
      await recordedAgo(id, 10 * 60 * 1000, { createdAt: new Date(Date.now() - 72 * HOUR) });

      const res = await setViews(id, { views: 70_000 }); // +20,000 within the hour

      expect(res.body.viewSpikeDetected).toBe(true);
      expect(res.body.submission.viewSpike).toMatchObject({ fromViews: 50_000, toViews: 70_000, viewsPerHour: 20_000 });
    });

    it('keeps the latest spike as evidence after later ordinary updates', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'KeepsSpike1');
      const spike = (await setViews(id, { views: 60_000 })).body.submission.viewSpike;
      await recordedAgo(id, 5 * HOUR);

      const res = await setViews(id, { views: 70_000 }); // 2,000 an hour

      expect(res.body.viewSpikeDetected).toBe(false);
      expect(res.body.submission.viewSpike).toEqual(spike);
    });

    it('neither flags nor restarts the clock when the same count is reported again', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'RepeatClock');
      await setViews(id, { views: 9_000 });
      await recordedAgo(id, 2 * HOUR);

      const repeat = await setViews(id, { views: 9_000 });
      // +15,000 since the count was recorded two hours ago: 7,500 an hour. Had the repeat
      // restarted the clock, the same gain would look like 15,000 within the hour.
      const next = await setViews(id, { views: 24_000 });

      expect(repeat.body).toMatchObject({ viewSpikeDetected: false, allocation: { outcome: 'no_change' } });
      expect(next.body.viewSpikeDetected).toBe(false);
      expect(next.body.submission.viewSpike).toBeNull();
    });

    it('records no spike for a decreasing or invalid count', async () => {
      const { id: campaignId } = await campaign();
      const id = await submission(campaignId, 'RejectSpike');
      await setViews(id, { views: 9_000 });

      const responses = [
        await setViews(id, { views: 8_000 }),
        await setViews(id, { views: 90_000.5 }),
        await setViews(id, { views: -90_000 }),
        await setViews(id, { views: '90000' }),
      ];

      expect(responses.map((res) => res.status)).toEqual([409, 400, 400, 400]);
      const stored = await Submission.findById(id).lean();
      expect(stored?.views).toBe(9_000);
      expect(stored?.viewSpike).toBeUndefined();
    });

    it('still flags once the budget is spent, without paying any more', async () => {
      const { id: campaignId } = await campaign();
      await setViews(await submission(campaignId, 'TakesMost01'), { views: 100_000 }); // 5,000 of 6,000
      const id = await submission(campaignId, 'SpikeBroke1');

      const partial = await setViews(id, { views: 60_000 }); // owed 2,000, 1,000 left
      const afterEmpty = await setViews(id, { views: 160_000 }); // +100,000 within the hour

      expect(partial.body).toMatchObject({ viewSpikeDetected: true, allocation: { grantedNow: 1_000, unfundedPayout: 1_000, outcome: 'partial' } });
      expect(afterEmpty.body).toMatchObject({
        viewSpikeDetected: true,
        allocation: { grantedNow: 0, unfundedPayout: 4_000, outcome: 'budget_exhausted' },
        campaign: { remaining: 0, status: 'exhausted' },
      });
      expect(afterEmpty.body.submission.viewSpike).toMatchObject({ fromViews: 60_000, toViews: 160_000 });
      expect((await Campaign.findById(campaignId))?.spent).toBe(6_000);
      await expectPayoutInvariants(campaignId);
    });

    it('shows the flag in the brand’s list of the campaign’s submissions', async () => {
      const brand = await account('brand', 'brand@acme.test');
      const { id: campaignId } = await campaign({ brandId: brand.id });
      const id = await submission(campaignId, 'BrandSees01');
      await setViews(id, { views: 60_000 });

      const res = await request(app).get(`/api/campaigns/${campaignId}/submissions`).set('Authorization', brand.auth);

      expect(res.status).toBe(200);
      expect(res.body.submissions[0].viewSpike).toMatchObject({ fromViews: 0, toViews: 60_000, viewsPerHour: 60_000 });
    });
  });
});
