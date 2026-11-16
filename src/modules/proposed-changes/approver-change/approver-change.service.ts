import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./approver-change.repository";
import { sendApproverChangeRequestEmail, sendApproverChangeResultEmail, sendBypassNotificationEmails } from "./approver-change.mail";

// Cek role admin tetap di service: role dibaca dari role.role_name ATAU user_role (format lama),
// dan body 403-nya berbeda dari requireRole.

export interface AuthenticatedUser {
  auth_id?: number;
  nik?: string;
  name?: string;
  employee_code?: string;
  employee_name?: string;
  email?: string;
  user_role?: string;
  role?: { id?: number; role_name?: string; description?: string };
  department?: any;
  site?: any;
  section?: any;
}

/** Info koneksi untuk audit log. */
export interface ClientInfo {
  ip?: string;
  userAgent: string | null;
}

/** Prioritas: role.role_name (format baru) > user_role (format lama). */
function getUserRole(user: AuthenticatedUser | undefined): string {
  if (!user) return "";
  return user.role?.role_name || user.user_role || "";
}

const requireAdmin = (user: AuthenticatedUser | undefined) => {
  if (!["admin", "Admin", "Super Admin"].includes(getUserRole(user))) {
    throw new HttpError(403, { error: "Unauthorized: Admin access required" });
  }
};

const listPagination = (totalCount: number, page: number, limit: number) => {
  const totalPages = Math.ceil(totalCount / limit);
  return { current_page: page, total_pages: totalPages, total_count: totalCount, limit, has_next: page < totalPages, has_prev: page > 1 };
};

const searchOr = (searchTerm: string) => [
  { tr_proposed_changes: { project_name: { contains: searchTerm, mode: "insensitive" } } },
  { reason: { contains: searchTerm, mode: "insensitive" } },
  { mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization: { employee_name: { contains: searchTerm, mode: "insensitive" } } },
  { mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization: { employee_name: { contains: searchTerm, mode: "insensitive" } } },
];

// ==================== Query ====================

/** GET /approver-change/by-proposed/:proposed_changes_id (admin) */
export async function listByProposedId(user: AuthenticatedUser | undefined, proposed_changes_id: string, status: string) {
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

  // cek role SEBELUM validasi id (urutan lama: 403 lebih dulu dari 400)
  if (!roleName || !["Admin", "Super Admin", "admin"].includes(roleName)) {
    console.warn("❌ Unauthorized access attempt:", { roleName, roleSource });
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

  if (!proposed_changes_id || isNaN(Number(proposed_changes_id))) {
    console.warn("❌ Invalid proposed_changes_id:", proposed_changes_id);
    throw new HttpError(400, { error: "Valid proposed_changes_id is required" });
  }

  const whereClause: any = { proposed_changes_id: Number(proposed_changes_id), is_deleted: false };
  // default: pending
  whereClause.status = status && ["pending", "approved", "rejected"].includes(status) ? status : "pending";

  const requests = await repo.findByProposedId(whereClause);

  const countWhere = (s: string) => ({ proposed_changes_id: Number(proposed_changes_id), status: s, is_deleted: false });
  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    repo.count(countWhere("pending")),
    repo.count(countWhere("approved")),
    repo.count(countWhere("rejected")),
  ]);

  return {
    message: "Approval requests retrieved successfully",
    data: requests,
    summary: {
      proposed_changes_id: Number(proposed_changes_id),
      project_info: requests.length > 0 ? requests[0].tr_proposed_changes : null,
      pending_count: pendingCount,
      approved_count: approvedCount,
      rejected_count: rejectedCount,
      total_count: pendingCount + approvedCount + rejectedCount,
    },
  };
}

/** GET /approver-change/pending (admin) */
export async function listPending(user: AuthenticatedUser | undefined, query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const priority = query.priority as string;
  const searchTerm = query.search as string;

  requireAdmin(user);

  const whereClause: any = { status: "pending", is_deleted: false };
  if (priority && ["low", "normal", "high", "urgent"].includes(priority)) whereClause.priority = priority;
  if (searchTerm) whereClause.OR = searchOr(searchTerm);

  const [requests, totalCount] = await repo.findPage(whereClause, (page - 1) * limit, limit);
  return {
    message: "Pending approver change requests retrieved successfully",
    data: requests,
    pagination: listPagination(totalCount, page, limit),
  };
}

