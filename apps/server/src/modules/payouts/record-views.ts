import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from '../../lib/app-error';
import { Campaign, type CampaignDocument, type CampaignStatus } from '../../models/campaign.model';
import {
  Submission,
  type SubmissionDocument,
  type SubmissionResponse,
  toSubmissionResponse,
} from '../../models/submission.model';
import { viewSpikeRate } from '../submissions/view-spike';
import { allocatePayout, eligiblePayout } from './payout-engine';

export type PayoutOutcome = 'no_change' | 'no_new_payout' | 'paid' | 'partial' | 'budget_exhausted';

export interface ViewsUpdateResult {
  submission: SubmissionResponse;
  allocation: { grantedNow: number; unfundedPayout: number; outcome: PayoutOutcome };
  campaign: { remaining: number; status: CampaignStatus };
  /** Whether this update grew the views fast enough to be recorded as a spike. */
  viewSpikeDetected: boolean;
}

const MAX_ATTEMPTS = 3;

/** A conditional write matched nothing: the document changed after this attempt read it. */
class StaleWriteError extends Error {}

/**
 * Records a new view count and pays any newly earned amount, atomically.
 *
 * The transaction makes the campaign and submission writes commit or roll back
 * together. Each write is also conditional on the values read, so a concurrent
 * change can never be overwritten: MongoDB's write conflicts are retried by the
 * transaction helper, and stale conditional writes by the loop below.
 */
export async function recordViews(submissionId: string, views: number): Promise<ViewsUpdateResult> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await mongoose.connection.transaction((session) => applyViews(submissionId, views, session), {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });
    } catch (error) {
      if (!(error instanceof StaleWriteError)) throw error;
    }
  }
  throw new AppError(409, 'CONCURRENT_UPDATE', 'The submission changed during the update, please retry');
}

async function applyViews(submissionId: string, views: number, session: ClientSession): Promise<ViewsUpdateResult> {
  const submission = await Submission.findById(submissionId).session(session);
  if (!submission) {
    throw new AppError(404, 'NOT_FOUND', 'Submission not found');
  }
  if (views < submission.views) {
    throw new AppError(
      409,
      'VIEWS_DECREASED',
      `View count cannot decrease (current ${submission.views}, received ${views})`,
    );
  }

  const campaign = await Campaign.findById(submission.campaignId).session(session);
  if (!campaign) {
    throw new Error(`Submission ${submission.id} references missing campaign ${submission.campaignId}`);
  }

  if (views === submission.views) {
    // Same count reported again: nothing to record, so nothing can be paid twice.
    const unfundedPayout = Math.max(0, submission.eligiblePayout - submission.paidPayout);
    return result(submission, campaign, { grantedNow: 0, unfundedPayout, outcome: 'no_change' }, false);
  }

  // A review signal only: it is computed from the same snapshot and saved by the same
  // conditional write as the payout below, and nothing about the payout depends on it.
  const now = new Date();
  const viewsPerHour = viewSpikeRate({
    previousViews: submission.views,
    views,
    elapsedMs: now.getTime() - submission.updatedAt.getTime(),
  });
  const viewSpike =
    viewsPerHour === null ? {} : { viewSpike: { detectedAt: now, fromViews: submission.views, toViews: views, viewsPerHour } };

  const remainingBudget = campaign.totalBudget - campaign.spent;
  const eligible = eligiblePayout(views, campaign.milestones);
  const { owed, grant } = allocatePayout({
    eligiblePayout: eligible,
    paidPayout: submission.paidPayout,
    remainingBudget,
  });

  let updatedCampaign = campaign;
  if (grant > 0) {
    // Conditional on the spent value read above: if another payout landed since,
    // this matches nothing and the attempt is retried with fresh numbers.
    const exhausts = grant === remainingBudget;
    const next = await Campaign.findOneAndUpdate(
      { _id: campaign._id, spent: campaign.spent },
      { $inc: { spent: grant }, ...(exhausts ? { $set: { status: 'exhausted' } } : {}) },
      { session, returnDocument: 'after' },
    );
    if (!next) throw new StaleWriteError();
    updatedCampaign = next;
  }

  // Conditional on the views and paid amount read above, so the same payout can
  // never be applied to this submission twice.
  const updatedSubmission = await Submission.findOneAndUpdate(
    { _id: submission._id, views: submission.views, paidPayout: submission.paidPayout },
    { $set: { views, eligiblePayout: eligible, ...viewSpike }, $inc: { paidPayout: grant } },
    { session, returnDocument: 'after' },
  );
  if (!updatedSubmission) throw new StaleWriteError();

  return result(
    updatedSubmission,
    updatedCampaign,
    { grantedNow: grant, unfundedPayout: owed - grant, outcome: outcomeOf(owed, grant) },
    viewsPerHour !== null,
  );
}

function outcomeOf(owed: number, grant: number): PayoutOutcome {
  if (owed === 0) return 'no_new_payout';
  if (grant === owed) return 'paid';
  return grant > 0 ? 'partial' : 'budget_exhausted';
}

function result(
  submission: SubmissionDocument,
  campaign: CampaignDocument,
  allocation: ViewsUpdateResult['allocation'],
  viewSpikeDetected: boolean,
): ViewsUpdateResult {
  return {
    submission: toSubmissionResponse(submission),
    allocation,
    campaign: { remaining: campaign.totalBudget - campaign.spent, status: campaign.status },
    viewSpikeDetected,
  };
}
