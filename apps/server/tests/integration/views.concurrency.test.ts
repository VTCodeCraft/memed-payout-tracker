import mongoose from 'mongoose';
import request from 'supertest';
import { connectToDatabase } from '../../src/db/connection';
import { Campaign } from '../../src/models/campaign.model';
import { Submission } from '../../src/models/submission.model';
import { createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';
import { expectPayoutInvariants } from '../helpers/payout-invariants';

const app = createTestApp();

async function campaign(totalBudget: number, milestones: { views: number; payout: number }[]) {
  const created = await Campaign.create({
    brandId: new mongoose.Types.ObjectId(),
    name: 'Contended campaign',
    platform: 'instagram',
    totalBudget,
    milestones,
  });
  return created.id;
}

async function submissions(campaignId: string, count: number) {
  const created = await Submission.insertMany(
    Array.from({ length: count }, (_, i) => ({
      campaignId,
      creatorId: new mongoose.Types.ObjectId(),
      platform: 'instagram',
      postUrl: `https://www.instagram.com/p/Concurrent${i}/`,
      normalizedUrl: `https://www.instagram.com/p/Concurrent${i}/`,
    })),
  );
  return created.map((submission) => submission.id);
}

const setViews = (id: string, views: number) => request(app).patch(`/api/submissions/${id}/views`).send({ views });
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe('PATCH /api/submissions/:id/views under concurrency', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  afterEach(async () => {
    await Promise.all([Submission.deleteMany({}), Campaign.deleteMany({})]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  it('pays a submission once when the same update arrives ten times at once', async () => {
    const campaignId = await campaign(6_000, [
      { views: 10_000, payout: 500 },
      { views: 50_000, payout: 2_000 },
    ]);
    const [id] = await submissions(campaignId, 1);

    const responses = await Promise.all(Array.from({ length: 10 }, () => setViews(id!, 60_000)));

    expect(responses.map((res) => res.status)).toEqual(Array(10).fill(200));
    expect(sum(responses.map((res) => res.body.allocation.grantedNow))).toBe(2_000);
    expect(responses.filter((res) => res.body.allocation.grantedNow > 0)).toHaveLength(1);
    expect(await Submission.findById(id).lean()).toMatchObject({ views: 60_000, eligiblePayout: 2_000, paidPayout: 2_000 });
    expect((await Campaign.findById(campaignId))?.spent).toBe(2_000);
    await expectPayoutInvariants(campaignId);
  });

  it('never overspends when many submissions draw on the same budget at once', async () => {
    const campaignId = await campaign(2_500, [
      { views: 10_000, payout: 500 },
      { views: 50_000, payout: 2_000 },
    ]);
    const ids = await submissions(campaignId, 6); // 6 x 2,000 earned against 2,500

    const responses = await Promise.all(ids.map((id) => setViews(id, 50_000)));

    expect(responses.map((res) => res.status)).toEqual(Array(6).fill(200));
    expect(sum(responses.map((res) => res.body.allocation.grantedNow))).toBe(2_500);
    expect(responses.map((res) => res.body.allocation.outcome).sort()).toEqual([
      'budget_exhausted',
      'budget_exhausted',
      'budget_exhausted',
      'budget_exhausted',
      'paid',
      'partial',
    ]);
    const paid = (await Submission.find({ campaignId }).lean()).map((s) => s.paidPayout).sort((a, b) => a - b);
    expect(paid).toEqual([0, 0, 0, 0, 500, 2_000]);
    expect(await Campaign.findById(campaignId).lean()).toMatchObject({ spent: 2_500, status: 'exhausted' });
    await expectPayoutInvariants(campaignId);
  });

  it('keeps every invariant under interleaved, out-of-order updates to several submissions', async () => {
    const campaignId = await campaign(6_000, [
      { views: 10_000, payout: 500 },
      { views: 50_000, payout: 2_000 },
      { views: 100_000, payout: 5_000 },
    ]);
    const ids = await submissions(campaignId, 3); // each can earn 5,000; together 15,000 against 6,000
    const sequence = [10_000, 100_000, 50_000, 60_000, 100_000];

    const responses = await Promise.all(ids.flatMap((id) => sequence.map((views) => setViews(id, views))));

    // A lower count arriving after a higher one is legitimately rejected.
    for (const res of responses) {
      expect(res.status === 200 || (res.status === 409 && res.body.error.code === 'VIEWS_DECREASED')).toBe(true);
    }
    expect((await Submission.find({ campaignId }).lean()).map((s) => s.views)).toEqual([100_000, 100_000, 100_000]);
    // Demand exceeds the budget, so it must be spent exactly, never more.
    expect(await Campaign.findById(campaignId).lean()).toMatchObject({ spent: 6_000, status: 'exhausted' });
    await expectPayoutInvariants(campaignId);
  });

  it('rolls back the campaign spend when the submission write fails mid-transaction', async () => {
    const campaignId = await campaign(6_000, [
      { views: 10_000, payout: 500 },
      { views: 50_000, payout: 2_000 },
    ]);
    const [id] = await submissions(campaignId, 1);
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    // The campaign's spent is incremented first inside the transaction; then the
    // submission write fails.
    const failSubmissionWrite = jest
      .spyOn(Submission, 'findOneAndUpdate')
      .mockRejectedValueOnce(new Error('simulated write failure'));

    const failed = await setViews(id!, 60_000);

    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe('INTERNAL_ERROR');
    expect(failSubmissionWrite).toHaveBeenCalledTimes(1);
    expect(await Campaign.findById(campaignId).lean()).toMatchObject({ spent: 0, status: 'live' });
    expect(await Submission.findById(id).lean()).toMatchObject({ views: 0, eligiblePayout: 0, paidPayout: 0 });

    failSubmissionWrite.mockRestore();
    consoleError.mockRestore();

    const retried = await setViews(id!, 60_000);
    expect(retried.body.allocation).toEqual({ grantedNow: 2_000, unfundedPayout: 0, outcome: 'paid' });
    await expectPayoutInvariants(campaignId);
  });
});
