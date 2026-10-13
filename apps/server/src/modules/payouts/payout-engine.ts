import { type Milestone, milestoneLadderProblem } from '../../models/campaign.model';

// Pure payout rules: no I/O, whole-rupee integers only. Inputs are validated
// upstream (request schemas, models); anything invalid reaching here is a bug, so
// it throws instead of computing money from bad numbers.

function assertWholeNumber(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer, got ${value}`);
  }
}

/**
 * The payout of the highest milestone the views have reached (threshold
 * inclusive), or 0 if none is reached. Tiers replace each other; they never add up.
 */
export function eligiblePayout(views: number, milestones: readonly Milestone[]): number {
  assertWholeNumber(views, 'views');
  const problem = milestoneLadderProblem(milestones);
  if (problem) throw new RangeError(`Invalid milestone ladder: ${problem}`);

  let payout = 0;
  for (const milestone of milestones) {
    assertWholeNumber(milestone.views, 'milestone views');
    assertWholeNumber(milestone.payout, 'milestone payout');
    if (views < milestone.views) break; // ascending ladder: no later tier can be reached
    payout = milestone.payout;
  }
  return payout;
}
