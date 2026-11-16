import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./approver-change.repository";
import {
  sendApproverChangeRequestEmailAuthdoc,
  sendApproverChangeResultEmailAuthdoc,
  sendBypassNotificationEmailsAuthdoc,
} from "./approver-change.mail";
import { BypassDto, ChangeRequestListQuery, ProcessChangeRequestDto, RequestApproverChangeDto } from "./approver-change.dto";

/** Payload JWT (req.user). */
export type AuthUser = any;

/** Info request yang dicatat di log (ip & user agent). */
export interface RequestMeta {
  ip?: string;
  userAgent: string | null;
}

const ADMIN_ROLES = ["admin", "Admin", "Super Admin"];

/** role.role_name (format baru) > user_role (format lama). */
function getUserRole(user: AuthUser): string {
  if (!user) return "";
  if (user.role?.role_name) return user.role.role_name;
  if (user.user_role) return user.user_role;
  return "";
}

function requireAdmin(user: AuthUser) {
  // JWT tidak punya user_role; role ada di role.role_name
  if (!ADMIN_ROLES.includes(getUserRole(user))) throw new HttpError(403, { error: "Unauthorized: Admin access required" });
}

const searchOr = (searchTerm: string) => [
  { tr_authorization_doc: { doc_number: { contains: searchTerm, mode: "insensitive" } } },
  { reason: { contains: searchTerm, mode: "insensitive" } },
  { current_authorization: { employee_name: { contains: searchTerm, mode: "insensitive" } } },
  { new_authorization: { employee_name: { contains: searchTerm, mode: "insensitive" } } },
];

async function listRequests(query: ChangeRequestListQuery, whereClause: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const priority = query.priority as string;
  const searchTerm = query.search as string;

  if (priority && ["low", "normal", "high", "urgent"].includes(priority)) whereClause.priority = priority;
  if (searchTerm) whereClause.OR = searchOr(searchTerm);

  const [requests, totalCount] = await Promise.all([
    repo.findRequestPage(whereClause, (page - 1) * limit, limit),
    repo.countRequests(whereClause),
  ]);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: requests,
    pagination: {
      current_page: page,
      total_pages: totalPages,
      total_count: totalCount,
      limit,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}

// ==========================================
// 1. REQUEST PER DOKUMEN (admin)
// ==========================================

export async function listByAuthdoc(user: AuthUser, authorization_doc_id: string, query: ChangeRequestListQuery) {
  const status = query.status as string;

  let roleName = null;
  let roleSource = "unknown";
  if (user) {
    if (user.role?.role_name) {
      roleName = user.role.role_name;
      roleSource = "role.role_name";
    } else if (user.user_role) {
      roleName = user.user_role;
      roleSource = "user_role";
    }
  }

  if (!roleName || !["Admin", "Super Admin", "admin"].includes(roleName)) {
    throw new HttpError(403, {
      error: "Unauthorized: Admin access required",
      debug: process.env.NODE_ENV === "development" ? {
        detected_role: roleName,
        role_source: roleSource,
        user_role_field: user?.user_role,
        role_name_field: user?.role?.role_name,
        full_user: user,
      } : undefined,
    });
  }

  if (!authorization_doc_id || isNaN(Number(authorization_doc_id))) {
    throw new HttpError(400, { error: "Valid authorization_doc_id is required" });
  }

  const docId = Number(authorization_doc_id);
  const whereClause: any = { authorization_doc_id: docId, is_deleted: false };
  // default: hanya request pending
  whereClause.status = status && ["pending", "approved", "rejected"].includes(status) ? status : "pending";

  const [requests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    repo.findRequestsByDoc(whereClause),
    repo.countRequests({ authorization_doc_id: docId, status: "pending", is_deleted: false }),
    repo.countRequests({ authorization_doc_id: docId, status: "approved", is_deleted: false }),
    repo.countRequests({ authorization_doc_id: docId, status: "rejected", is_deleted: false }),
  ]);

  return {
    message: "Approval requests retrieved successfully",
    data: requests,
    summary: {
      authorization_doc_id: docId,
      doc_info: requests.length > 0 ? requests[0].tr_authorization_doc : null,
      pending_count: pendingCount,
      approved_count: approvedCount,
      rejected_count: rejectedCount,
      total_count: pendingCount + approvedCount + rejectedCount,
    },
  };
}

