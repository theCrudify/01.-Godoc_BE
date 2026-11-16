import { prismaDB2 } from "../../../shared/config/database";

// Akses data tbl_support_document (+ file & note) — hanya query Prisma.

export const create = (data: any) => prismaDB2.tbl_support_document.create({ data });

export const findById = (id: number) => prismaDB2.tbl_support_document.findUnique({ where: { id } });

export const findByProposedId = (proposedId: number) =>
  prismaDB2.tbl_support_document.findMany({
    where: { proposed_id: proposedId },
    orderBy: { created_date: "desc" },
  });

export const updateTitle = (id: number, title: any) =>
  prismaDB2.tbl_support_document.update({ where: { id }, data: { title } });

/** Update status hanya jika dokumen memang milik proposed_id ini. */
export const updateStatus = (id: number, proposedId: number, data: any) =>
  prismaDB2.tbl_support_document.update({ where: { id, proposed_id: proposedId }, data });

export const findProposedChangeById = (id: number) => prismaDB2.tr_proposed_changes.findUnique({ where: { id } });

// ---------- File ----------

export const findLastFileVersion = (supportDocId: number) =>
  prismaDB2.tbl_support_document_file.findFirst({
    where: { support_doc_id: supportDocId, is_deleted: false },
    orderBy: { version: "desc" },
  });

export const createFile = (data: any) => prismaDB2.tbl_support_document_file.create({ data });

export const findFilesBySupportDocId = (supportDocId: number) =>
  prismaDB2.tbl_support_document_file.findMany({
    where: { support_doc_id: supportDocId, is_deleted: false },
    orderBy: { version: "asc" },
  });

export const findFileById = (id: number) => prismaDB2.tbl_support_document_file.findUnique({ where: { id } });

// ---------- Note ----------

export const findLastNote = (supportDocId: number) =>
  prismaDB2.tbl_support_document_noted.findFirst({
    where: { support_doc_id: supportDocId, is_deleted: false },
    orderBy: { version: "desc" },
  });

export const findNotes = (supportDocId: number) =>
  prismaDB2.tbl_support_document_noted.findMany({
    where: { support_doc_id: supportDocId, is_deleted: false },
    orderBy: { version: "desc" },
  });

export const createNote = (data: any) => prismaDB2.tbl_support_document_noted.create({ data });
