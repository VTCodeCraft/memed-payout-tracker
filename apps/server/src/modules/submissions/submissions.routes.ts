import { type RequestHandler, Router } from 'express';
import type { LiveCampaignsCache } from '../../cache/live-campaigns-cache';
import { isDuplicateKeyError } from '../../db/errors';
import { AppError } from '../../lib/app-error';
import { idParamsSchema } from '../../lib/validation';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth';
import { Campaign } from '../../models/campaign.model';
import { type SubmissionDocument, Submission, toSubmissionResponse } from '../../models/submission.model';
import { recordViews } from '../payouts/record-views';
import { creatorEarnings } from './earnings';
import { createSubmissionSchema, updateViewsSchema } from './submissions.schemas';

export function createSubmissionsRouter(
  jwtSecret: string,
  viewUpdateLimiter: RequestHandler,
  liveCampaigns: LiveCampaignsCache,
): Router {
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

  // The brief's "view their total earnings": totals for the token's creator only.
  router.get('/earnings', ...creatorOnly, async (req, res) => {
    res.status(200).json({ earnings: await creatorEarnings(getAuthUser(req).id) });
  });

  // No authentication or role check: the brief defines this endpoint as a simulation
  // of platform view data. Only `views` is read from the body.
  router.patch('/:id/views', viewUpdateLimiter, async (req, res) => {
    const { id } = idParamsSchema.parse(req.params);
    const { views } = updateViewsSchema.parse(req.body);
    const result = await recordViews(id, views);
    // A payment changes the campaign's spent figure and may exhaust it. recordViews has
    // returned, so its transaction has committed and every list read from here on sees
    // it. (A read that began before the commit can still store the old figures; the
    // cache's 60 s expiry bounds that.)
    if (result.allocation.grantedNow > 0) await liveCampaigns.invalidate();
    res.status(200).json(result);
  });

  return router;
}
