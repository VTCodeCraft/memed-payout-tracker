import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';

export const PLATFORMS = ['instagram', 'youtube'] as const;
export const CAMPAIGN_STATUSES = ['live', 'exhausted'] as const;
export const MAX_MILESTONES = 10;

export interface Milestone {
  views: number;
  payout: number;
}

/**
 * Returns the first problem with a milestone ladder, or undefined if it is valid.
 * Shared by request validation and the model so the rules cannot drift apart.
 */
export function milestoneLadderProblem(milestones: readonly Milestone[], totalBudget: number): string | undefined {
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
    if (milestone.payout > totalBudget) {
      return `${position}: payout cannot exceed the total budget`;
    }
  }
  return undefined;
}

// Int32 schema types silently ignore Mongoose's `min` option, so lower bounds are explicit.
const atLeast = (minimum: number) => ({
  validator: (value: number) => value >= minimum,
  message: `must be at least ${minimum}`,
});

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
