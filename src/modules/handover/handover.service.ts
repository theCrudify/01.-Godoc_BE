import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./handover.repository";
import { Db } from "./handover.repository";
import {
  CreateHandoverDto,
  ListApproverHandoversQuery,
  ListHandoversQuery,
  UpdateHandoverApprovalDto,
  UpdateHandoverDto,
} from "./handover.dto";
import { sendSubmissionEmails } from "./handover-submit.mail";
import { sendHandoverUpdateNotificationEmails } from "./handover-update.mail";
import { sendHandoverApprovalEmails } from "./handover-approval.mail";

// =====================================================================
// Create
// =====================================================================

interface SingleAdditionalApprover {
  id: number;
  employee_code: string | null;
  employee_name: string | null;
  actor_name: string;
  section_id: number;
  line_code: string;
  insert_position: number;
}

/** Kegagalan query saat create → controller membalas 500 "Database Error". */
export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = "DatabaseError";
  }
}

const validationError = (message: string, field?: string) =>
  new HttpError(400, { success: false, error: "Validation Error", message, field });

function validateHandoverData(data: CreateHandoverDto): void {
  const requiredFields = [
    "doc_number", "auth_id", "proposed_change_id",
    "plant_id", "department_id", "section_department_id",
    "material", "created_by",
  ];

  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw validationError(`Missing required fields: ${missingFields.join(", ")}`);
  }

  if (!data.doc_number.includes("/") || data.doc_number.split("/").length < 2) {
    throw validationError("Invalid doc_number format. Must follow pattern: XX/LINE_CODE/...", "doc_number");
  }

  if (!data.auth_id || data.auth_id <= 0) {
    throw validationError("Primary approver (auth_id) is required", "auth_id");
  }
}

function extractLineCode(docNumber: string): string {
  const parts = docNumber.split("/");
  if (parts.length < 2) {
    throw validationError("Invalid document number format");
  }
  return parts[1];
}

function checkLineNeedsAdditionalApprover(appliesTo: any, lineCode: string): boolean {
  if (!appliesTo) return false;

  try {
    let lineArray: string[] = [];

    if (typeof appliesTo === "string") {
      const parsed = JSON.parse(appliesTo);
      lineArray = Array.isArray(parsed) ? parsed : [];
    } else if (Array.isArray(appliesTo)) {
      lineArray = appliesTo;
    }

    return lineArray.includes(lineCode);
  } catch (error) {
    return false;
  }
}

async function getSingleAdditionalApprover(tx: Db, lineCode: string): Promise<SingleAdditionalApprover | null> {
  try {
    const insertStep = await repo.findActiveInsertStep(tx);
    if (!insertStep) return null;

    if (!checkLineNeedsAdditionalApprover(insertStep.applies_to_lines, lineCode)) return null;

    const sectionId = insertStep.section_id;
    if (!sectionId) return null;

    let approverAuth = null;
    if (insertStep.model_type === "section") {
      const sectionHead = await repo.findSectionHead(tx, sectionId);
      approverAuth = sectionHead?.authorization;
    } else if (insertStep.model_type === "department") {
      const deptHead = await repo.findDepartmentHead(tx, sectionId);
      approverAuth = deptHead?.authorization;
    }

    if (!approverAuth) return null;

    return {
      id: approverAuth.id,
      employee_code: approverAuth.employee_code,
      employee_name: approverAuth.employee_name,
      actor_name: insertStep.actor_name,
      section_id: sectionId,
      line_code: lineCode,
      insert_position: insertStep.insert_after_step || 1,
    };
  } catch (error) {
    throw new DatabaseError("Failed to get additional approver", error as Error);
  }
}

function insertSingleAdditionalApprover(
  manualApprovers: (number | null | undefined)[],
  additionalApprover: SingleAdditionalApprover | null
): number[] {
  const cleanManualApprovers = manualApprovers.filter(
    (id): id is number => id !== null && id !== undefined && id > 0
  );

  if (!additionalApprover) return cleanManualApprovers;

  if (cleanManualApprovers.includes(additionalApprover.id)) return cleanManualApprovers;

  const finalApprovers: number[] = [];
  for (let i = 0; i < cleanManualApprovers.length; i++) {
    finalApprovers.push(cleanManualApprovers[i]);
    if (i + 1 === additionalApprover.insert_position) {
      finalApprovers.push(additionalApprover.id);
    }
  }

  // If insert position is beyond array length, add at end
  if (additionalApprover.insert_position > cleanManualApprovers.length) {
    if (!finalApprovers.includes(additionalApprover.id)) {
      finalApprovers.push(additionalApprover.id);
    }
  }

  return finalApprovers;
}

