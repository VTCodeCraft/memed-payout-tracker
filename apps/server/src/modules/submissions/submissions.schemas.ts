import { z } from 'zod';
import { objectId, requiredNumber, requiredString } from '../../lib/validation';
import { normalizePostUrl } from './post-url';

// Unknown keys (creatorId, views, payouts...) are stripped: the creator comes from
// the token and every submission starts with no views and nothing earned.
export const createSubmissionSchema = z
  .object({
    campaignId: objectId(),
    postUrl: requiredString().trim().min(1, 'is required').max(2048, 'must be at most 2048 characters'),
  })
  .transform(({ campaignId, postUrl }, ctx) => {
    const post = normalizePostUrl(postUrl);
    if (!post) {
      ctx.addIssue({
        code: 'custom',
        path: ['postUrl'],
        message: 'must be a link to a single Instagram post or reel, or a YouTube video',
      });
      return z.NEVER;
    }
    return { campaignId, postUrl, ...post };
  });

// The view-update endpoint has no role check (per the brief), so only `views` is
// ever read from the body; payout fields and anything else are stripped.
export const updateViewsSchema = z.object({
  views: requiredNumber().int('must be a whole number').min(0, 'cannot be negative'),
});
