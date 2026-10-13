import { mongo } from 'mongoose';

/** True when a write was rejected by a unique index (MongoDB error E11000). */
export function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof mongo.MongoServerError && error.code === 11000;
}