async function createHandoverRecord(tx: Db, data: CreateHandoverDto, finalApproverIds: number[]): Promise<any> {
  try {
    const handoverData: any = {
      doc_number: data.doc_number,
      auth_id: finalApproverIds[0],
      auth_id2: finalApproverIds[1] || null,
      auth_id3: finalApproverIds[2] || null,
      auth_id4: finalApproverIds[3] || null,
      progress: "0%",
      status: data.status || "submitted",
      proposed_change_id: data.proposed_change_id,
      authdoc_id: data.authdoc_id || null,
      plant_id: data.plant_id,
      department_id: data.department_id,
      section_department_id: data.section_department_id,
      material: data.material,
      remark: data.remark || null,
      created_by: data.created_by,
      created_date: new Date(),
      is_deleted: false,
    };

    if (finalApproverIds[4]) {
      handoverData.auth_id5 = finalApproverIds[4];
    }

    return await repo.createHandover(tx, handoverData);
  } catch (error) {
    throw new DatabaseError("Failed to create handover record", error as Error);
  }
}

function generateStatusDescription(employeeName: string, status: string): string {
  const statusMap: { [key: string]: string } = {
    submitted: "has submitted",
    updated: "has updated",
    approved: "has approved",
    rejected: "has rejected",
    not_approved: "has not approved",
  };
  const action = statusMap[status] || `has changed status to ${status}`;
  return `${employeeName} ${action} Handover Document`;
}

function generateDefaultNote(status: string): string {
  const noteMap: { [key: string]: string } = {
    submitted: "This handover document has been submitted with hybrid approval system.",
    updated: "This handover document has been updated.",
    approved: "This handover document has been approved.",
    rejected: "This handover document has been rejected.",
    not_approved: "This handover document has not been approved.",
  };
  return noteMap[status] || `Status has been changed to "${status}".`;
}

async function createSubmitHistory(
  tx: Db,
  handoverId: number,
  authId: number,
  createdBy: string,
  status: string = "submitted",
  note?: string
): Promise<void> {
  try {
    const auth = await repo.findAuthNameForHistory(tx, authId);
    const employeeName = auth?.employee_name || "Unknown";

    await repo.createHistory(
      {
        description: generateStatusDescription(employeeName, status),
        employee_code: createdBy,
        handover_id: handoverId,
        auth_id: authId,
        note: note || generateDefaultNote(status),
        status,
        created_date: new Date(),
        created_by: createdBy,
        updated_date: new Date(),
      },
      tx
    );
  } catch (error) {
    console.error("Error creating handover history:", error);
    throw new DatabaseError("Failed to create handover history", error as Error);
  }
}

async function createHandoverApprovals(
  tx: Db,
  handoverId: number,
  finalApproverIds: number[],
  additionalApprover: SingleAdditionalApprover | null
): Promise<void> {
  try {
    const authDetails = await repo.findActiveAuthsByIds(tx, finalApproverIds);
    const authMap = new Map(authDetails.map((auth) => [auth.id, auth]));

    const approvalData = finalApproverIds.map((authId, index) => {
      const auth = authMap.get(authId);

      let status: "approved" | "on_going" | "pending" = "pending";
      if (index === 0) status = "approved"; // Submitter auto-approved
      else if (index === 1) status = "on_going"; // Next approver is on-going

      let actorName = `Manual Approver ${index + 1}`;
      if (additionalApprover && additionalApprover.id === authId) {
        actorName = additionalApprover.actor_name;
      }

      return {
        handover_id: handoverId,
        auth_id: authId,
        step: index + 1,
        actor: actorName,
        employee_code: auth?.employee_code || "",
        status,
        updated_date: new Date(),
        created_date: new Date(),
      };
    });

    await repo.createApprovals(tx, approvalData);
  } catch (error) {
    console.error("Error creating handover approvals:", error);
    throw new DatabaseError("Failed to create handover approvals", error as Error);
  }
}

