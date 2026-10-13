import { allocatePayout, eligiblePayout } from '../../src/modules/payouts/payout-engine';

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

describe('allocatePayout', () => {
  it.each([
    ['sufficient budget: pays everything owed', { eligiblePayout: 2_000, paidPayout: 0, remainingBudget: 6_000 }, 2_000, 2_000],
    ['only the difference after an earlier payout', { eligiblePayout: 5_000, paidPayout: 2_000, remainingBudget: 6_000 }, 3_000, 3_000],
    ['eligible equal to already paid: nothing more', { eligiblePayout: 2_000, paidPayout: 2_000, remainingBudget: 6_000 }, 0, 0],
    ['already paid above eligible: nothing, never negative', { eligiblePayout: 500, paidPayout: 2_000, remainingBudget: 6_000 }, 0, 0],
    ['zero remaining budget', { eligiblePayout: 2_000, paidPayout: 0, remainingBudget: 0 }, 2_000, 0],
    ['partially fundable: grants only what is left', { eligiblePayout: 2_000, paidPayout: 0, remainingBudget: 1_000 }, 2_000, 1_000],
    ['budget exactly equal to what is owed', { eligiblePayout: 2_000, paidPayout: 500, remainingBudget: 1_500 }, 1_500, 1_500],
    ['negative remaining budget treated as none', { eligiblePayout: 2_000, paidPayout: 0, remainingBudget: -50 }, 2_000, 0],
    ['nothing eligible yet', { eligiblePayout: 0, paidPayout: 0, remainingBudget: 6_000 }, 0, 0],
  ])('%s', (_label, amounts, owed, grant) => {
    expect(allocatePayout(amounts)).toEqual({ owed, grant });
  });

  it('never pays the same amount twice when the calculation is repeated', () => {
    let paid = 0;
    let remaining = 6_000;
    const payOnce = (eligible: number) => {
      const { grant } = allocatePayout({ eligiblePayout: eligible, paidPayout: paid, remainingBudget: remaining });
      paid += grant;
      remaining -= grant;
      return grant;
    };

    expect(payOnce(2_000)).toBe(2_000); // crossed 50k views
    expect(payOnce(2_000)).toBe(0); // same views reported again
    expect(payOnce(2_000)).toBe(0);
    expect(payOnce(5_000)).toBe(3_000); // later crossed 100k: only the difference
    expect(payOnce(5_000)).toBe(0);
    expect({ paid, remaining }).toEqual({ paid: 5_000, remaining: 1_000 });
  });

  it('keeps every grant within what is owed and what the budget allows', () => {
    const values = [0, 1, 499, 500, 2_000, 5_000];
    for (const eligible of values) {
      for (const paidPayout of values) {
        for (const remainingBudget of [-1, 0, 1, 499, 1_000, 6_000]) {
          const { owed, grant } = allocatePayout({ eligiblePayout: eligible, paidPayout, remainingBudget });

          expect(grant).toBeGreaterThanOrEqual(0);
          expect(grant).toBeLessThanOrEqual(owed);
          expect(grant).toBeLessThanOrEqual(Math.max(0, remainingBudget));
          expect(paidPayout + grant).toBeLessThanOrEqual(Math.max(eligible, paidPayout));
        }
      }
    }
  });

  it.each([
    ['a negative eligible payout', { eligiblePayout: -1, paidPayout: 0, remainingBudget: 6_000 }],
    ['a fractional eligible payout', { eligiblePayout: 500.5, paidPayout: 0, remainingBudget: 6_000 }],
    ['a negative paid payout', { eligiblePayout: 500, paidPayout: -1, remainingBudget: 6_000 }],
    ['an unsafe paid payout', { eligiblePayout: 500, paidPayout: Number.MAX_SAFE_INTEGER + 1, remainingBudget: 6_000 }],
    ['a fractional remaining budget', { eligiblePayout: 500, paidPayout: 0, remainingBudget: 999.5 }],
    ['a NaN remaining budget', { eligiblePayout: 500, paidPayout: 0, remainingBudget: Number.NaN }],
    ['an infinite remaining budget', { eligiblePayout: 500, paidPayout: 0, remainingBudget: Number.POSITIVE_INFINITY }],
  ])('rejects %s instead of guessing', (_label, amounts) => {
    expect(() => allocatePayout(amounts)).toThrow(RangeError);
  });
});
