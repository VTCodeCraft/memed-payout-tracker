import { z } from 'zod';

// Building blocks for request schemas: a missing field reads "is required"
// instead of zod's generic "expected string, received undefined".

export const requiredString = () =>
  z.string({ error: (issue) => (issue.input === undefined ? 'is required' : 'must be a string') });

export const requiredNumber = () =>
  z.number({ error: (issue) => (issue.input === undefined ? 'is required' : 'must be a number') });

/** A 24-character hex MongoDB ObjectId, checked before it can reach a query. */
export const objectId = () => requiredString().regex(/^[a-f\d]{24}$/i, 'must be a valid id');

/** Route parameters of the form /:id. */
export const idParamsSchema = z.object({ id: objectId() });
