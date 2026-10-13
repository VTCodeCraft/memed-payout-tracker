import { idParamsSchema } from '../../src/lib/validation';
import { updateViewsSchema } from '../../src/modules/submissions/submissions.schemas';

/** The first validation message for a views body, or undefined when it is valid. */
function viewsError(body: unknown): string | undefined {
  const result = updateViewsSchema.safeParse(body);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('updateViewsSchema', () => {
  it.each([0, 1, 9_999, 10_000, 2_147_483_648, Number.MAX_SAFE_INTEGER])('accepts %i views', (views) => {
    expect(updateViewsSchema.parse({ views })).toEqual({ views });
  });

  it('keeps only views, dropping payout fields and anything else', () => {
    expect(
      updateViewsSchema.parse({ views: 60_000, paidPayout: 999_999, eligiblePayout: 5, campaignId: 'x', status: 'live' }),
    ).toEqual({ views: 60_000 });
  });

  it.each([
    ['missing', {}, 'is required'],
    ['a numeric string', { views: '60000' }, 'must be a number'],
    ['null', { views: null }, 'must be a number'],
    ['negative', { views: -1 }, 'cannot be negative'],
    ['fractional', { views: 10_000.5 }, 'must be a whole number'],
    // Beyond 2^53 a number can no longer represent every whole value exactly.
    ['beyond the safe integer range', { views: Number.MAX_SAFE_INTEGER + 1 }, 'must be a whole number'],
  ])('rejects %s views', (_label, body, message) => {
    expect(viewsError(body)).toContain(message);
  });

  it('rejects a body that is not an object', () => {
    expect(updateViewsSchema.safeParse(60_000).success).toBe(false);
    expect(updateViewsSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('idParamsSchema', () => {
  it('accepts a 24-character hex id', () => {
    expect(idParamsSchema.parse({ id: '66f1c0ffee66f1c0ffee66f1' })).toEqual({ id: '66f1c0ffee66f1c0ffee66f1' });
  });

  it.each(['not-an-id', '66f1c0ffee', 'zzzzzzzzzzzzzzzzzzzzzzzz'])('rejects %p', (id) => {
    expect(idParamsSchema.safeParse({ id }).success).toBe(false);
  });
});
