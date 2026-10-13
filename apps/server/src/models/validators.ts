/**
 * Lower bound for numeric schema paths. Int32 schema types silently ignore
 * Mongoose's `min` option, so money fields use this validator instead.
 */
export const atLeast = (minimum: number) => ({
  validator: (value: number) => value >= minimum,
  message: `must be at least ${minimum}`,
});
