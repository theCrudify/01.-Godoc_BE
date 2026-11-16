import { prismaDB2 } from "../../shared/config/database";

// Akses data rating handover (tr_handover / tr_handover_approval) — hanya query Prisma.

export const findFinishState = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    select: {
      id: true,
      is_finished: true,
      status: true,
    },
  });

export const findWithProjectName = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    include: {
      tr_proposed_changes: {
        select: {
          project_name: true,
        },
      },
    },
  });

export const findForRating = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    select: {
      id: true,
      is_finished: true,
      doc_number: true,
      auth_id: true, // Submitter ID
      tr_proposed_changes: {
        select: {
          project_name: true,
        },
      },
    },
  });

export const findApprovedApprovalOf = (handoverId: number, authId: any) =>
  prismaDB2.tr_handover_approval.findFirst({
    where: {
      handover_id: handoverId,
      auth_id: authId,
      status: "approved", // Ensure it's approved
    },
    include: {
      mst_authorization: true, // Include approver details
    },
  });

export const updateApproval = (id: number, data: any) =>
  prismaDB2.tr_handover_approval.update({
    where: { id },
    data,
  });

export const findApprovedApprovals = (handoverId: number) =>
  prismaDB2.tr_handover_approval.findMany({
    where: {
      handover_id: handoverId,
      status: "approved",
    },
  });

export const updateHandover = (id: number, data: any) =>
  prismaDB2.tr_handover.update({
    where: { id },
    data,
  });

export const findAuthById = (id: number) => prismaDB2.mst_authorization.findUnique({ where: { id } });

export const findRatedApprovalsWithAuth = (handoverId: number) =>
  prismaDB2.tr_handover_approval.findMany({
    where: {
      handover_id: handoverId,
      status: "approved",
      rating: { not: null },
    },
    include: {
      mst_authorization: true,
    },
    orderBy: {
      rating: "desc",
    },
  });

// ---------- reminder ----------

/** Handover selesai yang belum punya star, beserta approval 'approved' yang belum memberi rating. */
export const findFinishedNeedingRatings = () =>
  prismaDB2.tr_handover.findMany({
    where: {
      is_finished: true,
      star: null,
    },
    include: {
      tr_proposed_changes: {
        select: {
          project_name: true,
        },
      },
      tr_handover_approval: {
        include: {
          mst_authorization: true,
        },
        where: {
          status: "approved",
          rating: null,
        },
      },
    },
  });

export const findWithUnratedApprovals = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    include: {
      tr_proposed_changes: {
        select: {
          project_name: true,
        },
      },
      tr_handover_approval: {
        where: {
          status: "approved",
          rating: null,
        },
        include: {
          mst_authorization: true,
        },
      },
    },
  });

const reminderTrackingKey = (handoverId: number, approvalId: number) => ({
  handover_id: handoverId,
  recipient_type: "approver" as const,
  status: "approved" as const,
  note_hash: `rating_reminder_${approvalId}`, // Use unique identifier with approvalId
});

export const findReminderTracking = (handoverId: number, approvalId: number) =>
  prismaDB2.email_tracking_handover.findFirst({
    where: reminderTrackingKey(handoverId, approvalId),
  });

export const createReminderTracking = (handoverId: number, approvalId: number) =>
  prismaDB2.email_tracking_handover.create({
    data: {
      handover_id: handoverId,
      recipient_email: "pending", // Will be updated later
      recipient_type: "approver",
      status: "approved",
      note_hash: `rating_reminder_${approvalId}`,
      note_text: "Rating reminder tracking",
      is_success: false,
    },
  });
