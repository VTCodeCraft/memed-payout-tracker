import { Router } from 'express';
import { isDuplicateKeyError } from '../../db/errors';
import { AppError } from '../../lib/app-error';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth';
import { Campaign } from '../../models/campaign.model';
import { type SubmissionDocument, Submission, toSubmissionResponse } from '../../models/submission.model';
import { createSubmissionSchema } from './submissions.schemas';

export function createSubmissionsRouter(jwtSecret: string): Router {
  const router = Router();
  // Applied per route rather than router-wide: the brief's view-update endpoint on
  // this router takes no role check.
  const creatorOnly = [requireAuth(jwtSecret), requireRole('creator')];

  router.post('/', ...creatorOnly, async (req, res) => {
    const input = createSubmissionSchema.parse(req.body);

    const campaign = await Campaign.findById(input.campaignId);
    if (!campaign) {
      throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
    }
    if (campaign.status !== 'live') {
      throw new AppError(409, 'CAMPAIGN_NOT_LIVE', 'This campaign is no longer accepting submissions');
    }
    if (campaign.platform !== input.platform) {
      throw new AppError(400, 'PLATFORM_MISMATCH', `This campaign only accepts ${campaign.platform} posts`);
    }

    let submission: SubmissionDocument;
    try {
      submission = await Submission.create({
        campaignId: campaign.id,
        creatorId: getAuthUser(req).id,
        platform: input.platform,
        postUrl: input.postUrl,
        normalizedUrl: input.normalizedUrl,
      });
    } catch (error) {
      // The unique index decides, so concurrent duplicate submissions cannot both succeed.
      if (isDuplicateKeyError(error)) {
        throw new AppError(409, 'DUPLICATE_POST', 'This post has already been submitted');
      }
      throw error;
    }

    res.status(201).json({ submission: toSubmissionResponse(submission) });
  });

  // Filtered by the token's user id only; query parameters are never read.
  router.get('/mine', ...creatorOnly, async (req, res) => {
    const submissions = await Submission.find({ creatorId: getAuthUser(req).id }).sort({ createdAt: -1, _id: -1 });
    res.status(200).json({ submissions: submissions.map(toSubmissionResponse) });
  });

  return router;
}
