import { prismaDB2 } from "../../shared/config/database";

// Akses data tr_proposed_changes (+ history, approval template, head) — hanya query Prisma.

// ---------- List & detail ----------

/** Halaman completion (select minimal + department_id). */
export const findCompletionPage = (where: any, skip: number, take: number, orderBy: any) =>
  prismaDB2.$transaction([
    prismaDB2.tr_proposed_changes.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        project_name: true,
        document_number_id: true,
        line_code: true,
        section_code: true,
        department_id: true,
        status: true,
        progress: true,
        progresssupport: true,
        created_date: true,
        documentNumber: {
          select: {
            running_number: true,
          },
        },
      },
    }),
    prismaDB2.tr_proposed_changes.count({ where }),
  ]);

/** Halaman completion untuk approver (select minimal tanpa department_id). */
export const findApproverCompletionPage = (where: any, skip: number, take: number, orderBy: any) =>
  prismaDB2.$transaction([
    prismaDB2.tr_proposed_changes.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        project_name: true,
        document_number_id: true,
        line_code: true,
        section_code: true,
        status: true,
        progress: true,
        progresssupport: true,
        created_date: true,
        documentNumber: {
          select: {
            running_number: true,
          },
        },
      },
    }),
    prismaDB2.tr_proposed_changes.count({ where }),
  ]);

export const findPageWithDocumentNumber = (where: any, skip: number, take: number, orderBy: any) =>
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
      },
    }),
    prismaDB2.tr_proposed_changes.count({ where }),
  ]);

export const findAuthDocsSummaryByProposedIds = (proposedChangeIds: number[]) =>
  prismaDB2.tr_authorization_doc.findMany({
    where: { proposed_change_id: { in: proposedChangeIds } },
    select: { id: true, doc_number: true, proposed_change_id: true, progress: true },
  });

export const findHandoversSummaryByProposedIds = (proposedChangeIds: number[]) =>
  prismaDB2.tr_handover.findMany({
    where: { proposed_change_id: { in: proposedChangeIds } },
    select: {
      id: true,
      doc_number: true,
      proposed_change_id: true,
      progress: true,
      is_finished: true,
      star: true,
      status: true,
    },
  });

export const findAuthDocsSummaryByProposedId = (proposedChangeId: number) =>
  prismaDB2.tr_authorization_doc.findMany({
    where: { proposed_change_id: proposedChangeId },
    select: { id: true, doc_number: true, proposed_change_id: true, progress: true },
  });

export const findHandoversByProposedId = (proposedChangeId: number) =>
  prismaDB2.tr_handover.findMany({ where: { proposed_change_id: proposedChangeId } });

export const findHandoverIdsByApprover = (authId: number) =>
  prismaDB2.tr_handover_approval.findMany({
    where: { auth_id: authId },
    select: { handover_id: true },
  });

export const findFinishedHandoverProposedIds = (handoverIds: number[]) =>
  prismaDB2.tr_handover.findMany({
    where: { id: { in: handoverIds }, is_finished: true },
    select: { proposed_change_id: true },
  });

export const findHandoverApprovalsByHandoverIds = (handoverIds: number[]) =>
  prismaDB2.tr_handover_approval.findMany({
    where: { handover_id: { in: handoverIds } },
    select: {
      id: true,
      handover_id: true,
      auth_id: true,
      step: true,
      actor: true,
      employee_code: true,
      status: true,
      rating: true,
      review: true,
      finished_date: true,
      created_date: true,
      updated_date: true,
    },
  });

const detailInclude = {
  plant: true,
  department: true,
  section_department: true,
  documentNumber: true,
};

/** findUnique dengan filter is_deleted (dipakai /completion/:id). */
export const findUniqueActiveWithRelations = (id: number) =>
  prismaDB2.tr_proposed_changes.findUnique({
    where: { id, is_deleted: false },
    include: detailInclude,
  });

/** findFirst dengan filter is_deleted (dipakai /proposedchanges/:id). */
export const findFirstActiveWithRelations = (id: number) =>
  prismaDB2.tr_proposed_changes.findFirst({
    where: { id, is_deleted: false },
    include: detailInclude,
  });

