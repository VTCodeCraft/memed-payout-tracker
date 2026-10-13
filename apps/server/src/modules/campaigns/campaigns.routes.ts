import { Router } from 'express';
import { AppError } from '../../lib/app-error';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth';
import { Campaign, toCampaignResponse } from '../../models/campaign.model';
import { campaignParamsSchema, createCampaignSchema } from './campaigns.schemas';

export function createCampaignsRouter(jwtSecret: string): Router {
  const router = Router();
  router.use(requireAuth(jwtSecret));

  router.post('/', requireRole('brand'), async (req, res) => {
    const input = createCampaignSchema.parse(req.body);
    const campaign = await Campaign.create({ ...input, brandId: getAuthUser(req).id });
    res.status(201).json({ campaign: toCampaignResponse(campaign) });
  });

  // Ownership comes only from the token; query parameters are never read.
  router.get('/mine', requireRole('brand'), async (req, res) => {
    const campaigns = await Campaign.find({ brandId: getAuthUser(req).id }).sort({ createdAt: -1, _id: -1 });
    res.status(200).json({ campaigns: campaigns.map(toCampaignResponse) });
  });

  // The brief lists "list live campaigns" as a creator feature.
  router.get('/live', requireRole('creator'), async (_req, res) => {
    const campaigns = await Campaign.find({ status: 'live' }).sort({ createdAt: -1, _id: -1 });
    res.status(200).json({ campaigns: campaigns.map(toCampaignResponse) });
  });

  // Creators may open any campaign to read its ladder; brands only their own.
  // Another brand's campaign answers 404 so its existence is not revealed.
  router.get('/:id', async (req, res) => {
    const { id } = campaignParamsSchema.parse(req.params);
    const user = getAuthUser(req);
    const campaign = await Campaign.findById(id);

    if (!campaign || (user.role === 'brand' && !campaign.brandId.equals(user.id))) {
      throw new AppError(404, 'NOT_FOUND', 'Campaign not found');
    }
    res.status(200).json({ campaign: toCampaignResponse(campaign) });
  });

  return router;
}