// ==========================================
// 2. USER MENGAJUKAN PERUBAHAN APPROVER
// ==========================================

export async function requestChange(user: AuthUser, body: RequestApproverChangeDto) {
  const { authorization_doc_id, approval_id, current_auth_id, new_auth_id, reason, urgent = false } = body;
  const requester_auth_id = user?.auth_id;

  if (!authorization_doc_id || !approval_id || !current_auth_id || !new_auth_id || !reason) {
    throw new HttpError(400, {
      error: "Missing required fields",
      required: ["authorization_doc_id", "approval_id", "current_auth_id", "new_auth_id", "reason"],
    });
  }

  const authDoc = await repo.findDocSummary(authorization_doc_id);
  if (!authDoc) throw new HttpError(404, { error: "Authorization document tidak ditemukan" });
  if (authDoc.status === "done") {
    throw new HttpError(400, { error: "Authorization document sudah selesai, tidak dapat mengubah approver" });
  }

  const approval = await repo.findApprovalSummary(approval_id);
  if (!approval) throw new HttpError(404, { error: "Approval step tidak ditemukan" });
  if (approval.authdoc_id !== authorization_doc_id) {
    throw new HttpError(400, { error: "Approval step tidak sesuai dengan authorization document" });
  }
  if (!["pending", "on_going"].includes(approval.status || "")) {
    throw new HttpError(400, { error: `Approval sudah diproses (${approval.status}), tidak dapat diubah` });
  }
  if (approval.auth_id !== current_auth_id) {
    throw new HttpError(400, { error: "Current approver tidak sesuai dengan data di sistem" });
  }

  const newApprover = await repo.findNewApprover(new_auth_id);
  if (!newApprover || newApprover.is_deleted || !newApprover.status) {
    throw new HttpError(400, { error: "Approver baru tidak valid atau tidak aktif" });
  }

  const currentApprover = await repo.findApproverBasic(current_auth_id);
  if (!currentApprover) throw new HttpError(400, { error: "Current approver tidak ditemukan" });

  const existingRequest = await repo.findPendingRequestForApproval(approval_id);
  if (existingRequest) throw new HttpError(400, { error: "Sudah ada request pending untuk approval step ini" });

  const changeRequest = await repo.createRequest({
    authorization_doc_id,
    approval_id,
    current_auth_id,
    new_auth_id,
    reason,
    urgent,
    requested_by: user?.employee_code || "",
    requester_auth_id,
    status: "pending",
    priority: urgent ? "urgent" : "normal",
    created_date: new Date(),
  });

  await sendApproverChangeRequestEmailAuthdoc(changeRequest);

  await repo.createHistory({
    authdoc_id: authorization_doc_id,
    auth_id: requester_auth_id,
    description: "Request perubahan approver disubmit",
    note: `Request mengubah approver step ${approval.step} (${approval.actor}) dari ${currentApprover.employee_name} ke ${newApprover.employee_name}. Alasan: ${reason}`,
    status: "change_requested",
    action_type: "change_approver",
    related_request_id: changeRequest.id,
    created_date: new Date(),
    created_by: user?.employee_code,
  });

  return {
    message: "Request perubahan approver berhasil disubmit",
    data: {
      request_id: changeRequest.id,
      authorization_doc: changeRequest.tr_authorization_doc,
      from_approver: changeRequest.current_authorization,
      to_approver: changeRequest.new_authorization,
      reason: changeRequest.reason,
      urgent: changeRequest.urgent,
      status: changeRequest.status,
      created_date: changeRequest.created_date,
    },
  };
}

// ==========================================
// 3. LIST PENDING / ALL (admin)
// ==========================================

export async function listPending(user: AuthUser, query: ChangeRequestListQuery) {
  requireAdmin(user);
  return {
    message: "Pending approver change requests retrieved successfully",
    ...(await listRequests(query, { status: "pending", is_deleted: false })),
  };
}

export async function listAll(user: AuthUser, query: ChangeRequestListQuery) {
  requireAdmin(user);
  const status = query.status as string;
  const whereClause: any = { is_deleted: false };
  // tanpa status = tampilkan semua
  if (status && ["pending", "approved", "rejected"].includes(status)) whereClause.status = status;
  return {
    message: "All approver change requests retrieved successfully",
    ...(await listRequests(query, whereClause)),
  };
}

// ==========================================
// 4. ADMIN MEMPROSES REQUEST (APPROVE/REJECT)
// ==========================================

