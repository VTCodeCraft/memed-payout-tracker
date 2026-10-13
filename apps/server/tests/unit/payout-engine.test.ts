import { eligiblePayout } from '../../src/modules/payouts/payout-engine';

// The assignment's example ladder.
const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
  { views: 100_000, payout: 5_000 },
];

describe('eligiblePayout', () => {
  it.each([
    ['zero views', 0, 0],
    ['one view below the first threshold', 9_999, 0],
    ['exactly the first threshold', 10_000, 500],
    ['just past the first threshold', 10_001, 500],
    ['one view below the second threshold', 49_999, 500],
    ['exactly the second threshold', 50_000, 2_000],
    ['between the second and third thresholds', 75_000, 2_000],
    ['exactly the highest threshold', 100_000, 5_000],
    ['far beyond the highest threshold', 10_000_000, 5_000],
  ])('%s (%i views) earns ₹%i', (_label, views, payout) => {
    expect(eligiblePayout(views, ladder)).toBe(payout);
  });

  it('pays only the highest milestone crossed, never the sum of crossed milestones', () => {
    // Jumping from 0 to 60,000 crosses 10k and 50k: ₹2,000, not ₹500 + ₹2,000.
    expect(eligiblePayout(60_000, ladder)).toBe(2_000);
  });

  it('handles a single-milestone ladder', () => {
    const single = [{ views: 1_000, payout: 300 }];

    expect(eligiblePayout(999, single)).toBe(0);
    expect(eligiblePayout(1_000, single)).toBe(300);
  });

  it.each([
    ['negative', -1],
    ['fractional', 10_000.5],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
    ['beyond the safe integer range', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s views instead of guessing', (_label, views) => {
    expect(() => eligiblePayout(views, ladder)).toThrow(RangeError);
  });

  it.each([
    ['an empty ladder', [], /at least one milestone/],
    [
      'decreasing thresholds',
      [
        { views: 50_000, payout: 500 },
        { views: 10_000, payout: 2_000 },
      ],
      /views must be greater/,
    ],
    [
      'decreasing payouts',
      [
        { views: 10_000, payout: 2_000 },
        { views: 50_000, payout: 500 },
      ],
      /payout must be greater/,
    ],
    ['a fractional payout', [{ views: 10_000, payout: 500.5 }], /milestone payout must be a non-negative safe integer/],
    ['a fractional threshold', [{ views: 10_000.5, payout: 500 }], /milestone views must be a non-negative safe integer/],
  ])('rejects %s', (_label, milestones, message) => {
    expect(() => eligiblePayout(10_000, milestones)).toThrow(message);
  });
});
