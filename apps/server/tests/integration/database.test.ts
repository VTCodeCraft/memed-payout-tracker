import mongoose from 'mongoose';
import { connectToDatabase } from '../../src/db/connection';
import { startTestDatabase, type TestDatabase } from '../helpers/database';

describe('connectToDatabase', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  }, 120_000);

  afterEach(async () => {
    await mongoose.disconnect();
  });

  afterAll(async () => {
    await db.stop();
  });

  it('connects to the database named in the URI', async () => {
    await connectToDatabase(db.uri);

    expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.connected);
    expect(mongoose.connection.name).toBe('memed_test');
    await expect(mongoose.connection.db?.admin().ping()).resolves.toMatchObject({ ok: 1 });
  });

  it('rejects quickly when MongoDB is unreachable, without leaking credentials', async () => {
    const unreachable = 'mongodb://memed_app:s3cr3t-pa55@127.0.0.1:1/memed_test';

    const error: unknown = await connectToDatabase(unreachable, 500).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(mongoose.Error.MongooseServerSelectionError);
    expect((error as Error).message).not.toContain('s3cr3t-pa55');
    expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.disconnected);
  });
});
