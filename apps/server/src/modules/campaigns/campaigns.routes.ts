import { Router } from 'express';
import { getAuthUser, requireAuth, requireRole } from '../../middleware/auth';
import { Campaign, toCampaignResponse } from '../../models/campaign.model';
import { createCampaignSchema } from './campaigns.schemas';

export function createCampaignsRouter(jwtSecret: string): Router {
  const router = Router();
  router.use(requireAuth(jwtSecret));

  router.post('/', requireRole('brand'), async (req, res) => {
    const input = createCampaignSchema.parse(req.body);
    const campaign = await Campaign.create({ ...input, brandId: getAuthUser(req).id });
    res.status(201).json({ campaign: toCampaignResponse(campaign) });
  });

  return router;
}
