import { prismaDB2 } from "../../../shared/config/database";

// Akses data tr_approver_change_request, bypass log, notification log — hanya query Prisma.

const person = { select: { employee_name: true, employee_code: true, email: true } };

/** Include standar list request (pending/all). */
const listInclude = {
  tr_proposed_changes: {
    select: {
      project_name: true,
      item_changes: true,
      status: true,
      progress: true,
      department: { select: { department_name: true } },
      plant: { select: { plant_name: true } },
    },
  },
  mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization: person,
  mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization: person,
  mst_authorization_tr_approver_change_request_requester_auth_idTomst_authorization: person,
  tr_proposed_changes_approval_tr_approver_change_request_approval_idTotr_proposed_changes_approval: {
    select: { step: true, actor: true, status: true },
  },
};

const requestOrderBy: any = [{ urgent: "desc" }, { priority: "desc" }, { created_date: "desc" }];

export const findPage = (where: any, skip: number, take: number) =>
  Promise.all([
    prismaDB2.tr_approver_change_request.findMany({
      where,
      include: listInclude,
      orderBy: requestOrderBy,
      skip,
      take,
    }),
    prismaDB2.tr_approver_change_request.count({ where }),
  ]);

export const findByProposedId = (where: any) =>
  prismaDB2.tr_approver_change_request.findMany({
    where,
    include: {
      tr_proposed_changes: {
        select: {
          id: true,
          project_name: true,
          item_changes: true,
          status: true,
          progress: true,
          line_code: true,
          section_code: true,
          documentNumber: {
            select: {
              running_number: true,
              area: { select: { area: true } },
            },
          },
          department: { select: { department_name: true } },
          plant: { select: { plant_name: true } },
        },
      },
      mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization: person,
      mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization: person,
      mst_authorization_tr_approver_change_request_requester_auth_idTomst_authorization: person,
      tr_proposed_changes_approval_tr_approver_change_request_approval_idTotr_proposed_changes_approval: {
        select: { id: true, step: true, actor: true, status: true, note: true },
      },
    },
    orderBy: requestOrderBy,
  });

export const count = (where: any) => prismaDB2.tr_approver_change_request.count({ where });

export const findPendingByApprovalId = (approvalId: number) =>
  prismaDB2.tr_approver_change_request.findFirst({
    where: { approval_id: approvalId, status: "pending" },
  });

export const createRequest = (data: any) =>
  prismaDB2.tr_approver_change_request.create({
    data,
    include: {
      tr_proposed_changes: {
        select: { project_name: true, item_changes: true, status: true, progress: true },
      },
      mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization: person,
      mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization: person,
      mst_authorization_tr_approver_change_request_requester_auth_idTomst_authorization: person,
      tr_proposed_changes_approval_tr_approver_change_request_approval_idTotr_proposed_changes_approval: {
        select: { step: true, actor: true, status: true },
      },
    },
  });

export const findRequestForProcess = (id: number) =>
  prismaDB2.tr_approver_change_request.findUnique({
    where: { id },
    include: {
      tr_proposed_changes_approval_tr_approver_change_request_approval_idTotr_proposed_changes_approval: true,
      tr_proposed_changes: {
        select: { project_name: true, item_changes: true, status: true, progress: true },
      },
      mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization: person,
      mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization: person,
      mst_authorization_tr_approver_change_request_requester_auth_idTomst_authorization: person,
    },
  });

export const updateRequest = (id: number, data: any) =>
  prismaDB2.tr_approver_change_request.update({ where: { id }, data });

export const findRequestDetail = (id: number) =>
  prismaDB2.tr_approver_change_request.findUnique({
    where: { id, is_deleted: false },
    include: {
      tr_proposed_changes: {
        include: {
          documentNumber: { include: { area: true } },
          department: true,
          plant: true,
          section_department: true,
        },
      },
      mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization: {
        select: { id: true, employee_name: true, employee_code: true, email: true },
      },
      mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization: {
        select: { id: true, employee_name: true, employee_code: true, email: true },
      },
      mst_authorization_tr_approver_change_request_requester_auth_idTomst_authorization: {
        select: { id: true, employee_name: true, employee_code: true, email: true },
      },
      tr_proposed_changes_approval_tr_approver_change_request_approval_idTotr_proposed_changes_approval: {
        include: { authorization: person },
      },
    },
  });

export const findChangeHistoryByRequestId = (requestId: number) =>
  prismaDB2.tr_approver_change_history.findMany({
    where: { change_request_id: requestId },
    orderBy: { created_date: "desc" },
  });

export const createChangeHistory = (data: any) => prismaDB2.tr_approver_change_history.create({ data });

// ---------- Proposed change / approval / authorization ----------

export const findProposedChangeSummary = (id: number) =>
  prismaDB2.tr_proposed_changes.findUnique({
    where: { id },
    select: { id: true, project_name: true, item_changes: true, status: true, progress: true, is_deleted: true },
  });

export const findApprovalSummary = (id: number) =>
  prismaDB2.tr_proposed_changes_approval.findUnique({
    where: { id },
    select: { id: true, proposed_changes_id: true, auth_id: true, step: true, status: true, actor: true },
  });

export const findActiveCheckAuthorization = (id: number) =>
  prismaDB2.mst_authorization.findUnique({
    where: { id },
    select: { id: true, employee_name: true, employee_code: true, email: true, status: true, is_deleted: true },
  });

export const findAuthorizationContact = (id: number) =>
  prismaDB2.mst_authorization.findUnique({
    where: { id },
    select: { id: true, employee_name: true, employee_code: true, email: true },
  });

export const updateApproval = (id: number, data: any) =>
  prismaDB2.tr_proposed_changes_approval.update({ where: { id }, data });

export const createProposedHistory = (data: any) => prismaDB2.tr_proposed_changes_history.create({ data });

export const createNotificationLog = (data: any) => prismaDB2.tr_notification_log.create({ data });

/** Email admin aktif: semua Super Admin + Admin di departemen requester (jika ada). */
export const findAdminEmails = (requester_department_id?: number) =>
  prismaDB2.mst_authorization.findMany({
    where: {
      AND: [
        { status: true, is_deleted: false, email: { not: null } },
        {
          OR: [
            { role: { role_name: "Super Admin" } },
            ...(requester_department_id ? [{
              AND: [
                { role: { role_name: "Admin" } },
                { department_id: requester_department_id },
              ],
            }] : []),
          ],
        },
      ],
    },
    select: { email: true },
  });

// ---------- Bypass ----------

export const findProposedChangeForBypass = (id: number) =>
  prismaDB2.tr_proposed_changes.findUnique({
    where: { id },
    include: {
      approvals: {
        include: { authorization: person },
        orderBy: { step: "asc" },
      },
      plant: { select: { plant_name: true } },
      department: { select: { department_name: true } },
    },
  });

export const updateProposedChange = (id: number, data: any) =>
  prismaDB2.tr_proposed_changes.update({ where: { id }, data });

export const updateApprovals = (where: any, data: any) =>
  prismaDB2.tr_proposed_changes_approval.updateMany({ where, data });

export const findApprovalsByProposedId = (proposedChangesId: number) =>
  prismaDB2.tr_proposed_changes_approval.findMany({
    where: { proposed_changes_id: proposedChangesId },
    orderBy: { step: "asc" },
  });

export const updateApprovalWithAuthorization = (id: number, data: any) =>
  prismaDB2.tr_proposed_changes_approval.update({
    where: { id },
    data,
    include: { authorization: person },
  });

export const createBypassLog = (data: any) => prismaDB2.tr_admin_bypass_log.create({ data });