export async function create(data: CreateHandoverDto) {
  // Seluruh pembuatan (validasi, header, history, approvals) dalam satu transaksi.
  const result = await repo.runCreateTransaction(async (tx) => {
    validateHandoverData(data);

    const lineCode = extractLineCode(data.doc_number);
    const additionalApprover = await getSingleAdditionalApprover(tx, lineCode);

    const manualApprovers = [data.auth_id, data.auth_id2, data.auth_id3, data.auth_id4, data.auth_id5];
    const finalApproverIds = insertSingleAdditionalApprover(manualApprovers, additionalApprover);

    if (finalApproverIds.length === 0) {
      throw new HttpError(422, {
        success: false,
        error: "Business Logic Error",
        message: "No valid approvers found after processing",
      });
    }

    const handover = await createHandoverRecord(tx, data, finalApproverIds);
    await createSubmitHistory(tx, handover.id, data.auth_id, data.created_by, data.status || "submitted");
    await createHandoverApprovals(tx, handover.id, finalApproverIds, additionalApprover);

    return {
      handover,
      totalApprovers: finalApproverIds.length,
      additionalApproverInfo: additionalApprover,
    };
  });

  // Email di luar transaksi; gagal kirim tidak menggagalkan operasi
  try {
    await sendSubmissionEmails(result.handover.id, data.auth_id);
  } catch (emailError) {
    console.error("⚠️ Email notification failed:", emailError);
  }

  const lineCode = data.doc_number.split("/")[1];

  return {
    handover: result.handover,
    approval_info: {
      line_code: lineCode,
      total_approvers: result.totalApprovers,
      has_additional_approver: !!result.additionalApproverInfo,
      additional_approver_detail: result.additionalApproverInfo
        ? {
            name: result.additionalApproverInfo.employee_name,
            role: result.additionalApproverInfo.actor_name,
            insert_position: result.additionalApproverInfo.insert_position,
          }
        : null,
    },
  };
}

// =====================================================================
// Update
// =====================================================================

async function createUpdateHistory(
  handover_id: number,
  auth_id: number,
  created_by: string,
  status: string = "updated",
  note: string = ""
): Promise<void> {
  try {
    const auth = await repo.findEmployeeName(auth_id);
    const employeeName = auth?.employee_name || "Unknown";

    let description = "";
    switch (status) {
      case "updated":
        description = `${employeeName} has updated Handover Document`;
        break;
      case "submitted":
        description = `${employeeName} was upload Handover Document`;
        break;
      default:
        description = `${employeeName} has changed Handover Document status to ${status}`;
    }

    let defaultNote = "";
    switch (status) {
      case "submitted":
        defaultNote = "This handover document has been submitted.";
        break;
      case "updated":
        defaultNote = "This handover document has been updated.";
        break;
      default:
        defaultNote = `Status has been changed to "${status}".`;
    }

    await repo.createHistory({
      description,
      employee_code: created_by,
      handover_id,
      auth_id,
      note: note || defaultNote,
      status,
      created_date: new Date(),
      created_by,
      updated_date: new Date(),
    });
  } catch (error) {
    console.error("Error in createHandoverHistory:", error);
    throw error;
  }
}