export async function processRequest(user: AuthUser, id: string, body: ProcessChangeRequestDto, meta: RequestMeta) {
  const { status, admin_decision } = body;
  const admin_auth_id = user?.auth_id;

  if (!["approved", "rejected"].includes(status)) {
    throw new HttpError(400, { error: "Status harus 'approved' atau 'rejected'" });
  }
  if (!admin_decision || admin_decision.trim() === "") {
    throw new HttpError(400, { error: "Admin decision wajib diisi" });
  }

  const roleName = user?.role?.role_name;
  if (!["admin", "Super Admin", "Admin"].includes(roleName || "")) {
    throw new HttpError(403, {
      error: "Unauthorized: Admin access required",
      debug: { extractedRoleName: roleName, allowedRoles: ["admin", "Super Admin", "Admin"] },
    });
  }

  const changeRequest = await repo.findRequestForProcess(Number(id));
  if (!changeRequest) throw new HttpError(404, { error: "Request tidak ditemukan" });
  if (changeRequest.status !== "pending") {
    throw new HttpError(400, { error: `Request sudah diproses dengan status: ${changeRequest.status}` });
  }

  const approval = changeRequest.tr_authdoc_approval;
  if (!approval || !["pending", "on_going"].includes(approval.status || "")) {
    throw new HttpError(400, { error: `Approval step sudah diproses (${approval?.status}), tidak dapat diubah` });
  }

  const processedDate = new Date();
  let updatedApproval = null;

  // struktur token: nik & name
  const employeeCode = user?.nik || `USER_${admin_auth_id}`;
  const employeeName = user?.name || "Admin User";

  const updatedRequest = await repo.updateRequest(Number(id), {
    status: status as "approved" | "rejected",
    admin_decision: admin_decision.trim(),
    processed_by: employeeCode,
    processed_by_auth_id: admin_auth_id,
    processed_date: processedDate,
  });

  if (status === "approved") {
    const currentApproval = approval;
    const newVersion = (currentApproval?.version || 1) + 1;

    updatedApproval = await repo.updateApproval(changeRequest.approval_id, {
      auth_id: changeRequest.new_auth_id,
      version: newVersion,
      original_auth_id: changeRequest.current_auth_id,
      changed_from_request_id: changeRequest.id,
      change_reason: changeRequest.reason,
      changed_by: admin_auth_id,
      changed_date: processedDate,
      is_changed: true,
      note: `Approver diubah dari ${changeRequest.current_authorization?.employee_name} ke ${changeRequest.new_authorization?.employee_name} berdasarkan request #${changeRequest.id}. Keputusan admin: ${admin_decision}`,
    });

    await repo.createChangeHistory({
      approval_id: changeRequest.approval_id,
      authorization_doc_id: changeRequest.authorization_doc_id,
      change_request_id: changeRequest.id,
      action_type: "change_approved",
      from_auth_id: changeRequest.current_auth_id,
      to_auth_id: changeRequest.new_auth_id,
      version_from: currentApproval?.version || 1,
      version_to: newVersion,
      reason: changeRequest.reason,
      actor_auth_id: admin_auth_id,
      actor_name: employeeName,
      actor_role: roleName,
      metadata: {
        admin_decision,
        request_id: changeRequest.id,
        processed_by: employeeCode,
        urgent: changeRequest.urgent,
        priority: changeRequest.priority,
      },
      created_date: processedDate,
      ip_address: meta.ip,
    });

    await repo.createHistory({
      authdoc_id: changeRequest.authorization_doc_id,
      auth_id: admin_auth_id,
      description: "Approver berhasil diubah oleh admin",
      note: `Approver step ${currentApproval?.step} (${currentApproval?.actor}) diubah dari ${changeRequest.current_authorization?.employee_name} ke ${changeRequest.new_authorization?.employee_name}. Keputusan admin: ${admin_decision}`,
      status: "approver_changed",
      action_type: "change_approver",
      related_request_id: changeRequest.id,
      created_date: processedDate,
      created_by: employeeCode,
    });
  } else {
    await repo.createHistory({
      authdoc_id: changeRequest.authorization_doc_id,
      auth_id: admin_auth_id,
      description: "Request perubahan approver ditolak oleh admin",
      note: `Request mengubah approver step ${approval?.step} dari ${changeRequest.current_authorization?.employee_name} ke ${changeRequest.new_authorization?.employee_name} ditolak. Keputusan admin: ${admin_decision}`,
      status: "change_rejected",
      action_type: "change_approver",
      related_request_id: changeRequest.id,
      created_date: processedDate,
      created_by: employeeCode,
    });
  }

  await sendApproverChangeResultEmailAuthdoc(changeRequest, status, admin_decision);

  await repo.createNotificationLog({
    notification_type: `approver_change_${status}`,
    recipients: [changeRequest.requester_authorization?.email || ""].filter(Boolean),
    sent_count: changeRequest.requester_authorization?.email ? 1 : 0,
    urgent: changeRequest.urgent,
    related_id: changeRequest.id,
    details: {
      request_id: changeRequest.id,
      admin_decision,
      processed_by: employeeCode,
      processed_by_name: employeeName,
    },
  });

  return {
    message: `Request berhasil ${status === "approved" ? "disetujui" : "ditolak"}`,
    data: {
      request_id: changeRequest.id,
      status: updatedRequest.status,
      admin_decision,
      processed_by: employeeName,
      processed_date: processedDate,
      updated_approval: updatedApproval ? {
        id: updatedApproval.id,
        new_approver: changeRequest.new_authorization,
        version: updatedApproval.version,
        changed_date: updatedApproval.changed_date,
      } : null,
    },
  };
}

