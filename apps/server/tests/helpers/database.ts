import { MongoMemoryReplSet } from 'mongodb-memory-server';

export interface TestDatabase {
  uri: string;
  stop: () => Promise<void>;
}

/**
 * Starts an in-memory single-node replica set (Atlas is a replica set, and
 * transactions require one). The first run downloads the mongod binary.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  return {
    uri: replSet.getUri('memed_test'),
    stop: async () => {
      await replSet.stop();
    },
  };
}
