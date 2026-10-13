import { z } from 'zod';

// Building blocks for request schemas: a missing field reads "is required"
// instead of zod's generic "expected string, received undefined".

export const requiredString = () =>
  z.string({ error: (issue) => (issue.input === undefined ? 'is required' : 'must be a string') });
