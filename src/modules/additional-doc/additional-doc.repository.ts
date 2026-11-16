import { prismaDB2 } from "../../shared/config/database";

// Akses data tr_additional_doc / tr_additional_file (+ tr_proposed_changes, tr_document_number)
// — hanya query Prisma, tanpa logika bisnis.

export const findProposedChangeDetail = (id: number) =>
  prismaDB2.tr_proposed_changes.findFirst({
    where: { id, is_deleted: false },
    select: {
      id: true,
      project_name: true,
      document_number_id: true,
      item_changes: true,
      line_code: true,
      section_code: true,
      change_type: true,
      description: true,
      reason: true,
      cost_text: true,
      planning_start: true,
      planning_end: true,
      status: true,
      progress: true,
      created_date: true,
      created_by: true,
      updated_at: true,
      need_engineering_approval: true,
      need_production_approval: true,
      other_sytem: true,
      auth_id: true,
      section_department: { select: { id: true, section_name: true } },
      plant: { select: { id: true, plant_name: true, plant_code: true } },
      department: { select: { id: true, department_name: true, department_code: true } },
      documentNumber: {
        select: {
          running_number: true,
          klasifikasi_document: true,
          category: { select: { id: true, category: true } },
          line_code: true,
          section_code: true,
          department_code: true,
          development_code: true,
          id_proposed_header: true,
          sub_document: true,
          is_internal_memo: true,
          is_surat_ketentuan: true,
          area: { select: { id: true, area: true, code_area: true } },
        },
      },
    },
  });

export const findAuthorizationDocIdByProposedChange = (proposedChangeId: number) =>
  prismaDB2.tr_authorization_doc.findFirst({
    where: { proposed_change_id: proposedChangeId },
    select: { id: true },
  });

export const createAdditionalDoc = (data: any) =>
  prismaDB2.tr_additional_doc.create({
    data,
    include: {
      plantsite: true,
      category: true,
      authorization: true,
      proposedChange: true,
    },
  });

export const findDocumentNumberById = (id: number) => prismaDB2.tr_document_number.findUnique({ where: { id } });

export const updateDocumentNumber = (id: number, data: any) =>
  prismaDB2.tr_document_number.update({
    where: { id },
    data,
    include: {
      plant: true,
      area: true,
      category: true,
      section: true,
      authorization: true,
    },
  });

export const findAdditionalDocsByProposedChange = (proposedChangeId: number) =>
  prismaDB2.tr_additional_doc.findMany({
    where: { proposed_change_id: proposedChangeId },
    include: {
      plantsite: true,
      authorization: true,
    },
    orderBy: { created_date: "desc" },
  });

export const findLatestActiveFile = (docId: number) =>
  prismaDB2.tr_additional_file.findFirst({
    where: { tr_additional_doc_id: docId, is_deleted: false },
    orderBy: { version: "desc" },
  });

export const findActiveFilesByDoc = (docId: number) =>
  prismaDB2.tr_additional_file.findMany({
    where: { tr_additional_doc_id: docId, is_deleted: false },
    orderBy: { version: "desc" },
  });

export const findAdditionalDocById = (id: number) => prismaDB2.tr_additional_doc.findUnique({ where: { id } });

export const findLatestFileVersion = (docId: number) =>
  prismaDB2.tr_additional_file.findFirst({
    where: { tr_additional_doc_id: docId },
    orderBy: { version: "desc" },
  });

export const createFile = (data: any) => prismaDB2.tr_additional_file.create({ data });

export const findActiveFileById = (id: number) =>
  prismaDB2.tr_additional_file.findUnique({ where: { id, is_deleted: false } });

export const findActiveFileFirst = (id: number) =>
  prismaDB2.tr_additional_file.findFirst({ where: { id, is_deleted: false } });

export const softDeleteFile = (id: number) =>
  prismaDB2.tr_additional_file.update({ where: { id }, data: { is_deleted: true } });

export const updateProgressSupport = (id: number, progresssupport: string) =>
  prismaDB2.tr_proposed_changes.update({ where: { id }, data: { progresssupport } });