// ==========================================
// 5. STATISTIK & DETAIL
// ==========================================

export async function getStats(user: AuthUser) {
  requireAdmin(user);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [pendingCount, approvedCount, rejectedCount, urgentCount, recentRequestsCount] = await Promise.all([
    repo.countRequests({ status: "pending", is_deleted: false }),
    repo.countRequests({ status: "approved", is_deleted: false }),
    repo.countRequests({ status: "rejected", is_deleted: false }),
    repo.countRequests({ urgent: true, status: "pending", is_deleted: false }),
    repo.countRequests({ created_date: { gte: sevenDaysAgo }, is_deleted: false }),
  ]);

  return {
    message: "Approver change request statistics retrieved successfully",
    data: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      urgent: urgentCount,
      recent_requests: recentRequestsCount,
      total: pendingCount + approvedCount + rejectedCount,
    },
  };
}

/** Detail request (tanpa cek admin: user boleh melihat request miliknya). */
export async function getDetail(id: string) {
  if (!id || isNaN(Number(id))) throw new HttpError(400, { error: "Valid request ID is required" });

  const [request, approvalHistory] = await Promise.all([
    repo.findRequestDetail(Number(id)),
    repo.findChangeHistoryOfRequest(Number(id)),
  ]);
  if (!request) throw new HttpError(404, { error: "Approval request not found" });

  return {
    message: "Approval request detail retrieved successfully",
    data: { request, approval_history: approvalHistory },
  };
}

// ==========================================
// 6. BYPASS OLEH SUPER ADMIN
// ==========================================

/** role.role_name > user_role */
const bypassUserRole = (user: AuthUser): string | undefined => (user ? user.role?.role_name || user.user_role : undefined);
/** employee_name > name */
const bypassEmployeeName = (user: AuthUser): string | undefined => (user ? user.employee_name || user.name : undefined);
/** employee_code > nik */
const bypassEmployeeCode = (user: AuthUser): string | undefined => (user ? user.employee_code || user.nik : undefined);

