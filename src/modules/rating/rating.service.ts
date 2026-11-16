import { differenceInDays } from "date-fns";
import { getGenderTitle } from "../../shared/mail/mail.service";
import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./rating.repository";
import { FinishHandoverDto, SubmitRatingDto } from "./rating.dto";
import {
  RatingReminderStage,
  sendRatingConfirmationToApprover,
  sendRatingReminderEmail,
  sendRatingSummaryToSubmitter,
} from "./rating.mail";

// =====================================================================
// Finish handover (menandai is_finished + kirim reminder rating awal)
// =====================================================================

export async function finishHandover(id: string, body: FinishHandoverDto) {
  const handoverId = parseInt(id, 10);
  const { updated_by } = body;

  if (isNaN(handoverId)) {
    console.warn("❌ Invalid ID format:", id);
    throw new HttpError(400, { error: "Validation Error", details: "ID must be a valid number" });
  }

  if (!updated_by) {
    console.warn("❌ Missing updated_by in request body");
    throw new HttpError(400, { error: "Validation Error", details: "updated_by is required in request body" });
  }

  const existingHandover = await repo.findFinishState(handoverId);

  if (!existingHandover) {
    console.warn(`❌ No handover found with ID: ${handoverId}`);
    throw new HttpError(404, { error: "Not Found", details: `Handover with ID ${handoverId} not found` });
  }

  if (existingHandover.is_finished) {
    return {
      message: "Handover already marked as finished",
      data: { id: handoverId, is_finished: true },
    };
  }

  // Only allow finishing handovers with 'approved' or 'done' status
  if (existingHandover.status !== "approved" && existingHandover.status !== "done") {
    console.warn(`❌ Cannot finish handover in '${existingHandover.status}' status`);
    throw new HttpError(400, {
      error: "Invalid Operation",
      details: "Only handovers with 'approved' or 'done' status can be marked as finished",
    });
  }

  const success = await markHandoverAsFinished(handoverId, updated_by);

  if (!success) {
    console.error(`❌ Failed to mark handover ${handoverId} as finished`);
    throw new HttpError(500, { error: "Operation Failed", details: "Failed to mark handover as finished" });
  }

  return {
    message: "Handover marked as finished and rating reminders sent",
    data: await repo.findWithProjectName(handoverId),
  };
}

// =====================================================================
// Submit rating
// =====================================================================

