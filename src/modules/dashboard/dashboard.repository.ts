import { prismaDB2 } from "../../shared/config/database";

// Query Prisma untuk dashboard — hanya akses data, tanpa logika bisnis.

// ===== Document levelling =====

export const countDocumentStages = () =>
  Promise.all([
    // total dokumen aktif
    prismaDB2.tr_proposed_changes.count({ where: { is_deleted: false } }),
    // masih di tahap proposed changes (belum ada authorization doc)
    prismaDB2.tr_proposed_changes.count({
      where: { is_deleted: false, authorizationDocs: { none: {} } },
    }),
    // tahap authorization (punya auth doc tapi belum handover)
    prismaDB2.tr_proposed_changes.count({
      where: { is_deleted: false, authorizationDocs: { some: { tr_handover: { none: {} } } } },
    }),
    // tahap handover (belum selesai)
    prismaDB2.tr_handover.count({ where: { is_deleted: false, is_finished: false } }),
    // selesai
    prismaDB2.tr_handover.count({ where: { is_deleted: false, is_finished: true } }),
  ]);

// ===== Department involvement =====

export const findActiveDepartments = () =>
  prismaDB2.mst_department.findMany({
    where: { is_deleted: false, status: true },
    select: {
      id: true,
      department_name: true,
      department_code: true,
      plant: { select: { id: true, plant_name: true } },
    },
  });

export const countProposedChangesByDepartment = (where: object, deptIds: number[]) =>
  prismaDB2.tr_proposed_changes.groupBy({
    by: ["department_id"],
    where: { ...where, department_id: { in: deptIds }, is_deleted: false },
    _count: { _all: true },
  });

export const findDepartmentById = (departmentId: number) =>
  prismaDB2.mst_department.findUnique({
    where: { id: departmentId, is_deleted: false },
    select: {
      id: true,
      department_name: true,
      department_code: true,
      plant: { select: { plant_name: true } },
    },
  });

export const findDepartmentProposedChanges = (departmentId: number) =>
  prismaDB2.tr_proposed_changes.findMany({
    where: { department_id: departmentId, is_deleted: false },
    select: {
      id: true,
      project_name: true,
      status: true,
      progress: true,
      created_date: true,
      documentNumber: { select: { running_number: true } },
      authorizationDocs: { select: { id: true } },
      tr_handover: { select: { id: true, is_finished: true } },
    },
  });

// ===== Document statistics =====

export const findDocumentsForTimeStatistics = (startDate: Date, endDate: Date, departmentFilter: object) =>
  Promise.all([
    prismaDB2.tr_proposed_changes.findMany({
      where: { created_date: { gte: startDate, lte: endDate }, is_deleted: false, ...departmentFilter },
      select: {
        id: true,
        created_date: true,
        status: true,
        department_id: true,
        department: { select: { department_name: true } },
      },
      orderBy: { created_date: "asc" },
    }),
    prismaDB2.tr_authorization_doc.findMany({
      where: { created_date: { gte: startDate, lte: endDate }, ...departmentFilter },
      select: {
        id: true,
        created_date: true,
        status: true,
        department_id: true,
        department: { select: { department_name: true } },
      },
      orderBy: { created_date: "asc" },
    }),
    prismaDB2.tr_handover.findMany({
      where: { created_date: { gte: startDate, lte: endDate }, is_deleted: false, ...departmentFilter },
      select: {
        id: true,
        created_date: true,
        status: true,
        is_finished: true,
        finished_date: true,
        department_id: true,
      },
      orderBy: { created_date: "asc" },
    }),
  ]);

export const findDocumentsForTrends = (startDate: Date, endDate: Date, departmentFilter: object) =>
  Promise.all([
    prismaDB2.tr_proposed_changes.findMany({
      where: { created_date: { gte: startDate, lte: endDate }, is_deleted: false, ...departmentFilter },
      select: { created_date: true },
    }),
    prismaDB2.tr_authorization_doc.findMany({
      where: { created_date: { gte: startDate, lte: endDate }, ...departmentFilter },
      select: { created_date: true },
    }),
    prismaDB2.tr_handover.findMany({
      where: { created_date: { gte: startDate, lte: endDate }, is_deleted: false, ...departmentFilter },
      select: { created_date: true, is_finished: true, finished_date: true },
    }),
  ]);

// ===== Top performers =====

const userSelect = {
  id: true,
  employee_code: true,
  employee_name: true,
  email: true,
  department: { select: { id: true, department_name: true, department_code: true } },
} as const;

export const groupHandoversBySubmitter = (where: any) =>
  prismaDB2.tr_handover.groupBy({
    by: ["auth_id"],
    where,
    _count: { id: true },
    _avg: { star: true },
  });

export const findSubmitterDetails = (submitterIds: number[]) =>
  Promise.all([
    prismaDB2.mst_authorization.findMany({ where: { id: { in: submitterIds } }, select: userSelect }),
    prismaDB2.tr_handover.findMany({
      where: { auth_id: { in: submitterIds }, is_deleted: false, is_finished: true, star: { not: null } },
      select: {
        id: true,
        doc_number: true,
        star: true,
        auth_id: true,
        finished_date: true,
        tr_proposed_changes: { select: { project_name: true } },
      },
      orderBy: { star: "desc" },
    }),
  ]);

export const groupApprovalsByApprover = (where: any) =>
  prismaDB2.tr_handover_approval.groupBy({
    by: ["auth_id"],
    where,
    _count: { id: true },
    _avg: { rating: true },
  });

export const findApproverDetails = (approverIds: number[]) =>
  Promise.all([
    prismaDB2.mst_authorization.findMany({ where: { id: { in: approverIds } }, select: userSelect }),
    prismaDB2.tr_handover_approval.findMany({
      where: { auth_id: { in: approverIds }, status: "approved", rating: { not: null } },
      select: {
        id: true,
        auth_id: true,
        rating: true,
        review: true,
        updated_date: true,
        tr_handover: {
          select: {
            id: true,
            doc_number: true,
            tr_proposed_changes: { select: { project_name: true } },
          },
        },
      },
      orderBy: { rating: "desc" },
    }),
  ]);

// ===== Line code statistics =====

export const findProposedChangesForLineStats = (where: any) =>
  prismaDB2.tr_proposed_changes.findMany({
    where,
    select: { id: true, line_code: true, status: true, project_name: true, created_date: true },
  });

export const findProposedChangesForLineFlow = (where: any) =>
  prismaDB2.tr_proposed_changes.findMany({
    where,
    select: {
      id: true,
      line_code: true,
      status: true,
      authorizationDocs: { select: { id: true } },
      tr_handover: { select: { is_finished: true } },
    },
  });
