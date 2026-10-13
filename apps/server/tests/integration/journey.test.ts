import mongoose from 'mongoose';
import request from 'supertest';
import { connectToDatabase } from '../../src/db/connection';
import { Submission } from '../../src/models/submission.model';
import { createTestApp } from '../helpers/app';
import { startTestDatabase, type TestDatabase } from '../helpers/database';
import { expectPayoutInvariants } from '../helpers/payout-invariants';

// Unlike the focused suites, nothing here is created through the models: every step
// goes through HTTP, the way the frontend drives the API.
const app = createTestApp();
const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
];

async function signUp(role: 'brand' | 'creator', email: string) {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ name: `${role} ${email}`, email, password: 'journey password', role });
  expect(res.status).toBe(201);
  return `Bearer ${res.body.token}`;
}

async function createCampaign(auth: string, totalBudget = 2_500) {
  const res = await request(app)
    .post('/api/campaigns')
    .set('Authorization', auth)
    .send({ name: 'Journey campaign', platform: 'instagram', totalBudget, milestones: ladder });
  expect(res.status).toBe(201);
  return res.body.campaign.id as string;
}

async function submit(auth: string, campaignId: string, postUrl: string) {
  return request(app).post('/api/submissions').set('Authorization', auth).send({ campaignId, postUrl });
}

const updateViews = (submissionId: string, views: number) =>
  request(app).patch(`/api/submissions/${submissionId}/views`).send({ views });