export async function bypass(user: AuthUser, body: BypassDto, meta: RequestMeta) {
  const { authorization_doc_id, target_status, reason, bypass_type = "approval_system" } = body;

  const admin_auth_id = user?.auth_id;
  const userRole = bypassUserRole(user);
  const employeeName = bypassEmployeeName(user);
  const employeeCode = bypassEmployeeCode(user);

  if (!authorization_doc_id || !target_status || !reason) {
    throw new HttpError(400, { error: "Missing required fields", required: ["authorization_doc_id", "target_status", "reason"] });
  }

  if (!["approved", "done"].includes(target_status)) {
    throw new HttpError(400, { error: "Target status must be 'approved' (partial bypass) or 'done' (full complete)" });
  }

  if (userRole !== "Super Admin") {
    console.warn("ADMIN BYPASS AUTHDOC ERROR: Unauthorized attempt by non-Super Admin.", { user_role: userRole, auth_id: admin_auth_id });
    throw new HttpError(403, { error: "Unauthorized: Super admin access required for bypass operation" });
  }

  const authDoc = await repo.findDocForBypass(authorization_doc_id);
  if (!authDoc) throw new HttpError(404, { error: "Authorization document tidak ditemukan" });

  if (authDoc.status === "done" && authDoc.progress === "100%") {
    throw new HttpError(400, { error: `Authorization document sudah dalam status ${authDoc.status} dengan progress 100%` });
  }

  const bypassTimestamp = new Date();
  const originalStatus = authDoc.status;
  const originalProgress = authDoc.progress;

  let finalDocumentStatus = "";
  let newProgress = "";
  let affectedApprovals: any[] = []; // approval yang langsung di-set 'approved'
  let bypassStrategy = "";
  let approvalUpdateFilter: any = {};
  let transitionedApprover: any = null;

  if (target_status === "approved") {
    // PARTIAL: hanya step 'on_going' yang di-bypass, dokumen tetap on_progress
    bypassStrategy = "partial";
    finalDocumentStatus = "on_progress";

    const onGoingApprovals = authDoc.authdocApprovals.filter((approval) => approval.status === "on_going");
    const approvedCount = authDoc.authdocApprovals.filter((approval) => approval.status === "approved").length;
    const totalApprovals = authDoc.authdocApprovals.length;

    const progressPercentage = Math.round(((approvedCount + onGoingApprovals.length) / totalApprovals) * 100);
    newProgress = `${progressPercentage}%`;

    affectedApprovals = onGoingApprovals;
    approvalUpdateFilter = { status: "on_going" };

    if (onGoingApprovals.length === 0) {
      throw new HttpError(400, { error: "Tidak ada approval yang sedang berjalan (on_going) untuk di-bypass secara partial" });
    }
  } else if (target_status === "done") {
    // FULL: semua 'pending' + 'on_going' di-bypass, dokumen done
    bypassStrategy = "full";
    finalDocumentStatus = "done";
    newProgress = "100%";

    affectedApprovals = authDoc.authdocApprovals.filter((approval) => ["pending", "on_going"].includes(approval.status || ""));
    approvalUpdateFilter = { status: { in: ["pending", "on_going"] } };

    if (affectedApprovals.length === 0) {
      throw new HttpError(400, { error: "Tidak ada approval yang pending atau on_going untuk di-bypass" });
    }
  } else {
    throw new HttpError(400, { error: "Invalid target_status provided" });
  }

  await repo.updateDoc(authorization_doc_id, { status: finalDocumentStatus, progress: newProgress, updated_at: bypassTimestamp });

  if (affectedApprovals.length > 0) {
    await repo.updateApprovalsWhere(
      { authdoc_id: authorization_doc_id, ...approvalUpdateFilter },
      {
        status: "approved",
        updated_date: bypassTimestamp,
        note: `Bypassed by super admin (${employeeName}) - ${bypassStrategy} bypass: ${reason}`,
      },
    );
  }

  // PARTIAL: step 'pending' pertama berikutnya menjadi 'on_going'
  if (bypassStrategy === "partial") {
    const updatedApprovals = await repo.findApprovalsOfDoc(authorization_doc_id);
    const nextPendingApproval = updatedApprovals.find((app) => app.status === "pending");
    if (nextPendingApproval) {
      transitionedApprover = await repo.updateApprovalWithAuthorization(nextPendingApproval.id, {
        status: "on_going",
        updated_date: bypassTimestamp,
        note: `Approval step transitioned to on_going by super admin bypass (${employeeName}) after previous step bypass`,
      });
    }
  }

  const loggableAffectedApprovals: any[] = affectedApprovals.map((approval) => ({
    auth_id: approval.auth_id,
    employee_name: approval.authorization?.employee_name,
    employee_code: approval.authorization?.employee_code,
    step: approval.step,
    actor: approval.actor,
    original_status: approval.status,
    final_status: "approved",
    reason: `Bypassed to approved by admin.`,
  }));
  if (transitionedApprover) {
    loggableAffectedApprovals.push({
      auth_id: transitionedApprover.auth_id,
      employee_name: transitionedApprover.authorization?.employee_name,
      employee_code: transitionedApprover.authorization?.employee_code,
      step: transitionedApprover.step,
      actor: transitionedApprover.actor,
      original_status: "pending",
      final_status: "on_going",
      reason: `Next pending step transitioned to on_going by admin bypass logic.`,
    });
  }

  const bypassLog = await repo.createBypassLog({
    authorization_doc_id,
    admin_auth_id: admin_auth_id!,
    bypass_type,
    target_status: finalDocumentStatus,
    original_status: originalStatus,
    original_progress: originalProgress,
    new_progress: newProgress,
    reason,
    affected_approvers_count: loggableAffectedApprovals.length,
    affected_approvers_list: loggableAffectedApprovals,
    bypass_timestamp: bypassTimestamp,
    ip_address: meta.ip,
    user_agent: meta.userAgent,
  });

  await repo.createHistory({
    authdoc_id: authorization_doc_id,
    auth_id: admin_auth_id,
    description: `Sistem approval di-bypass oleh super admin (${bypassStrategy} bypass)`,
    note: `Super admin ${bypassStrategy} bypass oleh ${employeeName}: ${reason}. Status diubah dari ${originalStatus} ke ${finalDocumentStatus}. Progress: ${originalProgress} → ${newProgress}. ${loggableAffectedApprovals.length} approver terpengaruh.`,
    status: finalDocumentStatus,
    action_type: "admin_bypass",
    related_bypass_id: bypassLog.id,
    metadata: {
      bypass_strategy: bypassStrategy,
      target_status: finalDocumentStatus,
      affected_approvers_count: loggableAffectedApprovals.length,
      affected_approvers_list: loggableAffectedApprovals,
      admin_info: { name: employeeName, code: employeeCode, role: userRole },
    },
    created_date: bypassTimestamp,
    created_by: employeeCode,
    ip_address: meta.ip,
  });

  const userForEmail = {
    employee_name: employeeName,
    employee_code: employeeCode,
    user_role: userRole,
    auth_id: admin_auth_id,
    email: user?.email,
  };
  // email hanya ke approver yang langsung di-set 'approved' (+ submitter, diatur di mail)
  await sendBypassNotificationEmailsAuthdoc(authDoc, affectedApprovals, reason, userForEmail);

  await repo.createNotificationLog({
    notification_type: "admin_bypass",
    recipients: affectedApprovals.map((approval) => approval.authorization?.email).filter(Boolean) as string[],
    sent_count: affectedApprovals.filter((approval) => approval.authorization?.email).length,
    urgent: true,
    related_id: bypassLog.id,
    details: {
      authorization_doc_id,
      target_status: finalDocumentStatus,
      bypass_reason: reason,
      bypass_strategy: bypassStrategy,
      requested_target_status: target_status,
      affected_approvers_count: loggableAffectedApprovals.length,
      bypassed_by: employeeName,
      doc_number: authDoc.doc_number,
      original_status: originalStatus,
      original_progress: originalProgress,
    },
  });

  return {
    message: `Approval system berhasil di-bypass menggunakan ${bypassStrategy} strategy ke status ${finalDocumentStatus}. ${transitionedApprover ? `Langkah berikutnya (${transitionedApprover.actor}) telah diubah menjadi 'on_going'.` : ""}`,
    data: {
      authorization_doc_id: authorization_doc_id,
      doc_number: authDoc.doc_number,
      original_status: originalStatus,
      new_status: finalDocumentStatus,
      original_progress: originalProgress,
      new_progress: newProgress,
      affected_approvers: loggableAffectedApprovals.length,
      bypass_log_id: bypassLog.id,
      bypassed_by: employeeName,
      bypass_timestamp: bypassTimestamp,
      bypass_strategy: bypassStrategy,
      strategy_details: {
        requested_target: target_status,
        final_status: finalDocumentStatus,
        approvals_status: target_status === "approved" ? "current on_going become approved, next pending become on_going" : "all pending/on_going become approved",
        strategy_type: bypassStrategy,
        progress_calculation: target_status === "approved" ? "calculated based on completed + bypassed steps" : "set to 100%",
        affected_approval_types: target_status === "approved" ? "on_going bypassed + next pending transitioned" : "pending + on_going bypassed",
      },
      transitioned_next_approver: transitionedApprover ? {
        auth_id: transitionedApprover.auth_id,
        employee_name: transitionedApprover.authorization?.employee_name,
        employee_code: transitionedApprover.authorization?.employee_code,
        step: transitionedApprover.step,
        actor: transitionedApprover.actor,
        status: "on_going",
      } : null,
    },
  };
}