export async function submitRating(handover_id: string, body: SubmitRatingDto) {
  const handoverId = parseInt(handover_id, 10);
  const { rating, review = "", auth_id } = body;
  const currentTime = new Date(); // timestamp for rating submission

  if (isNaN(handoverId)) {
    console.warn("❌ Invalid handover_id format:", handover_id);
    throw new HttpError(400, { error: "Validation Error", details: "handover_id must be a valid number" });
  }

  if (auth_id === undefined || auth_id === null) {
    console.warn("❌ Missing auth_id in request body");
    throw new HttpError(400, { error: "Validation Error", details: "auth_id is required in request body for verification" });
  }

  if (rating === undefined || rating === null) {
    console.warn("❌ Missing rating in request body");
    throw new HttpError(400, { error: "Validation Error", details: "rating is required in request body" });
  }

  const ratingValue = parseInt(rating.toString(), 10);
  if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    console.warn(`❌ Invalid rating value: ${rating}`);
    throw new HttpError(400, { error: "Validation Error", details: "rating must be a number between 1 and 5" });
  }

  const existingHandover = await repo.findForRating(handoverId);

  if (!existingHandover) {
    console.warn(`❌ No handover found with ID: ${handoverId}`);
    throw new HttpError(404, { error: "Not Found", details: `Handover with ID ${handoverId} not found` });
  }

  if (!existingHandover.is_finished) {
    console.warn(`❌ Handover ID ${handoverId} is not marked as finished`);
    throw new HttpError(400, { error: "Invalid Operation", details: "Ratings can only be submitted for finished handovers" });
  }

  const existingApproval = await repo.findApprovedApprovalOf(handoverId, auth_id);

  if (!existingApproval) {
    console.warn(`❌ No approved approval found for handover ID: ${handoverId} and auth_id: ${auth_id}`);
    throw new HttpError(404, { error: "Not Found", details: "No approved approval found for this handover and user" });
  }

  if (existingApproval.rating !== null) {
    console.warn(`❌ Approval ID ${existingApproval.id} already has a rating: ${existingApproval.rating}`);
    throw new HttpError(400, { error: "Invalid Operation", details: "This approval already has a rating" });
  }

  const approvalId = existingApproval.id;
  const projectName = existingHandover.tr_proposed_changes?.project_name || "Handover Document";
  const docNumber = existingHandover.doc_number || "No Document Number";

  await repo.updateApproval(approvalId, {
    rating: ratingValue,
    review: review,
    rating_date: currentTime,
    updated_date: currentTime,
  });

  const allApprovals = await repo.findApprovedApprovals(handoverId);

  const approvalsWithRatings = allApprovals.filter((a) => a.rating !== null && a.rating !== undefined);
  const totalApprovals = allApprovals.length;
  const ratedApprovals = approvalsWithRatings.length;

  let averageRating = null;
  let isComplete = false;

  if (ratedApprovals > 0) {
    const sum = approvalsWithRatings.reduce((total, approval) => total + (approval.rating || 0), 0);
    averageRating = parseFloat((sum / ratedApprovals).toFixed(1));
    isComplete = ratedApprovals === totalApprovals;

    await repo.updateHandover(handoverId, {
      star: averageRating,
      updated_at: currentTime,
    });
  }

  // Confirmation email to the approver who submitted the rating
  try {
    if (existingApproval.mst_authorization?.email) {
      await sendRatingConfirmationToApprover(existingApproval.mst_authorization, ratingValue, projectName, docNumber, review);
    }
  } catch (emailError) {
    console.error("❌ Error sending approver confirmation email:", emailError);
  }

  // If this was the final rating, send a summary email to the submitter
  try {
    if (isComplete && existingHandover.auth_id) {
      const submitter = await repo.findAuthById(existingHandover.auth_id);
      if (submitter?.email) {
        await sendRatingSummaryToSubmitter(submitter, handoverId, projectName, docNumber, averageRating || 0, totalApprovals);
      }
    }
  } catch (emailError) {
    console.error("❌ Error sending submitter summary email:", emailError);
  }

  return {
    message: isComplete ? "Rating submitted successfully. All ratings complete!" : "Rating submitted successfully",
    data: {
      handover_id: handoverId,
      approval_id: approvalId,
      auth_id: auth_id,
      rating: ratingValue,
      rating_date: currentTime,
      final_rating: averageRating,
      is_complete: isComplete,
      rated_approvals: ratedApprovals,
      total_approvals: totalApprovals,
    },
  };
}

// =====================================================================
// Rating reminders
// =====================================================================

/** Get existing track record or create a new one. */
async function getOrCreateRatingReminderTracking(handoverId: number, approvalId: number): Promise<any> {
  try {
    const existingTracking = await repo.findReminderTracking(handoverId, approvalId);
    if (existingTracking) return existingTracking;
    return await repo.createReminderTracking(handoverId, approvalId);
  } catch (error) {
    console.error(`❌ Error tracking rating reminder:`, error);
    return null;
  }
}

/**
 * Process and send rating reminders for approvers who haven't rated yet.
 * Dipanggil oleh rating-reminder.job.ts.
 */