describe('brand-to-creator workflow through the API', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  it('runs from signup to payouts to earnings, keeping the money consistent at every step', async () => {
    // A brand signs up, logs in again, and creates a campaign.
    await signUp('brand', 'brand@journey.test');
    const brandLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'BRAND@journey.test', password: 'journey password' });
    expect(brandLogin.status).toBe(200);
    const brand = `Bearer ${brandLogin.body.token}`;
    const me = await request(app).get('/api/auth/me').set('Authorization', brand);
    expect(me.body.user).toMatchObject({ email: 'brand@journey.test', role: 'brand' });
    const campaignId = await createCampaign(brand);

    // A creator signs up and finds it among the live campaigns.
    const creator = await signUp('creator', 'creator@journey.test');
    const live = await request(app).get('/api/campaigns/live').set('Authorization', creator);
    expect(live.body.campaigns).toEqual([
      expect.objectContaining({ id: campaignId, status: 'live', spent: 0, remaining: 2_500, milestones: ladder }),
    ]);

    // Invalid links are refused with field-level reasons; valid ones are stored canonically.
    const noScheme = await submit(creator, campaignId, 'instagram.com/p/JourneyA1');
    expect(noScheme.status).toBe(400);
    expect(noScheme.body.error.details).toEqual([expect.objectContaining({ path: 'postUrl' })]);
    const wrongPlatform = await submit(creator, campaignId, 'https://youtu.be/dQw4w9WgXcQ');
    expect(wrongPlatform.body.error.code).toBe('PLATFORM_MISMATCH');

    const postA = await submit(creator, campaignId, 'https://www.instagram.com/reel/JourneyA1/?igsh=tracking');
    const postB = await submit(creator, campaignId, 'https://instagram.com/p/JourneyB2');
    expect([postA.status, postB.status]).toEqual([201, 201]);
    expect(postA.body.submission).toMatchObject({ normalizedUrl: 'https://www.instagram.com/p/JourneyA1/', views: 0 });
    const sameAsA = await submit(creator, campaignId, 'https://www.instagram.com/p/JourneyA1/');
    expect(sameAsA.body.error.code).toBe('DUPLICATE_POST');
    const a = postA.body.submission.id as string;
    const b = postB.body.submission.id as string;

    // View updates: each row is [submission, views, outcome, granted now, campaign remaining].
    const steps: [string, number, string, number, number][] = [
      [a, 9_999, 'no_new_payout', 0, 2_500],
      [a, 10_000, 'paid', 500, 2_000],
      [a, 10_000, 'no_change', 0, 2_000],
      [a, 60_000, 'paid', 1_500, 500],
      [b, 60_000, 'partial', 500, 0],
      [b, 200_000, 'budget_exhausted', 0, 0],
    ];
    for (const [id, views, outcome, grantedNow, remaining] of steps) {
      const res = await updateViews(id, views);
      expect(res.status).toBe(200);
      expect(res.body.allocation).toMatchObject({ outcome, grantedNow });
      expect(res.body.campaign.remaining).toBe(remaining);
      await expectPayoutInvariants(campaignId);
    }
    expect((await updateViews(a, 50_000)).body.error.code).toBe('VIEWS_DECREASED');

    // The brand sees the spend and each post's payout.
    const brandView = await request(app).get(`/api/campaigns/${campaignId}`).set('Authorization', brand);
    expect(brandView.body.campaign).toMatchObject({ spent: 2_500, remaining: 0, status: 'exhausted' });
    const brandPosts = await request(app).get(`/api/campaigns/${campaignId}/submissions`).set('Authorization', brand);
    expect(brandPosts.body.submissions.map(({ id, views, eligiblePayout, paidPayout }: Record<string, unknown>) => ({ id, views, eligiblePayout, paidPayout }))).toEqual([
      { id: b, views: 200_000, eligiblePayout: 2_000, paidPayout: 500 },
      { id: a, views: 60_000, eligiblePayout: 2_000, paidPayout: 2_000 },
    ]);

    // The creator's earnings match their posts and the stored records.
    const earnings = (await request(app).get('/api/submissions/earnings').set('Authorization', creator)).body.earnings;
    expect(earnings).toEqual({ totalPaid: 2_500, totalEligible: 4_000, totalUnfunded: 1_500, submissionCount: 2 });
    const mine = (await request(app).get('/api/submissions/mine').set('Authorization', creator)).body.submissions;
    const stored = await Submission.find({ _id: { $in: [a, b] } }).lean();
    for (const records of [mine, stored] as { eligiblePayout: number; paidPayout: number }[][]) {
      expect(records.reduce((sum, record) => sum + record.paidPayout, 0)).toBe(earnings.totalPaid);
      expect(records.reduce((sum, record) => sum + record.eligiblePayout, 0)).toBe(earnings.totalEligible);
    }

    // The exhausted campaign stops accepting posts and leaves the live list.
    expect((await submit(creator, campaignId, 'https://www.instagram.com/p/JourneyC3/')).body.error.code).toBe('CAMPAIGN_NOT_LIVE');
    expect((await request(app).get('/api/campaigns/live').set('Authorization', creator)).body.campaigns).toEqual([]);
  });

  it('keeps each account to its own data and role throughout the workflow', async () => {
    const brand = await signUp('brand', 'owner@isolation.test');
    const otherBrand = await signUp('brand', 'other-brand@isolation.test');
    const creator = await signUp('creator', 'poster@isolation.test');
    const otherCreator = await signUp('creator', 'other-creator@isolation.test');
    const campaignId = await createCampaign(brand, 6_000);
    const post = await submit(creator, campaignId, 'https://www.instagram.com/p/IsolationA1/');
    await updateViews(post.body.submission.id, 60_000);

    const as = (auth: string, path: string) => request(app).get(path).set('Authorization', auth);

    // Another brand can neither open the campaign nor list its posts, and lists none of its own.
    expect((await as(otherBrand, `/api/campaigns/${campaignId}`)).status).toBe(404);
    expect((await as(otherBrand, `/api/campaigns/${campaignId}/submissions`)).status).toBe(404);
    expect((await as(otherBrand, '/api/campaigns/mine')).body.campaigns).toEqual([]);

    // Another creator sees no posts and no money.
    expect((await as(otherCreator, '/api/submissions/mine')).body.submissions).toEqual([]);
    expect((await as(otherCreator, '/api/submissions/earnings')).body.earnings).toEqual({
      totalPaid: 0,
      totalEligible: 0,
      totalUnfunded: 0,
      submissionCount: 0,
    });

    // Each role is kept out of the other's endpoints, and anonymous requests out of both.
    expect((await as(creator, `/api/campaigns/${campaignId}/submissions`)).status).toBe(403);
    expect((await as(creator, '/api/campaigns/mine')).status).toBe(403);
    expect((await as(brand, '/api/submissions/mine')).status).toBe(403);
    expect((await as(brand, '/api/campaigns/live')).status).toBe(403);
    expect((await request(app).get('/api/submissions/earnings')).status).toBe(401);
  });
});