/** GET /approver-change/all (admin) */
export async function listAll(user: AuthenticatedUser | undefined, query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const priority = query.priority as string;
  const status = query.status as string;
  const searchTerm = query.search as string;

  requireAdmin(user);

  const whereClause: any = { is_deleted: false };
  if (status && ["pending", "approved", "rejected"].includes(status)) whereClause.status = status;
  if (priority && ["low", "normal", "high", "urgent"].includes(priority)) whereClause.priority = priority;
  if (searchTerm) whereClause.OR = searchOr(searchTerm);

  const [requests, totalCount] = await repo.findPage(whereClause, (page - 1) * limit, limit);
  return {
    message: "All approver change requests retrieved successfully",
    data: requests,
    pagination: listPagination(totalCount, page, limit),
  };
}

/** GET /approver-change/stats (admin) */
export async function stats(user: AuthenticatedUser | undefined) {
  requireAdmin(user);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [pendingCount, approvedCount, rejectedCount, urgentCount, recentRequestsCount] = await Promise.all([
    repo.count({ status: "pending", is_deleted: false }),
    repo.count({ status: "approved", is_deleted: false }),
    repo.count({ status: "rejected", is_deleted: false }),
    repo.count({ urgent: true, status: "pending", is_deleted: false }),
    repo.count({ created_date: { gte: sevenDaysAgo }, is_deleted: false }),
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

/** GET /approver-change/detail/:id */
export async function getDetail(id: string) {
  if (!id || isNaN(Number(id))) throw new HttpError(400, { error: "Valid request ID is required" });

  // history dikunci oleh request.id (== Number(id)), jadi dibaca bersamaan
  const [request, approvalHistory] = await Promise.all([
    repo.findRequestDetail(Number(id)),
    repo.findChangeHistoryByRequestId(Number(id)),
  ]);
  if (!request) throw new HttpError(404, { error: "Approval request not found" });

  return {
    message: "Approval request detail retrieved successfully",
    data: { request, approval_history: approvalHistory },
  };
}

// ==================== Command ====================

/** POST /approver-change/request — user mengajukan pergantian approver. */
export async function requestChange(user: AuthenticatedUser | undefined, body: any) {
  const { proposed_changes_id, approval_id, current_auth_id, new_auth_id, reason, urgent = false } = body;
  const requester_auth_id = user?.auth_id;

  // body 400 khusus { error, required }, jadi tetap di service
  if (!proposed_changes_id || !approval_id || !current_auth_id || !new_auth_id || !reason) {
    console.warn("⚠️ Missing required fields:", body);
    throw new HttpError(400, {
      error: "Missing required fields",
      required: ["proposed_changes_id", "approval_id", "current_auth_id", "new_auth_id", "reason"],
    });
  }

  const [proposedChange, approval, newApprover, currentApprover, existingRequest] = await Promise.all([
    repo.findProposedChangeSummary(proposed_changes_id),
    repo.findApprovalSummary(approval_id),
    repo.findActiveCheckAuthorization(new_auth_id),
    repo.findAuthorizationContact(current_auth_id),
    repo.findPendingByApprovalId(approval_id),
  ]);

  if (!proposedChange || proposedChange.is_deleted) {
    throw new HttpError(404, { error: "Proposed change tidak ditemukan atau sudah dihapus" });
  }
  if (proposedChange.status === "done") {
    throw new HttpError(400, { error: "Proposed change sudah selesai, tidak dapat mengubah approver" });
  }
  if (!approval) throw new HttpError(404, { error: "Approval step tidak ditemukan" });
  if (approval.proposed_changes_id !== proposed_changes_id) {
    throw new HttpError(400, { error: "Approval step tidak sesuai dengan proposed change" });
  }
  if (!["pending", "on_going"].includes(approval.status || "")) {
    throw new HttpError(400, { error: `Approval sudah diproses (${approval.status}), tidak dapat diubah` });
  }
  if (approval.auth_id !== current_auth_id) {
    throw new HttpError(400, { error: "Current approver tidak sesuai dengan data di sistem" });
  }
  if (!newApprover || newApprover.is_deleted || !newApprover.status) {
    throw new HttpError(400, { error: "Approver baru tidak valid atau tidak aktif" });
  }
  if (!currentApprover) throw new HttpError(400, { error: "Current approver tidak ditemukan" });
  if (existingRequest) throw new HttpError(400, { error: "Sudah ada request pending untuk approval step ini" });

  const changeRequest = await repo.createRequest({
    proposed_changes_id,
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

  await sendApproverChangeRequestEmail(changeRequest);

  await repo.createProposedHistory({
    proposed_changes_id,
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
      proposed_changes: changeRequest.tr_proposed_changes,
      from_approver: changeRequest.mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization,
      to_approver: changeRequest.mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization,
      reason: changeRequest.reason,
      urgent: changeRequest.urgent,
      status: changeRequest.status,
      created_date: changeRequest.created_date,
    },
  };
}

/** PATCH /approver-change/:id/process — admin menyetujui / menolak request. */
export async function processRequest(user: AuthenticatedUser | undefined, id: string, body: any, client: ClientInfo) {
  const { status, admin_decision } = body;
  const admin_auth_id = user?.auth_id;

  // urutan lama: validasi input (400) sebelum cek role (403)
  if (!["approved", "rejected"].includes(status)) {
    throw new HttpError(400, { error: "Status harus 'approved' atau 'rejected'" });
  }
  if (!admin_decision || admin_decision.trim() === "") {
    throw new HttpError(400, { error: "Admin decision wajib diisi" });
  }

  const userAny = user as any;
  const roleName = userAny?.role?.role_name;
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

  const approval = changeRequest.tr_proposed_changes_approval_tr_approver_change_request_approval_idTotr_proposed_changes_approval;
  if (!approval || !["pending", "on_going"].includes(approval.status || "")) {
    throw new HttpError(400, { error: `Approval step sudah diproses (${approval?.status}), tidak dapat diubah` });
  }

  const processedDate = new Date();
  let updatedApproval = null;

  const employeeCode = userAny?.nik || `USER_${admin_auth_id}`;
  const employeeName = userAny?.name || "Admin User";
  const fromName = changeRequest.mst_authorization_tr_approver_change_request_current_auth_idTomst_authorization?.employee_name;
  const toName = changeRequest.mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization?.employee_name;

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
      note: `Approver diubah dari ${fromName} ke ${toName} berdasarkan request #${changeRequest.id}. Keputusan admin: ${admin_decision}`,
    });

    await repo.createChangeHistory({
      approval_id: changeRequest.approval_id,
      proposed_changes_id: changeRequest.proposed_changes_id,
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
      ip_address: client.ip,
    });

    await repo.createProposedHistory({
      proposed_changes_id: changeRequest.proposed_changes_id,
      auth_id: admin_auth_id,
      description: "Approver berhasil diubah oleh admin",
      note: `Approver step ${currentApproval?.step} (${currentApproval?.actor}) diubah dari ${fromName} ke ${toName}. Keputusan admin: ${admin_decision}`,
      status: "approver_changed",
      action_type: "change_approver",
      related_request_id: changeRequest.id,
      created_date: processedDate,
      created_by: employeeCode,
    });
  } else {
    await repo.createProposedHistory({
      proposed_changes_id: changeRequest.proposed_changes_id,
      auth_id: admin_auth_id,
      description: "Request perubahan approver ditolak oleh admin",
      note: `Request mengubah approver step ${approval?.step} dari ${fromName} ke ${toName} ditolak. Keputusan admin: ${admin_decision}`,
      status: "change_rejected",
      action_type: "change_approver",
      related_request_id: changeRequest.id,
      created_date: processedDate,
      created_by: employeeCode,
    });
  }

  await sendApproverChangeResultEmail(changeRequest, status, admin_decision);

  const requester = changeRequest.mst_authorization_tr_approver_change_request_requester_auth_idTomst_authorization;
  await repo.createNotificationLog({
    notification_type: `approver_change_${status}`,
    recipients: [requester?.email || ""].filter(Boolean),
    sent_count: requester?.email ? 1 : 0,
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
        new_approver: changeRequest.mst_authorization_tr_approver_change_request_new_auth_idTomst_authorization,
        version: updatedApproval.version,
        changed_date: updatedApproval.changed_date,
      } : null,
    },
  };
}

// ==================== Bypass ====================

/** POST /approver-change/bypass — Super Admin melewati sistem approval (partial / full). */
export async function bypass(user: AuthenticatedUser | undefined, body: any, client: ClientInfo) {
  const { proposed_changes_id, target_status, reason, bypass_type = "approval_system" } = body;

  const admin_auth_id = user?.auth_id;
  // bypass: role.role_name > user_role, nama: employee_name > name, kode: employee_code > nik
  const userRole = user ? user.role?.role_name || user.user_role : undefined;
  const employeeName = user ? user.employee_name || user.name : undefined;
  const employeeCode = user ? user.employee_code || user.nik : undefined;

  if (!proposed_changes_id || !target_status || !reason) {
    console.warn("ADMIN BYPASS ERROR: Missing required fields in request body.", { proposed_changes_id, target_status, reason });
    throw new HttpError(400, { error: "Missing required fields", required: ["proposed_changes_id", "target_status", "reason"] });
  }
  if (!["approved", "done"].includes(target_status)) {
    console.warn("ADMIN BYPASS ERROR: Invalid target_status.", { target_status });
    throw new HttpError(400, { error: "Target status must be 'approved' (partial bypass) or 'done' (full complete)" });
  }
  if (userRole !== "Super Admin") {
    console.warn("ADMIN BYPASS ERROR: Unauthorized attempt by non-Super Admin.", { user_role: userRole, auth_id: admin_auth_id });
    throw new HttpError(403, { error: "Unauthorized: Super admin access required for bypass operation" });
  }

  const proposedChange = await repo.findProposedChangeForBypass(proposed_changes_id);
  if (!proposedChange) throw new HttpError(404, { error: "Proposed change tidak ditemukan" });
  if (proposedChange.is_deleted) throw new HttpError(400, { error: "Proposed change sudah dihapus" });
  if (proposedChange.status === "done" && proposedChange.progress === "100%") {
    throw new HttpError(400, { error: `Proposed change sudah dalam status ${proposedChange.status} dengan progress 100%` });
  }

  const bypassTimestamp = new Date();
  const originalStatus = proposedChange.status;
  const originalProgress = proposedChange.progress;

  let finalProposedChangeStatus = "";
  let newProgress = "";
  let affectedApprovals: any[] = []; // approval yang langsung di-set 'approved'
  let bypassStrategy = "";
  let approvalUpdateFilter: any = {};
  let transitionedApprover: any = null;

  if (target_status === "approved") {
    // PARTIAL: hanya approval on_going
    bypassStrategy = "partial";
    finalProposedChangeStatus = "on_progress";

    const onGoingApprovals = proposedChange.approvals.filter((approval) => approval.status === "on_going");
    const approvedCount = proposedChange.approvals.filter((approval) => approval.status === "approved").length;
    const totalApprovals = proposedChange.approvals.length;

    // progress = sudah approved + yang baru di-bypass
    newProgress = `${Math.round(((approvedCount + onGoingApprovals.length) / totalApprovals) * 100)}%`;
    affectedApprovals = onGoingApprovals;
    approvalUpdateFilter = { status: "on_going" };

    if (onGoingApprovals.length === 0) {
      throw new HttpError(400, { error: "Tidak ada approval yang sedang berjalan (on_going) untuk di-bypass secara partial" });
    }
  } else if (target_status === "done") {
    // FULL: semua pending + on_going
    bypassStrategy = "full";
    finalProposedChangeStatus = "done";
    newProgress = "100%";

    affectedApprovals = proposedChange.approvals.filter((approval) => ["pending", "on_going"].includes(approval.status || ""));
    approvalUpdateFilter = { status: { in: ["pending", "on_going"] } };

    if (affectedApprovals.length === 0) {
      throw new HttpError(400, { error: "Tidak ada approval yang pending atau on_going untuk di-bypass" });
    }
  } else {
    throw new HttpError(400, { error: "Invalid target_status provided" });
  }

  await repo.updateProposedChange(proposed_changes_id, {
    status: finalProposedChangeStatus,
    progress: newProgress,
    bypass_by: admin_auth_id,
    bypass_date: bypassTimestamp,
    bypass_reason: reason,
    is_bypassed: true,
  });

  if (affectedApprovals.length > 0) {
    await repo.updateApprovals(
      { proposed_changes_id, ...approvalUpdateFilter },
      {
        status: "approved",
        updated_date: bypassTimestamp,
        note: `Bypassed by super admin (${employeeName}) - ${bypassStrategy} bypass: ${reason}`,
      },
    );
  }

  // PARTIAL: approval pending pertama (urut step) menjadi on_going
  if (bypassStrategy === "partial") {
    const updatedApprovals = await repo.findApprovalsByProposedId(proposed_changes_id);
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
    proposed_changes_id,
    admin_auth_id: admin_auth_id!,
    bypass_type,
    target_status: finalProposedChangeStatus,
    original_status: originalStatus,
    original_progress: originalProgress,
    new_progress: newProgress,
    reason,
    affected_approvers_count: loggableAffectedApprovals.length,
    affected_approvers_list: loggableAffectedApprovals,
    bypass_timestamp: bypassTimestamp,
    ip_address: client.ip,
    user_agent: client.userAgent,
  });

  await repo.createProposedHistory({
    proposed_changes_id,
    auth_id: admin_auth_id,
    description: `Sistem approval di-bypass oleh super admin (${bypassStrategy} bypass)`,
    note: `Super admin ${bypassStrategy} bypass oleh ${employeeName}: ${reason}. Status diubah dari ${originalStatus} ke ${finalProposedChangeStatus}. Progress: ${originalProgress} → ${newProgress}. ${loggableAffectedApprovals.length} approver terpengaruh.`,
    status: finalProposedChangeStatus,
    action_type: "admin_bypass",
    related_bypass_id: bypassLog.id,
    created_date: bypassTimestamp,
    created_by: employeeCode,
    ip_address: client.ip,
  });

  const userForEmail = {
    employee_name: employeeName,
    employee_code: employeeCode,
    user_role: userRole,
    auth_id: admin_auth_id,
    email: user?.email,
  };
  // email hanya ke approver yang langsung di-set 'approved'
  await sendBypassNotificationEmails(proposedChange, affectedApprovals, reason, userForEmail);

  await repo.createNotificationLog({
    notification_type: "admin_bypass",
    recipients: affectedApprovals.map((approval) => approval.authorization?.email).filter(Boolean) as string[],
    sent_count: affectedApprovals.filter((approval) => approval.authorization?.email).length,
    urgent: true,
    related_id: bypassLog.id,
    details: {
      proposed_changes_id,
      target_status: finalProposedChangeStatus,
      bypass_reason: reason,
      bypass_strategy: bypassStrategy,
      requested_target_status: target_status,
      affected_approvers_count: loggableAffectedApprovals.length,
      bypassed_by: employeeName,
    },
  });

  return {
    message: `Approval system berhasil di-bypass menggunakan ${bypassStrategy} strategy ke status ${finalProposedChangeStatus}. ${transitionedApprover ? `Langkah berikutnya (${transitionedApprover.actor}) telah diubah menjadi 'on_going'.` : ""}`,
    data: {
      proposed_change_id: proposed_changes_id,
      project_name: proposedChange.project_name,
      original_status: originalStatus,
      new_status: finalProposedChangeStatus,
      original_progress: originalProgress,
      new_progress: newProgress,
      affected_approvers: loggableAffectedApprovals.length,
      bypass_log_id: bypassLog.id,
      bypassed_by: employeeName,
      bypass_timestamp: bypassTimestamp,
      bypass_strategy: bypassStrategy,
      strategy_details: {
        requested_target: target_status,
        final_status: finalProposedChangeStatus,
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
