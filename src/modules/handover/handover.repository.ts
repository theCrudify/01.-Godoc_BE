import { prismaDB2 } from "../../shared/config/database";
import { Prisma } from "../../../prisma/generated/db2";

// Akses data tr_handover & relasinya — hanya query Prisma, tanpa logika bisnis.

/** Client di dalam $transaction interaktif, atau prismaDB2 biasa. */
export type Db = Prisma.TransactionClient;

// ---------- create (dipanggil di dalam satu $transaction) ----------

export const runCreateTransaction = <T>(fn: (tx: Db) => Promise<T>) =>
  prismaDB2.$transaction(fn, {
    maxWait: 10000, // 10 seconds
    timeout: 30000, // 30 seconds
    isolationLevel: "ReadCommitted",
  });

export const findActiveInsertStep = (tx: Db) =>
  tx.mst_template_approval_handover.findFirst({
    where: {
      is_insert_step: true,
      is_active: true,
      is_deleted: false,
    },
    orderBy: [{ priority: "desc" }, { step_order: "asc" }],
  });

const headAuthSelect = {
  authorization: {
    select: {
      id: true,
      employee_code: true,
      employee_name: true,
      status: true,
    },
  },
} as const;

export const findSectionHead = (tx: Db, sectionId: number) =>
  tx.mst_section_head.findFirst({
    where: { section_id: sectionId, is_deleted: false },
    include: headAuthSelect,
  });

export const findDepartmentHead = (tx: Db, sectionId: number) =>
  tx.mst_department_head.findFirst({
    where: { section_id: sectionId, is_deleted: false },
    include: headAuthSelect,
  });

export const createHandover = (tx: Db, data: any) => tx.tr_handover.create({ data });

export const findAuthNameForHistory = (tx: Db, authId: number) =>
  tx.mst_authorization.findUnique({
    where: { id: authId },
    select: {
      id: true,
      employee_name: true,
      employee_code: true,
    },
  });

export const createHistory = (data: any, db: Db = prismaDB2) => db.tr_handover_history.create({ data });

export const findActiveAuthsByIds = (tx: Db, ids: number[]) =>
  tx.mst_authorization.findMany({
    where: {
      id: { in: ids },
      is_deleted: false,
    },
    select: {
      id: true,
      employee_code: true,
      employee_name: true,
    },
  });

export const createApprovals = (tx: Db, data: any[]) => tx.tr_handover_approval.createMany({ data });

// ---------- update ----------

const proposedChangeAndSubmitterInclude = {
  tr_proposed_changes: {
    select: {
      id: true,
      project_name: true,
    },
  },
  mst_authorization_tr_handover_auth_idTomst_authorization: {
    select: {
      id: true,
      employee_name: true,
      employee_code: true,
      email: true,
      gender: true,
    },
  },
} as const;

export const findForUpdate = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    include: proposedChangeAndSubmitterInclude,
  });

export const updateHandover = (id: number, data: any) =>
  prismaDB2.tr_handover.update({
    where: { id },
    data,
    include: proposedChangeAndSubmitterInclude,
  });

export const findEmployeeName = (id: number) =>
  prismaDB2.mst_authorization.findUnique({
    where: { id },
    select: { employee_name: true },
  });

export const findNotApprovedApprovals = (handoverId: number) =>
  prismaDB2.tr_handover_approval.findMany({
    where: {
      handover_id: handoverId,
      status: "not_approved",
    },
    distinct: ["auth_id"],
    orderBy: {
      updated_date: "desc",
    },
  });

export const findAuthsByIds = (ids: number[]) => prismaDB2.mst_authorization.findMany({ where: { id: { in: ids } } });

export const findNotApprovedHistories = (handoverId: number, authIds: number[]) =>
  prismaDB2.tr_handover_history.findMany({
    where: {
      handover_id: handoverId,
      auth_id: { in: authIds },
      status: "not_approved",
    },
    orderBy: {
      created_date: "desc",
    },
  });

export const findAuthById = (id: number) => prismaDB2.mst_authorization.findUnique({ where: { id } });

export const findWithProposedChange = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    include: {
      tr_proposed_changes: {
        select: {
          id: true,
          project_name: true,
        },
      },
    },
  });

// ---------- list / detail ----------

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  prismaDB2.$transaction([
    prismaDB2.tr_handover.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        mst_plant: true,
        mst_department: true,
        mst_section_department: true,
        // Include proposed changes relation
        tr_proposed_changes: true,
      },
    }),
    prismaDB2.tr_handover.count({ where }),
  ]);

export const findDetailById = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: {
      id,
      is_deleted: false,
    },
    include: {
      tr_proposed_changes: true,
      mst_plant: true,
      mst_department: true,
      mst_section_department: true,
      mst_authorization_tr_handover_auth_idTomst_authorization: true,
      mst_authorization_tr_handover_auth_id2Tomst_authorization: true,
      mst_authorization_tr_handover_auth_id3Tomst_authorization: true,
      mst_authorization_tr_handover_auth_id4Tomst_authorization: true,
      tr_authorization_doc: true,
    },
  });

