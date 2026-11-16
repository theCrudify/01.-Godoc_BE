import { prismaDB2 } from "../../../shared/config/database";
import { Prisma } from "../../../../prisma/generated/db2";

// Akses data approval proposed changes (+ email tracking) — hanya query Prisma.

type Db = Prisma.TransactionClient | typeof prismaDB2;

export const findOngoingPage = (where: any, skip: number, take: number, orderBy: any) =>
  prismaDB2.$transaction([
    prismaDB2.tr_proposed_changes.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        plant: true,
        department: true,
        section_department: true,
        documentNumber: {
          include: {
            plant: true,
            category: true,
            area: {
              include: {
                line: true,
              },
            },
            section: true,
            authorization: true,
          },
        },
        approvals: {
          include: {
            authorization: true,
          },
        },
      },
    }),
    prismaDB2.tr_proposed_changes.count({ where }),
  ]);

export const findApproval = (proposedChangesId: number, authId: number) =>
  prismaDB2.tr_proposed_changes_approval.findFirst({
    where: { proposed_changes_id: proposedChangesId, auth_id: authId },
  });

export const findApprovalsByProposedId = (proposedChangesId: number) =>
  prismaDB2.tr_proposed_changes_approval.findMany({ where: { proposed_changes_id: proposedChangesId } });

/** History identik (pcId, auth, status, note) sejak `since` — deteksi submit ganda. */
export const findIdenticalHistorySince = (
  proposedChangesId: number, authId: number, status: string, note: string, since: Date, db: Db = prismaDB2,
) =>
  db.tr_proposed_changes_history.findFirst({
    where: {
      proposed_changes_id: proposedChangesId,
      auth_id: authId,
      status: status,
      note: note,
      created_date: { gte: since },
    },
  });

/** Transaksi serializable (timeout 15 detik) untuk update status approval. */
export const runSerializable = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
  prismaDB2.$transaction(fn, {
    timeout: 15000,
    isolationLevel: "Serializable",
  });

export const updateApprovalStatus = (tx: Db, id: number, status: string, updatedDate: Date) =>
  tx.tr_proposed_changes_approval.update({
    where: { id },
    data: { status, updated_date: updatedDate },
  });

export const findApprovalByStep = (tx: Db, proposedChangesId: number, step: number) =>
  tx.tr_proposed_changes_approval.findFirst({
    where: { proposed_changes_id: proposedChangesId, step },
  });

export const updateProposedChangeStatus = (tx: Db, id: number, status: string, progress: string, updatedAt: Date) =>
  tx.tr_proposed_changes.update({
    where: { id },
    data: { status, progress, updated_at: updatedAt },
  });

export const findNotApprovedHistory = (tx: Db, proposedChangesId: number, authId: number) =>
  tx.tr_proposed_changes_history.findFirst({
    where: { proposed_changes_id: proposedChangesId, auth_id: authId, status: "not_approved" },
  });

export const findAuthorizationWithEmployee = (tx: Db, id: number) =>
  tx.mst_authorization.findUnique({
    where: { id },
    include: { authorization: true },
  });

export const createHistory = (tx: Db, data: any) => tx.tr_proposed_changes_history.create({ data });

export const findWithAllRelations = (id: number) =>
  prismaDB2.tr_proposed_changes.findUnique({
    where: { id },
    include: {
      plant: true,
      department: true,
      section_department: true,
      documentNumber: {
        include: {
          plant: true,
          category: true,
          area: {
            include: {
              line: true,
            },
          },
          section: true,
          authorization: true,
        },
      },
      approvals: {
        include: {
          authorization: true,
        },
        orderBy: {
          step: "asc",
        },
      },
      changeHistories: {
        orderBy: {
          created_date: "desc",
        },
      },
    },
  });

// ---------- Email ----------

export const findLatestHistory = (proposedChangesId: number, authId: number) =>
  prismaDB2.tr_proposed_changes_history.findFirst({
    where: { proposed_changes_id: proposedChangesId, auth_id: authId },
    orderBy: { created_date: "desc" },
  });

export const findEmailLog = (where: any) =>
  prismaDB2.email_tracking_proposedchanges.findFirst({ where, select: { id: true } });

export const createEmailLog = (data: any) =>
  prismaDB2.email_tracking_proposedchanges.create({ data, select: { id: true } });

export const updateEmailLog = (id: number, data: any) =>
  prismaDB2.email_tracking_proposedchanges.update({ where: { id }, data });
