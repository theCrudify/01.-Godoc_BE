import { prismaDB2 } from "../../../shared/config/database";

// Akses data perubahan approver & bypass Authorization Document — hanya query Prisma.

const personSelect = { select: { employee_name: true, employee_code: true, email: true } };
const personWithIdSelect = { select: { id: true, employee_name: true, employee_code: true, email: true } };
const orderByPriority = [{ urgent: "desc" as const }, { priority: "desc" as const }, { created_date: "desc" as const }];

/** include standar untuk list (pending/all). */
const listInclude = {
  tr_authorization_doc: {
    select: {
      doc_number: true,
      description: true,
      status: true,
      progress: true,
      department: { select: { department_name: true } },
      authorizationPlant: { select: { plant_name: true } },
    },
  },
  current_authorization: personSelect,
  new_authorization: personSelect,
  requester_authorization: personSelect,
  tr_authdoc_approval: { select: { step: true, actor: true, status: true } },
};

// ---------- change request ----------

export const findRequestsByDoc = (where: any) =>
  prismaDB2.tr_approver_change_request_authdoc.findMany({
    where,
    include: {
      tr_authorization_doc: {
        select: {
          id: true,
          doc_number: true,
          implementation_date: true,
          evaluation: true,
          description: true,
          concept: true,
          status: true,
          progress: true,
          department: { select: { department_name: true } },
          authorizationPlant: { select: { plant_name: true } },
        },
      },
      current_authorization: personSelect,
      new_authorization: personSelect,
      requester_authorization: personSelect,
      tr_authdoc_approval: { select: { id: true, step: true, actor: true, status: true, note: true } },
    },
    orderBy: orderByPriority,
  });

export const countRequests = (where: any) => prismaDB2.tr_approver_change_request_authdoc.count({ where });

export const findRequestPage = (where: any, skip: number, take: number) =>
  prismaDB2.tr_approver_change_request_authdoc.findMany({ where, include: listInclude, orderBy: orderByPriority, skip, take });

export const findPendingRequestForApproval = (approvalId: any) =>
  prismaDB2.tr_approver_change_request_authdoc.findFirst({ where: { approval_id: approvalId, status: "pending" } });

export const createRequest = (data: any) =>
  prismaDB2.tr_approver_change_request_authdoc.create({
    data,
    include: {
      tr_authorization_doc: { select: { doc_number: true, description: true, status: true, progress: true } },
      current_authorization: personSelect,
      new_authorization: personSelect,
      requester_authorization: personSelect,
      tr_authdoc_approval: { select: { step: true, actor: true, status: true } },
    },
  });

export const findRequestForProcess = (id: number) =>
  prismaDB2.tr_approver_change_request_authdoc.findUnique({
    where: { id },
    include: {
      tr_authdoc_approval: true,
      tr_authorization_doc: { select: { doc_number: true, description: true, status: true, progress: true } },
      current_authorization: personSelect,
      new_authorization: personSelect,
      requester_authorization: personSelect,
    },
  });

export const updateRequest = (id: number, data: any) => prismaDB2.tr_approver_change_request_authdoc.update({ where: { id }, data });

export const findRequestDetail = (id: number) =>
  prismaDB2.tr_approver_change_request_authdoc.findUnique({
    where: { id, is_deleted: false },
    include: {
      tr_authorization_doc: { include: { department: true, authorizationPlant: true, section_department: true } },
      current_authorization: personWithIdSelect,
      new_authorization: personWithIdSelect,
      requester_authorization: personWithIdSelect,
      tr_authdoc_approval: { include: { authorization: personSelect } },
    },
  });

export const findChangeHistoryOfRequest = (requestId: number) =>
  prismaDB2.tr_approver_change_history_authdoc.findMany({
    where: { change_request_id: requestId },
    orderBy: { created_date: "desc" },
  });

export const createChangeHistory = (data: any) => prismaDB2.tr_approver_change_history_authdoc.create({ data });

// ---------- dokumen, approval, user ----------

export const findDocSummary = (id: any) =>
  prismaDB2.tr_authorization_doc.findUnique({
    where: { id },
    select: { id: true, doc_number: true, description: true, status: true, progress: true },
  });

export const findDocForBypass = (id: any) =>
  prismaDB2.tr_authorization_doc.findUnique({
    where: { id },
    include: {
      authdocApprovals: { include: { authorization: personSelect }, orderBy: { step: "asc" } },
      authorizationPlant: { select: { plant_name: true } },
      department: { select: { department_name: true } },
    },
  });

export const updateDoc = (id: any, data: any) => prismaDB2.tr_authorization_doc.update({ where: { id }, data });

export const findApprovalSummary = (id: any) =>
  prismaDB2.tr_authdoc_approval.findUnique({
    where: { id },
    select: { id: true, authdoc_id: true, auth_id: true, step: true, status: true, actor: true },
  });

export const updateApproval = (id: number, data: any) => prismaDB2.tr_authdoc_approval.update({ where: { id }, data });

export const updateApprovalsWhere = (where: any, data: any) => prismaDB2.tr_authdoc_approval.updateMany({ where, data });

export const findApprovalsOfDoc = (authdocId: any) =>
  prismaDB2.tr_authdoc_approval.findMany({ where: { authdoc_id: authdocId }, orderBy: { step: "asc" } });

export const updateApprovalWithAuthorization = (id: number, data: any) =>
  prismaDB2.tr_authdoc_approval.update({ where: { id }, data, include: { authorization: personSelect } });

export const findNewApprover = (id: any) =>
  prismaDB2.mst_authorization.findUnique({
    where: { id },
    select: { id: true, employee_name: true, employee_code: true, email: true, status: true, is_deleted: true },
  });

export const findApproverBasic = (id: any) =>
  prismaDB2.mst_authorization.findUnique({
    where: { id },
    select: { id: true, employee_name: true, employee_code: true, email: true },
  });

export const findActiveAdmins = (where: any) =>
  prismaDB2.mst_authorization.findMany({
    where,
    include: { role: { select: { role_name: true } }, department: { select: { department_name: true } } },
  });

// ---------- log ----------

export const createHistory = (data: any) => prismaDB2.tr_authdoc_history.create({ data });

export const createNotificationLog = (data: any) => prismaDB2.tr_notification_log_authdoc.create({ data });

export const createBypassLog = (data: any) => prismaDB2.tr_admin_bypass_log_authdoc.create({ data });
