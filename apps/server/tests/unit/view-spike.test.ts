import { viewSpikeRate } from '../../src/modules/submissions/view-spike';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// The threshold is 10,000 views an hour.
describe('viewSpikeRate', () => {
  it.each([
    ['steady growth', 1_000, 5_000, 2 * HOUR],
    ['a large gain spread over a day', 0, 100_000, 24 * HOUR],
    ['one view an hour short of the rate', 0, 19_999, 2 * HOUR],
    ['a small gain reported seconds after the last one', 9_500, 10_500, 2_000],
    ['the same count again', 60_000, 60_000, 10 * MINUTE],
  ])('does not flag %s', (_label, previousViews, views, elapsedMs) => {
    expect(viewSpikeRate({ previousViews, views, elapsedMs })).toBeNull();
  });

  it.each([
    ['a jump straight after submission', 0, 60_000, 5 * MINUTE, 60_000],
    ['exactly the rate over two hours', 0, 20_000, 2 * HOUR, 10_000],
    ['a fast gain on a post that already has views', 50_000, 120_000, 3 * HOUR, 23_333],
  ])('flags %s and reports the hourly rate', (_label, previousViews, views, elapsedMs, rate) => {
    expect(viewSpikeRate({ previousViews, views, elapsedMs })).toBe(rate);
  });

  it('treats any gain within an hour as taking a full hour, so tiny gaps cannot inflate the rate', () => {
    expect(viewSpikeRate({ previousViews: 0, views: 9_999, elapsedMs: 1 })).toBeNull();
    expect(viewSpikeRate({ previousViews: 0, views: 10_000, elapsedMs: 1 })).toBe(10_000);
    expect(viewSpikeRate({ previousViews: 0, views: 10_000, elapsedMs: 59 * MINUTE })).toBe(10_000);
  });

  it('applies the same one-hour floor when the clock stepped backwards', () => {
    expect(viewSpikeRate({ previousViews: 0, views: 10_000, elapsedMs: -5 * MINUTE })).toBe(10_000);
    expect(viewSpikeRate({ previousViews: 0, views: 9_999, elapsedMs: -5 * MINUTE })).toBeNull();
  });

  it('ignores where the counts sit on any milestone ladder', () => {
    // 9,999 -> 10,000 crosses the example ladder's first milestone but gains one view.
    expect(viewSpikeRate({ previousViews: 9_999, views: 10_000, elapsedMs: MINUTE })).toBeNull();
  });

  it('refuses a decreasing count, which the view update rejects before asking', () => {
    expect(() => viewSpikeRate({ previousViews: 5_000, views: 4_999, elapsedMs: HOUR })).toThrow(RangeError);
  });

  it.each([
    ['fractional views', { previousViews: 0, views: 10.5, elapsedMs: HOUR }],
    ['negative views', { previousViews: -1, views: 10, elapsedMs: HOUR }],
    ['an unsafe integer', { previousViews: 0, views: Number.MAX_SAFE_INTEGER + 1, elapsedMs: HOUR }],
    ['a missing elapsed time', { previousViews: 0, views: 10, elapsedMs: Number.NaN }],
  ])('refuses %s', (_label, growth) => {
    expect(() => viewSpikeRate(growth)).toThrow(RangeError);
  });
});