export async function processRatingReminders(): Promise<void> {
  try {
    console.log("🔍 Starting to process rating reminders");
    const now = new Date();

    const finishedHandovers = await repo.findFinishedNeedingRatings();

    for (const handover of finishedHandovers) {
      const handoverId = handover.id;
      const finishedDate = handover.finished_date || handover.updated_at || now;
      const projectName = handover.tr_proposed_changes?.project_name || "Handover Document";
      const docNumber = handover.doc_number || "No Doc Number";

      for (const approval of handover.tr_handover_approval) {
        const approvalId = approval.id;
        const approver = approval.mst_authorization;

        if (!approver || !approver.email) {
          continue;
        }

        const recipientEmail = approver.email;
        const recipientName = approver.employee_name || approver.employee_code || "Unknown";
        const recipientGender = getGenderTitle(approver.gender);

        const lastReminderSent = approval.last_rating_reminder_sent;
        const reminderCount = approval.rating_reminder_count || 0;

        const daysSinceFinished = differenceInDays(now, finishedDate);
        const daysSinceLastReminder = lastReminderSent ? differenceInDays(now, lastReminderSent) : null;

        let reminderStage: RatingReminderStage | null = null;
        let shouldSendReminder = false;

        // Initial reminder (only if no reminders have been sent yet)
        if (reminderCount === 0) {
          reminderStage = RatingReminderStage.INITIAL;
          shouldSendReminder = true;
        }
        // Day 3: >= 3 days since finished and >= 3 days since last reminder
        else if (reminderCount === 1 && daysSinceFinished >= 3 &&
                (daysSinceLastReminder === null || daysSinceLastReminder >= 3)) {
          reminderStage = RatingReminderStage.DAY_THREE;
          shouldSendReminder = true;
        }
        // Day 7: >= 7 days since finished and >= 4 days since last reminder
        else if (reminderCount === 2 && daysSinceFinished >= 7 &&
                (daysSinceLastReminder === null || daysSinceLastReminder >= 4)) {
          reminderStage = RatingReminderStage.DAY_SEVEN;
          shouldSendReminder = true;
        }
        // Final: >= 9.5 days since finished and >= 2 days since last reminder
        else if (reminderCount === 3 && daysSinceFinished >= 9.5 &&
                (daysSinceLastReminder === null || daysSinceLastReminder >= 2)) {
          reminderStage = RatingReminderStage.FINAL;
          shouldSendReminder = true;
        }

        if (shouldSendReminder && reminderStage) {
          const emailSent = await sendRatingReminderEmail(
            approvalId,
            recipientEmail,
            recipientName,
            recipientGender,
            handoverId,
            projectName,
            docNumber,
            reminderStage
          );

          if (emailSent) {
            await repo.updateApproval(approvalId, {
              last_rating_reminder_sent: new Date(),
              rating_reminder_count: reminderCount + 1,
            });

            // Also create a tracking record for audit purposes
            await getOrCreateRatingReminderTracking(handoverId, approvalId);
          }
        }
      }
    }

    console.log("✅ Finished processing rating reminders");
  } catch (error) {
    console.error("❌ Error processing rating reminders:", error);
  }
}

/** Mark a handover as finished and trigger initial rating reminders. */
export async function markHandoverAsFinished(handoverId: number, updatedBy: string): Promise<boolean> {
  try {
    await repo.updateHandover(handoverId, {
      is_finished: true,
      finished_date: new Date(),
      updated_at: new Date(),
      updated_by: updatedBy,
    });

    // Langsung kirim reminder awal untuk handover ini (tanpa menunggu job terjadwal)
    const handover = await repo.findWithUnratedApprovals(handoverId);

    if (!handover) {
      console.error(`❌ Handover ID ${handoverId} not found after updating`);
      return false;
    }

    const projectName = handover.tr_proposed_changes?.project_name || "Handover Document";
    const docNumber = handover.doc_number || "No Doc Number";

    for (const approval of handover.tr_handover_approval) {
      const approvalId = approval.id;
      const approver = approval.mst_authorization;

      if (!approver || !approver.email) {
        continue;
      }

      const recipientEmail = approver.email;
      const recipientName = approver.employee_name || approver.employee_code || "Unknown";
      const recipientGender = getGenderTitle(approver.gender);

      const emailSent = await sendRatingReminderEmail(
        approvalId,
        recipientEmail,
        recipientName,
        recipientGender,
        handoverId,
        projectName,
        docNumber,
        RatingReminderStage.INITIAL
      );

      if (emailSent) {
        await repo.updateApproval(approvalId, {
          last_rating_reminder_sent: new Date(),
          rating_reminder_count: 1,
        });

        await getOrCreateRatingReminderTracking(handoverId, approvalId);
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ Error marking handover ${handoverId} as finished:`, error);
    return false;
  }
}
