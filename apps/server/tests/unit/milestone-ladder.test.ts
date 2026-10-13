import { milestoneLadderProblem } from '../../src/models/campaign.model';

const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
  { views: 100_000, payout: 5_000 },
];

describe('milestoneLadderProblem', () => {
  it('accepts the assignment example ladder within budget', () => {
    expect(milestoneLadderProblem(ladder, 6_000)).toBeUndefined();
  });

  it('accepts a single milestone whose payout equals the whole budget', () => {
    expect(milestoneLadderProblem([{ views: 1_000, payout: 300 }], 300)).toBeUndefined();
  });

  it('requires at least one milestone', () => {
    expect(milestoneLadderProblem([], 6_000)).toBe('must contain at least one milestone');
  });

  it('allows at most 10 milestones', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({ views: (i + 1) * 1_000, payout: (i + 1) * 10 }));

    expect(milestoneLadderProblem(eleven, 1_000_000)).toBe('must contain at most 10 milestones');
    expect(milestoneLadderProblem(eleven.slice(0, 10), 1_000_000)).toBeUndefined();
  });

  it.each([
    ['equal', 10_000],
    ['decreasing', 9_000],
  ])('rejects %s view thresholds', (_label, views) => {
    expect(milestoneLadderProblem([ladder[0]!, { views, payout: 2_000 }], 6_000)).toBe(
      'milestone 2: views must be greater than the previous milestone',
    );
  });

  it.each([
    ['equal', 500],
    ['decreasing', 400],
  ])('rejects %s payouts', (_label, payout) => {
    expect(milestoneLadderProblem([ladder[0]!, { views: 50_000, payout }], 6_000)).toBe(
      'milestone 2: payout must be greater than the previous milestone',
    );
  });

  it('rejects a payout above the total budget', () => {
    expect(milestoneLadderProblem(ladder, 4_999)).toBe('milestone 3: payout cannot exceed the total budget');
  });
});