export const findHistories = (handoverId: number) =>
  prismaDB2.tr_handover_history.findMany({
    where: {
      handover_id: handoverId,
    },
    include: {
      mst_authorization: true,
      tr_handover: {
        select: {
          doc_number: true,
          progress: true,
          status: true,
          created_by: true,
        },
      },
    },
    orderBy: {
      created_date: "desc",
    },
  });

export const findApprovalsWithAuth = (handoverId: number) =>
  prismaDB2.tr_handover_approval.findMany({
    where: {
      handover_id: handoverId,
    },
    include: {
      mst_authorization: true,
    },
    orderBy: {
      created_date: "desc",
    },
  });

// ---------- approver ----------

export const findApproverPage = (where: any, skip: number, take: number, orderBy: any) =>
  prismaDB2.$transaction([
    prismaDB2.tr_handover.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        tr_proposed_changes: true,
        mst_plant: true,
        mst_department: true,
        mst_section_department: true,
        mst_authorization_tr_handover_auth_idTomst_authorization: true,
        mst_authorization_tr_handover_auth_id2Tomst_authorization: true,
        mst_authorization_tr_handover_auth_id3Tomst_authorization: true,
        mst_authorization_tr_handover_auth_id4Tomst_authorization: true,
        tr_authorization_doc: true,
        tr_handover_approval: {
          include: {
            mst_authorization: true,
          },
        },
      },
    }),
    prismaDB2.tr_handover.count({ where }),
  ]);

export const findApproval = (handoverId: number, authId: number) =>
  prismaDB2.tr_handover_approval.findFirst({
    where: {
      handover_id: handoverId,
      auth_id: authId,
    },
  });

export const findIdenticalRecentHistory = (
  filter: { handoverId: number; authId: number; status: any; note: string; since: Date },
  db: Db = prismaDB2
) =>
  db.tr_handover_history.findFirst({
    where: {
      handover_id: filter.handoverId,
      auth_id: filter.authId,
      status: filter.status,
      note: filter.note,
      created_date: {
        gte: filter.since,
      },
    },
  });

export const findApprovalsByHandover = (handoverId: number) =>
  prismaDB2.tr_handover_approval.findMany({
    where: { handover_id: handoverId },
  });

export const runApprovalTransaction = (fn: (tx: Db) => Promise<void>) =>
  prismaDB2.$transaction(fn, {
    timeout: 15000,
    isolationLevel: "Serializable", // Stronger isolation to prevent concurrent modifications
  });

export const updateApprovalStatus = (tx: Db, id: number, status: string, updatedDate: Date) =>
  tx.tr_handover_approval.update({
    where: { id },
    data: {
      status,
      updated_date: updatedDate,
    },
  });

export const findApprovalByStep = (tx: Db, handoverId: number, step: number) =>
  tx.tr_handover_approval.findFirst({
    where: {
      handover_id: handoverId,
      step,
    },
  });

export const updateHandoverStatus = (tx: Db, id: number, data: { status: string; progress: string; updated_at: Date }) =>
  tx.tr_handover.update({
    where: { id },
    data,
  });

export const findPreviousNotApproved = (tx: Db, handoverId: number, authId: number) =>
  tx.tr_handover_history.findFirst({
    where: {
      handover_id: handoverId,
      auth_id: authId,
      status: "not_approved",
    },
  });

export const findAuthWithEmployee = (tx: Db, id: number) =>
  tx.mst_authorization.findUnique({
    where: { id },
    include: {
      authorization: true, // Get employee data for full name
    },
  });

export const findFullHandover = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    include: {
      mst_plant: true,
      mst_department: true,
      mst_section_department: true,
      tr_proposed_changes: true,
      mst_authorization_tr_handover_auth_idTomst_authorization: true,
      tr_handover_approval: {
        include: {
          mst_authorization: true,
        },
        orderBy: {
          step: "asc",
        },
      },
      tr_handover_history: {
        orderBy: {
          created_date: "desc",
        },
      },
    },
  });

// ---------- email ----------

export const findForSubmissionEmail = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    include: {
      tr_proposed_changes: true,
      tr_handover_approval: {
        include: {
          mst_authorization: true,
        },
        orderBy: {
          step: "asc",
        },
      },
    },
  });

export const findForApprovalEmail = (id: number) =>
  prismaDB2.tr_handover.findUnique({
    where: { id },
    include: {
      tr_proposed_changes: true,
      tr_authorization_doc: true,
    },
  });

export const findFirstAuthById = (id: number) =>
  prismaDB2.mst_authorization.findFirst({
    where: {
      id,
    },
  });

export const findApprovalWithAuth = (where: { handover_id: number; auth_id?: number; step?: number }) =>
  prismaDB2.tr_handover_approval.findFirst({
    where,
    include: {
      mst_authorization: true,
    },
  });

type TrackingKey = {
  handover_id: number;
  recipient_email: string;
  recipient_type: any;
  status: any;
  note_hash: string;
};

export const findEmailLogId = (where: TrackingKey) =>
  prismaDB2.email_tracking_handover.findFirst({
    where,
    select: { id: true },
  });

export const createEmailLog = (data: any) =>
  prismaDB2.email_tracking_handover.create({
    data,
    select: { id: true },
  });

export const updateEmailLog = (id: number, data: any) =>
  prismaDB2.email_tracking_handover.update({
    where: { id },
    data,
  });
