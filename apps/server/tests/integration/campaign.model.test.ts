import mongoose from 'mongoose';
import { connectToDatabase } from '../../src/db/connection';
import { Campaign } from '../../src/models/campaign.model';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

const validCampaign = () => ({
  brandId: new mongoose.Types.ObjectId(),
  name: '  Diwali Drop ',
  platform: 'instagram' as const,
  totalBudget: 6_000,
  milestones: [
    { views: 10_000, payout: 500 },
    { views: 50_000, payout: 2_000 },
    { views: 100_000, payout: 5_000 },
  ],
});

/** Validation messages keyed by path, or {} when the document is valid. */
async function validationErrors(input: Record<string, unknown>) {
  try {
    await new Campaign(input).validate();
    return {};
  } catch (error) {
    if (!(error instanceof mongoose.Error.ValidationError)) throw error;
    return Object.fromEntries(Object.entries(error.errors).map(([path, e]) => [path, e.message]));
  }
}

describe('Campaign model', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  afterEach(async () => {
    await Campaign.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  it('creates a live campaign with nothing spent', async () => {
    const campaign = await Campaign.create(validCampaign());

    expect(campaign.name).toBe('Diwali Drop');
    expect(campaign.spent).toBe(0);
    expect(campaign.status).toBe('live');
    expect(campaign.createdAt).toBeInstanceOf(Date);
  });

  it('stores money as BSON int32, never as a floating-point double', async () => {
    const { _id } = await Campaign.create(validCampaign());

    const [types] = await Campaign.collection
      .aggregate([
        { $match: { _id } },
        {
          $project: {
            totalBudget: { $type: '$totalBudget' },
            spent: { $type: '$spent' },
            payout: { $type: { $first: '$milestones.payout' } },
          },
        },
      ])
      .toArray();

    expect(types).toMatchObject({ totalBudget: 'int', spent: 'int', payout: 'int' });
  });

  it.each([
    ['a fractional budget', { totalBudget: 6_000.5 }, 'totalBudget'],
    ['a zero budget', { totalBudget: 0 }, 'totalBudget'],
    ['a budget beyond int32', { totalBudget: 2_147_483_648 }, 'totalBudget'],
    ['negative spending', { spent: -1 }, 'spent'],
    ['spending above the budget', { spent: 6_001 }, 'spent'],
    ['an unknown platform', { platform: 'tiktok' }, 'platform'],
    ['an unknown status', { status: 'paused' }, 'status'],
    ['an empty name', { name: '   ' }, 'name'],
  ])('rejects %s', async (_label, override, path) => {
    expect(await validationErrors({ ...validCampaign(), ...override })).toHaveProperty([path]);
  });

  it.each([
    ['a fractional payout', [{ views: 10_000, payout: 500.5 }], 'milestones.0.payout'],
    ['a fractional view threshold', [{ views: 10_000.5, payout: 500 }], 'milestones.0.views'],
    ['a zero view threshold', [{ views: 0, payout: 500 }], 'milestones.0.views'],
  ])('rejects a milestone with %s', async (_label, milestones, path) => {
    expect(await validationErrors({ ...validCampaign(), milestones })).toHaveProperty([path]);
  });

  it('applies the shared ladder rules', async () => {
    expect(await validationErrors({ ...validCampaign(), milestones: [] })).toEqual({
      milestones: 'must contain at least one milestone',
    });
    expect(await validationErrors({ ...validCampaign(), totalBudget: 4_000 })).toEqual({
      milestones: 'milestone 3: payout cannot exceed the total budget',
    });
  });

  it('keeps ownership, platform, budget and ladder fixed after creation', async () => {
    const campaign = await Campaign.create(validCampaign());
    const original = campaign.toObject();

    campaign.brandId = new mongoose.Types.ObjectId();
    campaign.platform = 'youtube';
    campaign.totalBudget = 1_000_000;
    campaign.set('milestones', [{ views: 1, payout: 1 }]);
    await campaign.save();

    const stored = await Campaign.findById(campaign.id).lean();
    expect(stored).toMatchObject({
      brandId: original.brandId,
      platform: 'instagram',
      totalBudget: 6_000,
      milestones: original.milestones,
    });
  });
});
