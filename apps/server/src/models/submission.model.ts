import { type HydratedDocument, type InferSchemaType, Schema, model } from 'mongoose';
import { PLATFORMS } from './campaign.model';
import { atLeast } from './validators';

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
  },
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
