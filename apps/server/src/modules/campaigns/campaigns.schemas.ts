import { z } from 'zod';
import { objectId, requiredNumber, requiredString } from '../../lib/validation';
import { MAX_RUPEES, PLATFORMS, milestoneLadderProblem } from '../../models/campaign.model';

const rupees = requiredNumber()
  .int('must be a whole number of rupees')
  .min(1, 'must be at least 1')
  .max(MAX_RUPEES, `must be at most ${MAX_RUPEES}`);

const views = requiredNumber().int('must be a whole number').min(1, 'must be at least 1');

// Unknown keys (brandId, spent, status...) are stripped: ownership comes from the
// token and spending starts at zero, never from the client.
export const createCampaignSchema = z
  .object({
    name: requiredString().trim().min(1, 'is required').max(80, 'must be at most 80 characters'),
    platform: z.enum(PLATFORMS, { error: 'must be "instagram" or "youtube"' }),
    totalBudget: rupees,
    milestones: z.array(z.object({ views, payout: rupees }), { error: 'must be a list of { views, payout }' }),
  })
  .superRefine(({ milestones, totalBudget }, ctx) => {
    const problem = milestoneLadderProblem(milestones, totalBudget);
    if (problem) ctx.addIssue({ code: 'custom', path: ['milestones'], message: problem });
  });

export const campaignParamsSchema = z.object({ id: objectId() });
