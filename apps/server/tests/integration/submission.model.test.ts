import mongoose from 'mongoose';
import { connectToDatabase } from '../../src/db/connection';
// Imported before connecting: connectToDatabase waits for indexes of registered models.
import { Submission } from '../../src/models/submission.model';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

const validSubmission = () => ({
  campaignId: new mongoose.Types.ObjectId(),
  creatorId: new mongoose.Types.ObjectId(),
  platform: 'instagram' as const,
  postUrl: '  https://www.instagram.com/reel/C8xYz12AbCd/?igsh=abc ',
  normalizedUrl: 'https://www.instagram.com/p/C8xYz12AbCd/',
});

/** Validation messages keyed by path, or {} when the document is valid. */
async function validationErrors(input: Record<string, unknown>) {
  try {
    await new Submission(input).validate();
    return {};
  } catch (error) {
    if (!(error instanceof mongoose.Error.ValidationError)) throw error;
    return Object.fromEntries(Object.entries(error.errors).map(([path, e]) => [path, e.message]));
  }
}

describe('Submission model', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await connectToDatabase(db.uri);
  }, 120_000);

  afterEach(async () => {
    await Submission.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await db.stop();
  });

  it('starts with no views and nothing eligible or paid', async () => {
    const submission = await Submission.create(validSubmission());

    expect(submission.postUrl).toBe('https://www.instagram.com/reel/C8xYz12AbCd/?igsh=abc');
    expect(submission).toMatchObject({ views: 0, eligiblePayout: 0, paidPayout: 0 });
  });

  it('has the unique and lookup indexes in place once connected', async () => {
    const indexes = await Submission.collection.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { normalizedUrl: 1 }, unique: true }),
        expect.objectContaining({ key: { creatorId: 1, createdAt: -1 } }),
        expect.objectContaining({ key: { campaignId: 1, createdAt: -1 } }),
      ]),
    );
  });

  it('rejects a second submission of the same normalised post, even for another campaign', async () => {
    await Submission.create(validSubmission());

    await expect(Submission.create(validSubmission())).rejects.toMatchObject({ code: 11000 });
    expect(await Submission.countDocuments()).toBe(1);
  });

  it('stores payout amounts as BSON int32', async () => {
    const { _id } = await Submission.create(validSubmission());

    const [types] = await Submission.collection
      .aggregate([{ $match: { _id } }, { $project: { e: { $type: '$eligiblePayout' }, p: { $type: '$paidPayout' } } }])
      .toArray();

    expect(types).toMatchObject({ e: 'int', p: 'int' });
  });

  it.each([
    ['negative views', { views: -1 }, 'views'],
    ['fractional views', { views: 10.5 }, 'views'],
    ['a negative eligible payout', { eligiblePayout: -1 }, 'eligiblePayout'],
    ['a fractional paid payout', { eligiblePayout: 500, paidPayout: 499.5 }, 'paidPayout'],
    ['paid above eligible', { eligiblePayout: 500, paidPayout: 501 }, 'paidPayout'],
    ['an unknown platform', { platform: 'tiktok' }, 'platform'],
    ['a missing normalised url', { normalizedUrl: undefined }, 'normalizedUrl'],
    ['a missing creator', { creatorId: undefined }, 'creatorId'],
  ])('rejects %s', async (_label, override, path) => {
    expect(await validationErrors({ ...validSubmission(), ...override })).toHaveProperty([path]);
  });

  it('keeps its campaign, creator and post fixed after creation', async () => {
    const submission = await Submission.create(validSubmission());
    const original = submission.toObject();

    submission.campaignId = new mongoose.Types.ObjectId();
    submission.creatorId = new mongoose.Types.ObjectId();
    submission.normalizedUrl = 'https://www.instagram.com/p/Other/';
    await submission.save();

    expect(await Submission.findById(submission.id).lean()).toMatchObject({
      campaignId: original.campaignId,
      creatorId: original.creatorId,
      normalizedUrl: original.normalizedUrl,
    });
  });
});