/** `editor` = user login (token); dicatat sebagai pengubah di history. auth_id di body dibuang (stripOwnerFields). */
export async function update(id: string, updateData: UpdateHandoverDto, editor: { auth_id?: number }) {
  const handoverId = parseInt(id, 10);

  if (isNaN(handoverId)) {
    console.warn("❌ Invalid ID format:", id);
    throw new HttpError(400, { error: "Validation Error", details: "ID must be a valid number" });
  }

  const existingDoc = await repo.findForUpdate(handoverId);

  if (!existingDoc) {
    console.warn(`❌ No handover document found with ID: ${handoverId}`);
    throw new HttpError(404, { error: "Not Found", details: `Handover document with ID ${handoverId} not found` });
  }

  const auth_id = editor.auth_id || existingDoc.auth_id;
  const created_by = updateData.created_by ?? existingDoc.created_by;

  if (!auth_id) {
    console.warn(`❌ Missing auth_id for document ID: ${handoverId}`);
    throw new HttpError(400, { error: "Validation Error", details: "auth_id is required for creating history" });
  }

  // Determine document status - if not in request, always use "updated"
  const documentStatus = updateData.status || "updated";

  const updatedHandover = await repo.updateHandover(handoverId, {
    material: updateData.material ?? existingDoc.material,
    remark: updateData.remark ?? existingDoc.remark,
    status: documentStatus,
    updated_at: new Date(),
    updated_by: updateData.updated_by ?? created_by,
  });

  const status = documentStatus;
  const note = updateData.note || "";

  try {
    await createUpdateHistory(handoverId, auth_id, created_by || "system", status, note);
  } catch (historyError) {
    console.error("❌ Error creating history record:", historyError);

    // If fails, try direct insert as fallback
    try {
      const auth = await repo.findEmployeeName(auth_id);
      const employeeName = auth?.employee_name || "Unknown";

      let description = "";
      switch (status) {
        case "updated":
          description = `${employeeName} has updated Handover Document`;
          break;
        default:
          description = `${employeeName} has changed Handover Document status to ${status}`;
      }

      let defaultNote = "";
      switch (status) {
        case "submitted":
          defaultNote = "This handover document has been submitted.";
          break;
        case "updated":
          defaultNote = "This handover document has been updated.";
          break;
        default:
          defaultNote = `Status has been changed to "${status}".`;
      }

      await repo.createHistory({
        description,
        employee_code: created_by || "system",
        handover_id: handoverId,
        auth_id,
        note: note || defaultNote,
        status,
        created_date: new Date(),
        updated_date: new Date(),
        created_by: created_by || "system",
      });
    } catch (forceError) {
      console.error("❌ Force insert also failed:", forceError);
    }
  }

  // Approvers who previously marked the document as "not_approved"
  let notApprovedApprovers: any[] = [];

  try {
    const handoverApprovals = await repo.findNotApprovedApprovals(handoverId);

    const approvalAuthIds = handoverApprovals.map((a) => a.auth_id).filter((id): id is number => !!id);
    const [approverRows, approverHistoryRows] = approvalAuthIds.length > 0
      ? await Promise.all([
          repo.findAuthsByIds(approvalAuthIds),
          repo.findNotApprovedHistories(handoverId, approvalAuthIds),
        ])
      : [[], []];
    const approverById = new Map(approverRows.map((a) => [a.id, a]));
    const latestHistoryByAuthId = new Map<number, (typeof approverHistoryRows)[number]>();
    for (const h of approverHistoryRows) {
      if (h.auth_id != null && !latestHistoryByAuthId.has(h.auth_id)) latestHistoryByAuthId.set(h.auth_id, h);
    }

    for (const approval of handoverApprovals) {
      if (approval.auth_id) {
        const approver = approverById.get(approval.auth_id);
        if (approver) {
          const approverHistory = latestHistoryByAuthId.get(approval.auth_id);
          notApprovedApprovers.push({
            ...approver,
            note: approverHistory?.note || "No additional notes provided.",
          });
        }
      }
    }
  } catch (error) {
    console.error("❌ Error finding not_approved approvers:", error);
    notApprovedApprovers = [];
  }

  const submitter = updatedHandover?.auth_id ? await repo.findAuthById(updatedHandover.auth_id) : null;

  try {
    await sendHandoverUpdateNotificationEmails(handoverId, updatedHandover, notApprovedApprovers, submitter);
  } catch (emailError) {
    console.error("❌ Error sending notification emails:", emailError);
  }

  const updatedDoc = await repo.findWithProposedChange(handoverId);

  const docNumberParts = updatedDoc?.doc_number?.split("/") || [];
  const line_code = docNumberParts.length >= 2 ? docNumberParts[1] : null;

  return {
    status: "success",
    data: [
      {
        ...updatedDoc,
        line_code: line_code,
        project_name: updatedDoc?.tr_proposed_changes?.project_name || null,
      },
    ],
  };
}

// =====================================================================
// List / detail / history / approval list
// =====================================================================

