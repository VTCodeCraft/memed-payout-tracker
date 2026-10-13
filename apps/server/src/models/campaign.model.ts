import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';
import { atLeast } from './validators';

export const PLATFORMS = ['instagram', 'youtube'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const CAMPAIGN_STATUSES = ['live', 'exhausted'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const MAX_MILESTONES = 10;
/** Largest amount an Int32 money field can hold (about 214 crore rupees). */
export const MAX_RUPEES = 2_147_483_647;

export interface Milestone {
  views: number;
  payout: number;
}

/**
 * Returns the first problem with a milestone ladder, or undefined if it is valid.
 * Shared by request validation, the model and the payout engine so the rules
 * cannot drift apart. The budget check applies only when a budget is given.
 */
export function milestoneLadderProblem(milestones: readonly Milestone[], totalBudget?: number): string | undefined {
  if (milestones.length === 0) return 'must contain at least one milestone';
  if (milestones.length > MAX_MILESTONES) return `must contain at most ${MAX_MILESTONES} milestones`;

  for (const [index, milestone] of milestones.entries()) {
    const previous = milestones[index - 1];
    const position = `milestone ${index + 1}`;
    if (previous && milestone.views <= previous.views) {
      return `${position}: views must be greater than the previous milestone`;
    }
    if (previous && milestone.payout <= previous.payout) {
      return `${position}: payout must be greater than the previous milestone`;
    }
    if (totalBudget !== undefined && milestone.payout > totalBudget) {
      return `${position}: payout cannot exceed the total budget`;
    }
  }
  return undefined;
}

const milestoneSchema = new Schema(
  {
    views: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isSafeInteger, message: 'views must be a whole number' },
    },
    // Money is whole rupees stored as BSON int32: exact, never fractional.
    payout: { type: Schema.Types.Int32, required: true, validate: atLeast(1) },
  },
  { _id: false },
);

const campaignSchema = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    platform: { type: String, required: true, enum: PLATFORMS, immutable: true },
    totalBudget: { type: Schema.Types.Int32, required: true, immutable: true, validate: atLeast(1) },
    spent: { type: Schema.Types.Int32, required: true, default: 0, validate: atLeast(0) },
    // Immutable: changing the ladder after creation would rewrite what creators are owed.
    milestones: { type: [milestoneSchema], immutable: true },
    status: { type: String, required: true, enum: CAMPAIGN_STATUSES, default: 'live' },
  },
  { timestamps: true },
);

campaignSchema.index({ brandId: 1, createdAt: -1 }); // a brand's own campaigns, newest first
campaignSchema.index({ status: 1, createdAt: -1 }); // live campaign discovery

campaignSchema.pre('validate', function () {
  const problem = milestoneLadderProblem(this.milestones, this.totalBudget);
  if (problem) this.invalidate('milestones', problem);
  if (this.spent > this.totalBudget) this.invalidate('spent', 'cannot exceed the total budget');
});

export type CampaignDocument = HydratedDocument<InferSchemaType<typeof campaignSchema>>;

export const Campaign = model('Campaign', campaignSchema);

/** The campaign shape the API sends: budget spent vs remaining, no owner id. */
export interface CampaignResponse {
  id: string;
  name: string;
  platform: Platform;
  totalBudget: number;
  spent: number;
  remaining: number;
  milestones: Milestone[];
  status: CampaignStatus;
  createdAt: string;
}

export function toCampaignResponse(campaign: CampaignDocument): CampaignResponse {
  return {
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform,
    totalBudget: campaign.totalBudget,
    spent: campaign.spent,
    // Derived rather than stored, so it can never disagree with spent.
    remaining: campaign.totalBudget - campaign.spent,
    milestones: campaign.milestones.map(({ views, payout }) => ({ views, payout })),
    status: campaign.status,
    createdAt: campaign.createdAt.toISOString(),
  };
}