export const findById = (id: number) => prismaDB2.tr_proposed_changes.findUnique({ where: { id } });

export const create = (data: any) => prismaDB2.tr_proposed_changes.create({ data });

export const update = (id: number, data: any) => prismaDB2.tr_proposed_changes.update({ where: { id }, data });

/** Data untuk email submission: document number + approvals (urut step). */
export const findWithApprovals = (id: number) =>
  prismaDB2.tr_proposed_changes.findUnique({
    where: { id },
    include: {
      documentNumber: true,
      approvals: {
        include: {
          authorization: true,
        },
        orderBy: {
          step: "asc",
        },
      },
    },
  });

// ---------- History ----------

export const findHistoriesByProposedId = (proposedChangesId: number) =>
  prismaDB2.tr_proposed_changes_history.findMany({
    where: { proposed_changes_id: proposedChangesId },
    include: { proposedChange: true },
    orderBy: { created_date: "desc" },
  });

export const findHistoryById = (id: number) =>
  prismaDB2.tr_proposed_changes_history.findUnique({ where: { id } });

export const findAllHistories = () =>
  prismaDB2.tr_proposed_changes_history.findMany({
    include: { proposedChange: true },
    orderBy: { created_date: "desc" },
  });

export const createHistory = (data: any) => prismaDB2.tr_proposed_changes_history.create({ data });

// ---------- Approval ----------

export const findApprovalsByProposedId = (proposedChangesId: number) =>
  prismaDB2.tr_proposed_changes_approval.findMany({
    where: { proposed_changes_id: proposedChangesId },
    include: {
      proposedChange: true,
      authorization: true,
    },
    orderBy: { created_date: "desc" },
  });

export const createApprovals = (data: any[]) => prismaDB2.tr_proposed_changes_approval.createMany({ data });

export const findNotApprovedApprovals = (proposedChangesId: number) =>
  prismaDB2.tr_proposed_changes_approval.findMany({
    where: {
      proposed_changes_id: proposedChangesId,
      status: "not_approved",
    },
    distinct: ["auth_id"],
    orderBy: { created_date: "desc" },
  });

// ---------- Authorization ----------

export const findAuthorizationById = (id: number) => prismaDB2.mst_authorization.findUnique({ where: { id } });

export const findAuthorizationsByIds = (ids: number[]) => prismaDB2.mst_authorization.findMany({ where: { id: { in: ids } } });

export const findEmployeeName = (id: number) =>
  prismaDB2.mst_authorization.findUnique({
    where: { id },
    select: { employee_name: true },
  });

// ---------- Template approval & head ----------

export const findApprovalTemplates = (line_code: string, need_engineering_approval: boolean, need_production_approval: boolean) =>
  prismaDB2.mst_template_approval_proposedchanges.findMany({
    where: {
      is_active: true,
      is_deleted: false,
      AND: [
        { OR: [{ line_code: null }, { line_code: line_code }] },
        { OR: [{ need_engineering_approval: null }, { need_engineering_approval: need_engineering_approval }] },
        { OR: [{ need_production_approval: null }, { need_production_approval: need_production_approval }] },
      ],
    },
    orderBy: [
      { step_order: "asc" },
      { priority: "desc" }, // priority tinggi dipilih jika ada konflik
    ],
  });

export const findLineSectionByCode = (line_code: string) =>
  prismaDB2.mst_line.findFirst({
    where: { code_line: line_code },
    select: { id_section_manufacture: true },
  });

const headInclude = {
  authorization: {
    select: {
      id: true,
      employee_code: true,
      employee_name: true,
      status: true,
    },
  },
  section: {
    select: {
      id: true,
      department_id: true,
      section_name: true,
      department: {
        select: {
          department_name: true,
        },
      },
    },
  },
};

export const findSectionHeads = (sectionId: number) =>
  prismaDB2.mst_section_head.findMany({
    where: { is_deleted: false, section_id: sectionId },
    include: headInclude,
  });

export const findDepartmentHeads = (sectionId: number) =>
  prismaDB2.mst_department_head.findMany({
    where: { is_deleted: false, section_id: sectionId },
    include: headInclude,
  });
