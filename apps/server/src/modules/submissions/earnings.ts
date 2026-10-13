import { Types } from 'mongoose';
import { Submission } from '../../models/submission.model';

/**
 * A creator's totals in whole rupees. "Earnings" are what was actually paid;
 * eligible is what the views earned under the highest-milestone rule, and
 * unfunded is the part of that the campaign budgets could not cover.
 */
export interface CreatorEarnings {
  totalPaid: number;
  totalEligible: number;
  totalUnfunded: number;
  submissionCount: number;
}

const NO_EARNINGS: CreatorEarnings = { totalPaid: 0, totalEligible: 0, totalUnfunded: 0, submissionCount: 0 };

/** Sums one creator's submissions in a single aggregation (uses the creatorId index). */
export async function creatorEarnings(creatorId: string): Promise<CreatorEarnings> {
  const [totals] = await Submission.aggregate<CreatorEarnings>([
    { $match: { creatorId: new Types.ObjectId(creatorId) } },
    {
      $group: {
        _id: null,
        totalPaid: { $sum: '$paidPayout' },
        totalEligible: { $sum: '$eligiblePayout' },
        // Same per-submission rule as the payout engine: unfunded = max(0, eligible - paid).
        totalUnfunded: { $sum: { $max: [0, { $subtract: ['$eligiblePayout', '$paidPayout'] }] } },
        submissionCount: { $sum: 1 },
      },
    },
    { $project: { _id: 0, totalPaid: 1, totalEligible: 1, totalUnfunded: 1, submissionCount: 1 } },
  ]);
  return totals ?? NO_EARNINGS;
}
