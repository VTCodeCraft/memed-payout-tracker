import { Campaign } from '../../src/models/campaign.model';
import { Submission } from '../../src/models/submission.model';
import { eligiblePayout } from '../../src/modules/payouts/payout-engine';

/**
 * Asserts the money rules on the stored state of one campaign: spending stays
 * within budget and equals what its submissions were paid, no submission is paid
 * more than it earned, and the status matches the remaining budget.
 */
export async function expectPayoutInvariants(campaignId: string): Promise<void> {
  const campaign = await Campaign.findById(campaignId).lean();
  if (!campaign) throw new Error(`campaign ${campaignId} not found`);
  const submissions = await Submission.find({ campaignId }).lean();

  const totalPaid = submissions.reduce((sum, submission) => sum + submission.paidPayout, 0);
  expect(campaign.spent).toBeGreaterThanOrEqual(0);
  expect(campaign.spent).toBeLessThanOrEqual(campaign.totalBudget);
  expect(campaign.spent).toBe(totalPaid);
  expect(campaign.status).toBe(campaign.spent === campaign.totalBudget ? 'exhausted' : 'live');

  for (const submission of submissions) {
    expect(submission.paidPayout).toBeLessThanOrEqual(submission.eligiblePayout);
    expect(submission.eligiblePayout).toBe(eligiblePayout(submission.views, campaign.milestones));
  }
}
