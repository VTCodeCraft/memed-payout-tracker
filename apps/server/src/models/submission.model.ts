import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';
import { PLATFORMS, type Platform } from './campaign.model';
import { atLeast } from './validators';

// The latest view update that grew faster than the spike rule allows (see view-spike.ts),
// kept as evidence for a person to review. It never affects what is earned or paid.
const viewSpikeSchema = new Schema(
  {
    detectedAt: { type: Date, required: true },
    fromViews: { type: Number, required: true, min: 0 },
    toViews: { type: Number, required: true, min: 0 },
    viewsPerHour: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, immutable: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    platform: { type: String, required: true, enum: PLATFORMS, immutable: true },
    // The link exactly as the creator submitted it (trimmed), for display.
    postUrl: { type: String, required: true, trim: true, maxlength: 2048, immutable: true },
    // Canonical form of the post; globally unique so one post can never earn twice.
    normalizedUrl: { type: String, required: true, immutable: true, unique: true },
    views: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: { validator: Number.isSafeInteger, message: 'views must be a whole number' },
    },
    // Money is whole rupees stored as BSON int32. Eligible (earned by views) is tracked
    // separately from paid (actually allocated from the campaign budget).
    eligiblePayout: { type: Schema.Types.Int32, required: true, default: 0, validate: atLeast(0) },
    paidPayout: { type: Schema.Types.Int32, required: true, default: 0, validate: atLeast(0) },
    viewSpike: { type: viewSpikeSchema, required: false },
  },
  // After creation only view updates write a submission, so updatedAt is also when the
  // current view count was recorded: the spike rule measures elapsed time from it.
  { timestamps: true },
);

submissionSchema.index({ creatorId: 1, createdAt: -1 }); // a creator's submissions, newest first
submissionSchema.index({ campaignId: 1, createdAt: -1 }); // a campaign's submissions, newest first

submissionSchema.pre('validate', function () {
  if (this.paidPayout > this.eligiblePayout) {
    this.invalidate('paidPayout', 'cannot exceed the eligible payout');
  }
});

export type SubmissionDocument = HydratedDocument<InferSchemaType<typeof submissionSchema>>;

export const Submission = model('Submission', submissionSchema);

/** The submission shape the API sends; owner ids stay server-side. */
export interface SubmissionResponse {
  id: string;
  campaignId: string;
  platform: Platform;
  postUrl: string;
  normalizedUrl: string;
  views: number;
  eligiblePayout: number;
  paidPayout: number;
  /** The latest view spike, or null if the views never grew unusually fast. */
  viewSpike: { detectedAt: string; fromViews: number; toViews: number; viewsPerHour: number } | null;
  createdAt: string;
}

export function toSubmissionResponse(submission: SubmissionDocument): SubmissionResponse {
  const spike = submission.viewSpike;
  return {
    id: submission.id,
    campaignId: submission.campaignId.toString(),
    platform: submission.platform,
    postUrl: submission.postUrl,
    normalizedUrl: submission.normalizedUrl,
    views: submission.views,
    eligiblePayout: submission.eligiblePayout,
    paidPayout: submission.paidPayout,
    viewSpike: spike
      ? { detectedAt: spike.detectedAt.toISOString(), fromViews: spike.fromViews, toViews: spike.toViews, viewsPerHour: spike.viewsPerHour }
      : null,
    createdAt: submission.createdAt.toISOString(),
  };
}
