// The view-spike rule: a review signal, never a payout decision. It sees only the counts
// this app records (the views feed is simulated), so it measures how fast those counts
// grew, not whether the views on the platform are real.

/** Views gained per hour at or above which an update is flagged as a spike. */
export const SPIKE_VIEWS_PER_HOUR = 10_000;

const HOUR_MS = 60 * 60 * 1000;

export interface ViewGrowth {
  /** The count recorded before this update. */
  previousViews: number;
  /** The count this update reports; never below previousViews. */
  views: number;
  /** Time since previousViews was recorded. */
  elapsedMs: number;
}

/**
 * The views gained per hour if the growth is a spike, otherwise null. Elapsed time is
 * floored at one hour: two reports seconds apart cannot turn a small gain into a huge
 * rate, so within an hour only a gain of SPIKE_VIEWS_PER_HOUR or more is flagged.
 * Milestones play no part, so crossing one is never a spike by itself.
 */
export function viewSpikeRate({ previousViews, views, elapsedMs }: ViewGrowth): number | null {
  for (const [name, value] of [['previousViews', previousViews], ['views', views]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative safe integer, got ${value}`);
    }
  }
  if (views < previousViews) {
    throw new RangeError(`views cannot decrease (from ${previousViews} to ${views})`);
  }
  if (Number.isNaN(elapsedMs)) throw new RangeError('elapsedMs must be a number');

  // A clock that stepped backwards gives a negative elapsed time; the floor covers it too.
  const hours = Math.max(elapsedMs, HOUR_MS) / HOUR_MS;
  const viewsPerHour = (views - previousViews) / hours;
  return viewsPerHour >= SPIKE_VIEWS_PER_HOUR ? Math.floor(viewsPerHour) : null;
}
