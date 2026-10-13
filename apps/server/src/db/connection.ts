import mongoose from 'mongoose';

/**
 * Opens the shared Mongoose connection. Rejects if no MongoDB server is reachable
 * within the timeout, so startup fails fast instead of hanging on a bad host or a
 * blocked IP allowlist.
 */
export async function connectToDatabase(uri: string, serverSelectionTimeoutMS = 10_000): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS });
}
