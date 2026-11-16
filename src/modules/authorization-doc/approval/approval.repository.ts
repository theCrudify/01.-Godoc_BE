import { prismaDB2 } from "../../../shared/config/database";
import { Prisma } from "../../../../prisma/generated/db2";

// Akses data approval Authorization Document — hanya query Prisma, tanpa logika bisnis.
// Fungsi dengan parameter `db` dipakai di dalam transaksi (db = tx) maupun di luar.

type Db = Prisma.TransactionClient;

export const findOngoingPage = (where: any, skip: number, take: number, orderBy: any) =>
  prismaDB2.$transaction([
    prismaDB2.tr_authorization_doc.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        proposedChange: true,
        authorizationPlant: true,
        department: true,
        section_department: true,
        authdocMembers: true,
        authdocApprovals: { include: { authorization: true } },
      },
    }),
    prismaDB2.tr_authorization_doc.count({ where }),
  ]);

export const findApprovalOf = (authdocId: number, authId: number) =>
  prismaDB2.tr_authdoc_approval.findFirst({ where: { authdoc_id: authdocId, auth_id: authId } });

export const findApprovalsOfDoc = (authdocId: number) => prismaDB2.tr_authdoc_approval.findMany({ where: { authdoc_id: authdocId } });

export const findRecentIdenticalHistory = (
  where: { authdoc_id: number; auth_id: number; status: any; note: string; since: Date },
  db: Db = prismaDB2,
) =>
  db.tr_authdoc_history.findFirst({
    where: {
      authdoc_id: where.authdoc_id,
      auth_id: where.auth_id,
      status: where.status,
      note: where.note,
      created_date: { gte: where.since },
    },
  });

/** Transaksi serializable (timeout 30 detik) untuk update status approval. */
export const runSerializable = (fn: (tx: Db) => Promise<void>) =>
  prismaDB2.$transaction(fn, { timeout: 30000, isolationLevel: "Serializable" });

export const findApprovalById = (db: Db, id: number) => db.tr_authdoc_approval.findFirst({ where: { id } });

export const findApprovalAtStep = (db: Db, authdocId: number, step: number) =>
  db.tr_authdoc_approval.findFirst({ where: { authdoc_id: authdocId, step } });

export const updateApproval = (db: Db, id: number, data: any) => db.tr_authdoc_approval.update({ where: { id }, data });

export const updateDoc = (db: Db, id: number, data: any) => db.tr_authorization_doc.update({ where: { id }, data });

export const findNotApprovedHistoryOf = (db: Db, authdocId: number, authId: number) =>
  db.tr_authdoc_history.findFirst({ where: { authdoc_id: authdocId, auth_id: authId, status: "not_approved" } });

export const findAuthorization = (db: Db, id: number) => db.mst_authorization.findUnique({ where: { id } });

export const createHistory = (db: Db, data: any) => db.tr_authdoc_history.create({ data });

export const findDocFull = (id: number) =>
  prismaDB2.tr_authorization_doc.findUnique({
    where: { id },
    include: {
      authorizationPlant: true,
      department: true,
      section_department: true,
      proposedChange: true,
      authorization: true,
      authdocApprovals: { include: { authorization: true }, orderBy: { step: "asc" } },
      authdocHistories: { orderBy: { created_date: "desc" } },
    },
  });

export const findDocProposedChangeId = (id: number) =>
  prismaDB2.tr_authorization_doc.findUnique({ where: { id }, select: { id: true, proposed_change_id: true } });

// ---------- data email ----------

export const findDocWithApprovals = (id: number) =>
  prismaDB2.tr_authorization_doc.findUnique({
    where: { id },
    include: { authdocApprovals: { include: { authorization: true }, orderBy: { step: "asc" } } },
  });

export const findProposedChange = (id: number | undefined) => prismaDB2.tr_proposed_changes.findUnique({ where: { id } });

export const findAuthorizationById = (id: number) => prismaDB2.mst_authorization.findUnique({ where: { id } });

export const findEmailLog = (where: any) => prismaDB2.email_tracking_authdoc.findFirst({ where, select: { id: true } });

export const createEmailLog = (data: any) => prismaDB2.email_tracking_authdoc.create({ data, select: { id: true } });

export const updateEmailLog = (id: number, data: any) => prismaDB2.email_tracking_authdoc.update({ where: { id }, data });