export async function list(query: ListHandoversQuery) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const validSortColumns = [
    "id", "doc_number", "progress", "status", "material", "remark",
    "created_date", "created_by", "plant_id", "department_id", "section_department_id",
  ];

  let orderBy: any = { id: "asc" };
  if (validSortColumns.includes(sortColumn)) {
    orderBy = { [sortColumn]: sortDirection };
  }

  const offset = (page - 1) * limit;
  const andConditions: any[] = [{ is_deleted: false }];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { doc_number: { contains: searchTerm } },
        { progress: { contains: searchTerm } },
        { status: { contains: searchTerm } },
        { material: { contains: searchTerm } },
        { remark: { contains: searchTerm } },
        { created_by: { contains: searchTerm } },
      ],
    });
  }

  if (query.status) andConditions.push({ status: query.status });
  if (query.plant_id) andConditions.push({ plant_id: Number(query.plant_id) });
  if (query.department_id) andConditions.push({ department_id: Number(query.department_id) });
  if (query.section_department_id) andConditions.push({ section_department_id: Number(query.section_department_id) });
  if (query.created_by) andConditions.push({ created_by: query.created_by });
  if (query.progress) andConditions.push({ progress: query.progress });
  if (query.auth_id) {
    andConditions.push({
      tr_proposed_changes: {
        auth_id: Number(query.auth_id),
      },
    });
  }

  const whereCondition = andConditions.length > 0 ? { AND: andConditions } : {};

  const [data, totalCount] = await repo.findPage(whereCondition, offset, limit, orderBy);

  const processedData = data.map((handover) => ({
    ...handover,
    project_name: handover.tr_proposed_changes ? handover.tr_proposed_changes.project_name : null,
  }));

  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: processedData,
    pagination: {
      totalCount,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getById(id: string) {
  const handoverId = parseInt(id, 10);

  if (isNaN(handoverId)) {
    console.warn("❌ Invalid ID format:", id);
    throw new HttpError(400, { error: "Validation Error", details: "ID must be a valid number" });
  }

  const handover = await repo.findDetailById(handoverId);

  if (!handover) {
    console.warn(`❌ No handover found with ID: ${handoverId}`);
    throw new HttpError(404, { error: "Not Found", details: `Handover with ID ${handoverId} not found` });
  }

  const line_code = handover.doc_number?.split("/")?.[1] || null;

  // Alias relasi panjang menjadi uth0..uth3
  const {
    mst_authorization_tr_handover_auth_idTomst_authorization,
    mst_authorization_tr_handover_auth_id2Tomst_authorization,
    mst_authorization_tr_handover_auth_id3Tomst_authorization,
    mst_authorization_tr_handover_auth_id4Tomst_authorization,
    ...rest
  } = handover;

  return {
    status: "success",
    data: [
      {
        ...rest,
        line_code,
        project_name: handover.tr_proposed_changes?.project_name ?? null,
        uth0: mst_authorization_tr_handover_auth_idTomst_authorization ?? null,
        uth1: mst_authorization_tr_handover_auth_id2Tomst_authorization ?? null,
        uth2: mst_authorization_tr_handover_auth_id3Tomst_authorization ?? null,
        uth3: mst_authorization_tr_handover_auth_id4Tomst_authorization ?? null,
      },
    ],
  };
}

export async function getHistory(id: string) {
  const handoverId = Number(id);

  if (isNaN(handoverId)) {
    throw new HttpError(400, { error: "Invalid handover_id" });
  }

  const histories = await repo.findHistories(handoverId);

  if (histories.length === 0) {
    throw new HttpError(404, { message: `No history found for handover_id ${handoverId}` });
  }

  return { data: histories };
}

export async function getApprovals(id: string) {
  const handoverId = Number(id);

  if (isNaN(handoverId)) {
    throw new HttpError(400, { error: "Invalid handover_id" });
  }

  const approvals = await repo.findApprovalsWithAuth(handoverId);

  if (approvals.length === 0) {
    throw new HttpError(404, { message: `No approval history found for handover_id ${handoverId}` });
  }

  return { data: approvals };
}

// =====================================================================
// Approver
// =====================================================================

export async function listForApprover(query: ListApproverHandoversQuery) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const validSortColumns = [
    "id", "doc_number", "created_date", "material",
    "status", "progress", "created_by",
    "plant_id", "department_id", "section_department_id",
  ];

  const orderBy: any = validSortColumns.includes(sortColumn)
    ? { [sortColumn]: sortDirection }
    : { id: "asc" };

  const offset = (page - 1) * limit;

  const whereCondition: any = {
    is_deleted: false,
  };

  const andConditions: any[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { doc_number: { contains: searchTerm } },
        { material: { contains: searchTerm } },
        { remark: { contains: searchTerm } },
        { status: { contains: searchTerm } },
        { progress: { contains: searchTerm } },
        { created_by: { contains: searchTerm } },
        { proposedChange: { project_name: { contains: searchTerm } } },
      ],
    });
  }

  if (query.proposed_change_id) {
    andConditions.push({ proposed_change_id: Number(query.proposed_change_id) });
  }
  if (query.doc_number) {
    andConditions.push({ doc_number: query.doc_number as string });
  }
  if (query.status) {
    andConditions.push({ status: query.status as string });
  }
  if (query.progress) {
    andConditions.push({ progress: query.progress as string });
  }
  if (query.plant_id) {
    andConditions.push({ plant_id: Number(query.plant_id) });
  }
  if (query.auth_id) {
    andConditions.push({
      OR: [
        { auth_id: Number(query.auth_id) },
        { auth_id2: Number(query.auth_id) },
        { auth_id3: Number(query.auth_id) },
        { auth_id4: Number(query.auth_id) },
      ],
    });
  }
  if (query.department_id) {
    andConditions.push({ department_id: Number(query.department_id) });
  }
  if (query.section_department_id) {
    andConditions.push({ section_department_id: Number(query.section_department_id) });
  }
  if (query.created_by) {
    andConditions.push({ created_by: query.created_by as string });
  }
  // auth_id with status on_going / not_approved / rejected
  if (query.approval_auth_id) {
    const approvalAuthId = Number(query.approval_auth_id);
    andConditions.push({
      tr_handover_approval: {
        some: {
          auth_id: approvalAuthId,
          status: {
            in: ["on_going", "not_approved", "rejected"],
          },
        },
      },
    });
  }
  if (query.id) {
    andConditions.push({ id: Number(query.id) });
  }
  if (query.approval_status) {
    andConditions.push({
      tr_handover_approval: {
        some: {
          status: query.approval_status as string,
        },
      },
    });
  }
  if (query.employee_code) {
    andConditions.push({
      tr_handover_approval: {
        some: {
          employee_code: query.employee_code as string,
        },
      },
    });
  }

  if (andConditions.length > 0) {
    whereCondition.AND = andConditions;
  }

  const [handovers, totalCount] = await repo.findApproverPage(whereCondition, offset, limit, orderBy);

  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: handovers,
    pagination: {
      totalCount,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function updateApprovalStatus(body: UpdateHandoverApprovalDto) {
  const { handover_id, auth_id, status, note, employee_code } = body;

  if (!handover_id || !auth_id || !status) {
    throw new HttpError(400, {
      error: "Bad Request",
      message: "Required parameters missing: handover_id, auth_id, and status are required",
    });
  }

  const validStatuses = ["approved", "not_approved", "rejected"];
  if (!validStatuses.includes(status)) {
    throw new HttpError(400, {
      error: "Bad Request",
      message: `Invalid status. Status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  const currentApproval = await repo.findApproval(Number(handover_id), Number(auth_id));

  if (!currentApproval) {
    throw new HttpError(404, {
      error: "Not Found",
      message: "No approval found with the provided handover_id and auth_id",
    });
  }

  // Prevent changing from 'approved' to avoid confusion in the approval flow
  if (currentApproval.status === "approved") {
    throw new HttpError(400, {
      error: "Bad Request",
      message: "Cannot change status from 'approved' to another status",
    });
  }

  const currentTimestamp = new Date();
  const oneMinuteAgo = new Date(currentTimestamp.getTime() - 60000); // 1 minute ago
  const duplicateFilter = {
    handoverId: Number(handover_id),
    authId: Number(auth_id),
    status: status,
    note: note || "",
    since: oneMinuteAgo,
  };

  // Duplicate check and all-approvals read are independent; run them together
  const [existingIdenticalHistory, allApprovals] = await Promise.all([
    repo.findIdenticalRecentHistory(duplicateFilter),
    repo.findApprovalsByHandover(Number(handover_id)),
  ]);

  if (existingIdenticalHistory) {
    return {
      message: `Handover approval has been updated successfully (duplicate submission prevented)`,
      data: await repo.findFullHandover(Number(handover_id)),
    };
  }

  const currentStep = currentApproval.step || 0;
  const nextApprovalStep = currentStep + 1;
  const totalSteps = allApprovals.length;

  // Count only 'approved' statuses as completed steps
  const completedSteps = allApprovals.filter((approval) =>
    approval.id === currentApproval.id
      ? status === "approved" // Only count current approval if new status is 'approved'
      : approval.status === "approved"
  ).length;

  const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  let transactionAttempt = 0;
  const maxTransactionAttempts = 3;
  let transactionSuccessful = false;
  let transactionError = null;

  while (transactionAttempt < maxTransactionAttempts && !transactionSuccessful) {
    try {
      // Execute entire update logic as a single serialized transaction
      await repo.runApprovalTransaction(async (tx) => {
        // Double-check for duplicates inside transaction for extra safety
        const duplicateCheck = await repo.findIdenticalRecentHistory(duplicateFilter, tx);

        if (duplicateCheck) {
          transactionSuccessful = true;
          return;
        }

        await repo.updateApprovalStatus(tx, currentApproval.id, status, currentTimestamp);

        let newHandoverStatus = "onprogress";

        // Handle moving to next step only when changing to 'approved'
        if (status === "approved") {
          const nextApproval = await repo.findApprovalByStep(tx, Number(handover_id), nextApprovalStep);

          if (nextApproval) {
            // Only update next approval to on_going if it's not already in a valid status
            if (!validStatuses.includes(nextApproval.status ?? "")) {
              await repo.updateApprovalStatus(tx, nextApproval.id, "on_going", currentTimestamp);
            }
          } else {
            newHandoverStatus = "done";
          }
        }

        if (status === "not_approved") {
          newHandoverStatus = "not_approved";
        } else if (status === "rejected") {
          newHandoverStatus = "rejected";
        } else if (status === "approved" && progressPercentage === 100 && newHandoverStatus !== "done") {
          newHandoverStatus = "approved";
        }

        const hasRejections = allApprovals.some((approval) =>
          approval.id === currentApproval.id ? status === "rejected" : approval.status === "rejected"
        );
        const hasNotApproved = allApprovals.some((approval) =>
          approval.id === currentApproval.id ? status === "not_approved" : approval.status === "not_approved"
        );

        if (hasRejections) {
          newHandoverStatus = "rejected";
        } else if (hasNotApproved) {
          newHandoverStatus = "not_approved";
        }

        await repo.updateHandoverStatus(tx, Number(handover_id), {
          status: newHandoverStatus,
          progress: `${progressPercentage}%`,
          updated_at: currentTimestamp,
        });

        const previousNotApproved = await repo.findPreviousNotApproved(tx, Number(handover_id), Number(auth_id));

        let description = "";
        const authorization = await repo.findAuthWithEmployee(tx, Number(auth_id));
        const authName = authorization?.employee_name;

        if (status === "approved") {
          description = `${authName} has approved the Handover Document`;
        } else if (status === "not_approved") {
          if (previousNotApproved) {
            description = `${authName} not approved again the Handover Document`;
          } else {
            description = `${authName} has not approved the Handover Document`;
          }
        } else if (status === "rejected") {
          description = `${authName} has rejected the Handover Document`;
        }

        // use exact same timestamp for both dates
        await repo.createHistory(
          {
            handover_id: Number(handover_id),
            auth_id: Number(auth_id),
            employee_code: employee_code || authorization?.employee_code || "",
            status,
            note: note || "",
            description,
            created_date: currentTimestamp,
            updated_date: currentTimestamp,
          },
          tx
        );

        transactionSuccessful = true;
      });

      break;
    } catch (error: any) {
      console.error(`❌ Transaction error attempt #${transactionAttempt + 1}:`, error);
      transactionError = error;

      if (error.code === "P2034") {
        // Prisma transaction failed due to concurrent modification
        if (transactionAttempt < maxTransactionAttempts - 1) {
          const delay = Math.pow(2, transactionAttempt) * 500; // 500ms, 1000ms, 2000ms
          await new Promise((resolve) => setTimeout(resolve, delay));
          transactionAttempt++;
        } else {
          console.error("❌ Max retry attempts reached, throwing error");
          throw error;
        }
      } else {
        console.error("❌ Non-retriable error occurred:", error);
        throw error;
      }
    }
  }

  if (!transactionSuccessful && transactionError) {
    throw transactionError;
  }

  const updatedHandover = await repo.findFullHandover(Number(handover_id));

  try {
    await sendHandoverApprovalEmails(
      Number(handover_id),
      Number(auth_id),
      status,
      currentStep,
      note || "" // note langsung dari request body
    );
  } catch (emailError) {
    console.error("❌ Error sending email notification:", emailError);
    console.error("❌ Email error details:", emailError instanceof Error ? emailError.message : String(emailError));
  }

  return {
    message: `Handover approval has been updated to '${status}' successfully`,
    data: updatedHandover,
  };
}
