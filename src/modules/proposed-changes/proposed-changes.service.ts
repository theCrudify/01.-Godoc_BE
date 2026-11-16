import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./proposed-changes.repository";
import { sendSubmissionEmails } from "./create.mail";
import { sendUpdateNotificationEmails } from "./update.mail";

const validSortColumns = [
  "id", "project_name", "document_number_id", "item_changes",
  "line_code", "section_code", "department_id",
  "section_department_id", "plant_id", "change_type",
  "status", "created_date", "planning_start", "planning_end",
  "progress", "need_engineering_approval", "need_production_approval",
];

/** page/limit/search/sort/direction yang sama di semua list proposed changes. */
export function parseListQuery(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";
  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };
  return { page, limit, searchTerm, orderBy, offset: (page - 1) * limit };
}

export const searchCondition = (searchTerm: string) => ({
  OR: [
    { project_name: { contains: searchTerm } },
    { item_changes: { contains: searchTerm } },
    { line_code: { contains: searchTerm } },
    { section_code: { contains: searchTerm } },
    { change_type: { contains: searchTerm } },
    { description: { contains: searchTerm } },
    { status: { contains: searchTerm } },
  ],
});

export const pagination = (totalCount: number, page: number, limit: number) => {
  const totalPages = Math.ceil(totalCount / limit);
  return { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
};

function groupBy<T>(items: T[], key: (item: T) => number | null | undefined): Record<number, T[]> {
  const grouped: Record<number, T[]> = {};
  items.forEach((item) => {
    const k = key(item);
    if (k) {
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(item);
    }
  });
  return grouped;
}

// ==================== List ====================

/** GET /completion */
export async function listWithRelations(query: any) {
  const { page, limit, searchTerm, orderBy, offset } = parseListQuery(query);

  const whereCondition: any = { is_deleted: false };
  const andConditions = [];
  if (searchTerm) andConditions.push(searchCondition(searchTerm));
  if (query.auth_id) andConditions.push({ auth_id: Number(query.auth_id) });
  if (query.status) andConditions.push({ status: query.status as string });
  if (query.department_id) andConditions.push({ department_id: Number(query.department_id) });
  if (andConditions.length > 0) whereCondition.AND = andConditions;

  const [proposedChanges, totalCount] = await repo.findCompletionPage(whereCondition, offset, limit, orderBy);

  const proposedChangeIds = proposedChanges.map((pc) => pc.id);
  const [authDocs, handovers] = await Promise.all([
    repo.findAuthDocsSummaryByProposedIds(proposedChangeIds),
    repo.findHandoversSummaryByProposedIds(proposedChangeIds),
  ]);

  const authDocsByProposedChangeId = groupBy(authDocs, (d) => d.proposed_change_id);
  const handoversByProposedChangeId = groupBy(handovers, (h) => h.proposed_change_id);

  const data = proposedChanges.map((item) => {
    const relatedAuthDocs = authDocsByProposedChangeId[item.id] || [];
    const relatedHandovers = handoversByProposedChangeId[item.id] || [];

    // hanya data handover minimal yang dibutuhkan UI
    const handoverData = relatedHandovers.length > 0 ? {
      is_finished: relatedHandovers[0].is_finished || false,
      star: relatedHandovers[0].star || 0,
    } : null;

    return {
      id: item.id,
      project_name: item.project_name,
      documentNumber: item.documentNumber,
      department_id: item.department_id,
      status: item.status,
      progress: item.progress,
      progresssupport: item.progresssupport,
      created_date: item.created_date,
      authorization_doc_ids: relatedAuthDocs.map((doc) => doc.id),
      authorization_doc_progress: relatedAuthDocs.map((doc) => ({ id: doc.id, progress: doc.progress || "0%" })),
      handover_ids: relatedHandovers.map((handover) => handover.id),
      handover_progress: relatedHandovers.map((handover) => ({ id: handover.id, progress: handover.progress || "0%" })),
      all_handover_data: handoverData,
    };
  });

  return { data, pagination: pagination(totalCount, page, limit) };
}

/** GET /completion/:id */
export async function getByIdWithRelations(rawId: string) {
  const proposedChangeId = Number(rawId);
  if (isNaN(proposedChangeId)) throw new HttpError(400, { error: "Invalid ID format" });

  const proposedChange = await repo.findUniqueActiveWithRelations(proposedChangeId);
  if (!proposedChange) throw new HttpError(404, { error: "Proposed change not found" });

  const [authDocs, handovers] = await Promise.all([
    repo.findAuthDocsSummaryByProposedId(proposedChangeId),
    repo.findHandoversByProposedId(proposedChangeId),
  ]);

  return {
    data: {
      ...proposedChange,
      document_number: (proposedChange.documentNumber as any)?.running_number || "not yet",
      has_authorization_doc: authDocs.length > 0 ? authDocs.map((doc) => doc.doc_number).join(", ") : "not yet",
      authorization_doc_ids: authDocs.length > 0 ? authDocs.map((doc) => doc.id) : [],
      authorization_doc_progress: authDocs.length > 0
        ? authDocs.map((doc) => ({ id: doc.id, doc_number: doc.doc_number, progress: doc.progress || "not available" }))
        : [],
      has_handover: handovers.length > 0 ? handovers.map((handover) => handover.doc_number).join(", ") : "not yet",
      handover_ids: handovers.length > 0 ? handovers.map((handover) => handover.id) : [],
      handover_progress: handovers.length > 0
        ? handovers.map((handover) => ({ id: handover.id, doc_number: handover.doc_number, progress: handover.progress || "not available" }))
        : [],
    },
  };
}

/** GET /proposedchanges — hanya PC yang belum punya authorization doc. */
export async function list(query: any) {
  const { page, limit, searchTerm, orderBy, offset } = parseListQuery(query);

  // relation filter = NOT IN subquery, dikerjakan di SQL
  const whereCondition: any = {
    is_deleted: false,
    authorizationDocs: { none: {} },
  };
  const andConditions = [];
  if (searchTerm) andConditions.push(searchCondition(searchTerm));
  if (query.auth_id) andConditions.push({ auth_id: Number(query.auth_id) });
  if (query.status) andConditions.push({ status: query.status as string });
  if (query.change_type) andConditions.push({ change_type: query.change_type as string });
  if (query.plant_id) andConditions.push({ plant_id: Number(query.plant_id) });
  if (query.department_id) andConditions.push({ department_id: Number(query.department_id) });
  if (query.section_department_id) andConditions.push({ section_department_id: Number(query.section_department_id) });
  if (query.line_code) andConditions.push({ line_code: query.line_code as string });
  if (query.need_engineering_approval !== undefined) {
    andConditions.push({ need_engineering_approval: query.need_engineering_approval === "true" });
  }
  if (query.need_production_approval !== undefined) {
    andConditions.push({ need_production_approval: query.need_production_approval === "true" });
  }
  if (query.progress) andConditions.push({ progress: query.progress as string });
  if (query.created_by) andConditions.push({ created_by: query.created_by as string });
  if (andConditions.length > 0) whereCondition.AND = andConditions;

  const [data, totalCount] = await repo.findPageWithDocumentNumber(whereCondition, offset, limit, orderBy);
  return { data, pagination: pagination(totalCount, page, limit) };
}

/** GET /completionapprover/:approver_id */
export async function listWithRelationsByApprover(query: any, rawApproverId?: string) {
  const { page, limit, searchTerm, orderBy, offset } = parseListQuery(query);
  const approver_id = rawApproverId ? Number(rawApproverId) : undefined;

  const emptyResult = {
    data: [],
    pagination: { totalCount: 0, totalPages: 0, currentPage: page, limit, hasNextPage: false, hasPreviousPage: false },
  };

  const whereCondition: any = { is_deleted: false };
  const andConditions = [];
  if (searchTerm) andConditions.push(searchCondition(searchTerm));

  if (approver_id) {
    // 1. handover yang melibatkan approver ini
    const approverHandovers = await repo.findHandoverIdsByApprover(approver_id);
    const handoverIdsForApprover = approverHandovers
      .filter((item) => item.handover_id !== null)
      .map((item) => item.handover_id as number);
    if (handoverIdsForApprover.length === 0) return emptyResult;

    // 2. proposed change dari handover yang sudah selesai
    const handoversWithPCIds = await repo.findFinishedHandoverProposedIds(handoverIdsForApprover);
    const proposedChangeIds = handoversWithPCIds
      .filter((item) => item.proposed_change_id !== null)
      .map((item) => item.proposed_change_id as number);
    if (proposedChangeIds.length === 0) return emptyResult;

    andConditions.push({ id: { in: proposedChangeIds } });
  }

  if (andConditions.length > 0) whereCondition.AND = andConditions;

  const [proposedChanges, totalCount] = await repo.findApproverCompletionPage(whereCondition, offset, limit, orderBy);

  const proposedChangeIds = proposedChanges.map((pc) => pc.id);
  const [authDocs, handovers] = await Promise.all([
    repo.findAuthDocsSummaryByProposedIds(proposedChangeIds),
    repo.findHandoversSummaryByProposedIds(proposedChangeIds),
  ]);
  const handoverApprovals = await repo.findHandoverApprovalsByHandoverIds(handovers.map((h) => h.id));

  const authDocsByProposedChangeId = groupBy(authDocs, (d) => d.proposed_change_id);
  const handoversByProposedChangeId = groupBy(handovers, (h) => h.proposed_change_id);
  const handoverApprovalsByHandoverId = groupBy(handoverApprovals, (a) => a.handover_id);

  const data = proposedChanges.map((item) => {
    const relatedAuthDocs = authDocsByProposedChangeId[item.id] || [];
    const relatedHandovers = handoversByProposedChangeId[item.id] || [];

    const handoversWithApprovals = relatedHandovers.map((handover) => {
      const approvals = handoverApprovalsByHandoverId[handover.id] || [];
      return {
        id: handover.id,
        doc_number: handover.doc_number,
        progress: handover.progress || "0%",
        status: handover.status,
        is_finished: handover.is_finished || false,
        star: handover.star || 0,
        approvals: approvals.map((approval) => ({
          id: approval.id,
          auth_id: approval.auth_id,
          step: approval.step,
          actor: approval.actor,
          employee_code: approval.employee_code,
          status: approval.status,
          rating: approval.rating,
          review: approval.review,
          finished_date: approval.finished_date,
          created_date: approval.created_date,
          updated_date: approval.updated_date,
        })),
      };
    });

    const handoverData = relatedHandovers.length > 0 ? {
      is_finished: relatedHandovers[0].is_finished || false,
      star: relatedHandovers[0].star || 0,
    } : null;

    return {
      id: item.id,
      project_name: item.project_name,
      documentNumber: item.documentNumber,
      status: item.status,
      progress: item.progress,
      progresssupport: item.progresssupport,
      created_date: item.created_date,
      authorization_doc_ids: relatedAuthDocs.map((doc) => doc.id),
      authorization_doc_progress: relatedAuthDocs.map((doc) => ({ id: doc.id, progress: doc.progress || "0%" })),
      handover_ids: relatedHandovers.map((handover) => handover.id),
      handover_progress: relatedHandovers.map((handover) => ({ id: handover.id, progress: handover.progress || "0%" })),
      all_handover_data: handoverData,
      handovers_with_approvals: handoversWithApprovals,
    };
  });

  return { data, pagination: pagination(totalCount, page, limit) };
}

/** GET /proposedchanges/:id */
export async function getById(id: string) {
  const numericId = Number(id);
  if (!id || isNaN(numericId)) throw new HttpError(400, { error: "Invalid ID provided" });

  const proposedChange = await repo.findFirstActiveWithRelations(numericId);
  if (!proposedChange) throw new HttpError(404, { error: "Proposed Change not found or has been deleted" });

  return {
    data: [proposedChange],
    pagination: { totalCount: 1, totalPages: 1, currentPage: 1, limit: 1, hasNextPage: false, hasPreviousPage: false },
  };
}

/** DELETE /proposedchanges/:id */
export async function softDelete(id: string, updatedBy: any) {
  const existing = await repo.findById(Number(id));
  if (!existing) throw new HttpError(404, { error: "Proposed change not found" });

  const deleted = await repo.update(Number(id), {
    is_deleted: true,
    updated_at: new Date(),
    ...(updatedBy && { created_by: updatedBy }), // mencatat siapa yang menghapus
  });

  return { message: `Proposed change with ID ${id} has been soft-deleted.`, data: deleted };
}

// ==================== History & approval list ====================

export async function getHistoryByProposedId(rawId: string) {
  const proposedChangesId = Number(rawId);
  if (isNaN(proposedChangesId)) throw new HttpError(400, { error: "Invalid proposed_changes_id" });

  const histories = await repo.findHistoriesByProposedId(proposedChangesId);
  if (histories.length === 0) {
    throw new HttpError(404, { message: `No history found for proposed_changes_id ${proposedChangesId}` });
  }
  return { data: histories };
}

export async function getHistoryById(rawId: string) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });

  const development = await repo.findHistoryById(id);
  if (!development) throw new HttpError(404, { error: "Development not found" });
  return { data: development };
}

export const listHistories = () => repo.findAllHistories();

export async function getApprovalsByProposedId(rawId: string) {
  const proposedChangesId = Number(rawId);
  if (isNaN(proposedChangesId)) throw new HttpError(400, { error: "Invalid proposed_changes_id" });

  const approvals = await repo.findApprovalsByProposedId(proposedChangesId);
  if (approvals.length === 0) {
    throw new HttpError(404, { message: `No approval history found for proposed_changes_id ${proposedChangesId}` });
  }
  return { data: approvals };
}

// ==================== Create ====================

type HeadData = {
  id: number;
  id_authorization: number | null;
  employee_code: string | null;
  employee_name: string | null;
  authorization_status: boolean | null;
  section_id: number | null;
  department_id: number | null;
  department_name: string | null;
  section_name: string | null;
  directorship: string;
  created_by: string | null;
  is_deleted: boolean;
};

type ApprovalTemplate = {
  id: number;
  template_name: string;
  line_code: string | null;
  need_engineering_approval: boolean | null;
  need_production_approval: boolean | null;
  step_order: number;
  actor_name: string;
  model_type: "section" | "department";
  section_id: number | null;
  use_dynamic_section: boolean;
  use_line_section: boolean;
  is_active: boolean;
  priority: number;
  description: string | null;
};

/** Head (section head / department head) untuk satu section. */
async function fetchHeadData(modelType: "section" | "department", sectionId: number, directorship: string): Promise<HeadData[]> {
  if (!sectionId) return [];

  try {
    const results = modelType === "section"
      ? await repo.findSectionHeads(sectionId)
      : await repo.findDepartmentHeads(sectionId);

    return results.map((item) => ({
      id: item.id,
      id_authorization: item.authorization?.id ?? null,
      employee_code: item.authorization?.employee_code ?? null,
      employee_name: item.authorization?.employee_name ?? null,
      authorization_status: item.authorization?.status ?? null,
      section_id: item.section?.id ?? null,
      department_id: item.section?.department_id ?? null,
      department_name: item.section?.department?.department_name ?? null,
      section_name: item.section?.section_name ?? null,
      directorship,
      created_by: item.created_by ?? null,
      is_deleted: item.is_deleted ?? false,
    }));
  } catch (error) {
    console.error(`Error fetching ${directorship}:`, error);
    return [];
  }
}

/** Template approval yang cocok; satu template per step_order (priority tertinggi). */
async function getApprovalTemplates(line_code: string, need_engineering_approval: boolean, need_production_approval: boolean): Promise<ApprovalTemplate[]> {
  try {
    const templates = await repo.findApprovalTemplates(line_code, need_engineering_approval, need_production_approval);

    const uniqueTemplates: ApprovalTemplate[] = [];
    const seenSteps = new Set<number>();
    templates.forEach((template) => {
      if (!seenSteps.has(template.step_order)) {
        seenSteps.add(template.step_order);
        uniqueTemplates.push({
          id: template.id,
          template_name: template.template_name,
          line_code: template.line_code,
          need_engineering_approval: template.need_engineering_approval,
          need_production_approval: template.need_production_approval,
          step_order: template.step_order,
          actor_name: template.actor_name,
          model_type: template.model_type,
          section_id: template.section_id,
          use_dynamic_section: template.use_dynamic_section ?? false,
          use_line_section: template.use_line_section ?? false,
          is_active: template.is_active ?? true,
          priority: template.priority ?? 0,
          description: template.description,
        });
      }
    });
    return uniqueTemplates;
  } catch (error) {
    console.error("Error getting approval templates:", error);
    return [];
  }
}

async function resolveSectionId(template: ApprovalTemplate, section_department_id: number, line_code: string): Promise<number | null> {
  try {
    if (template.use_dynamic_section) return section_department_id;

    if (template.use_line_section) {
      const lineData = await repo.findLineSectionByCode(line_code);
      if (lineData && lineData.id_section_manufacture) return lineData.id_section_manufacture;
      console.warn(`⚠️ Line section not found for line_code: ${line_code}`);
      return null;
    }

    if (template.section_id) return template.section_id;

    console.warn(`⚠️ Could not resolve section_id for template: ${template.template_name}`);
    return null;
  } catch (error) {
    console.error(`Error resolving section_id for template ${template.template_name}:`, error);
    return null;
  }
}

async function getAllHeadsData(
  section_department_id: number,
  line_code: string,
  need_engineering_approval: boolean,
  need_production_approval: boolean,
): Promise<HeadData[]> {
  try {
    const templates = await getApprovalTemplates(line_code, need_engineering_approval, need_production_approval);
    if (templates.length === 0) {
      console.warn("⚠️ No approval templates found for given criteria");
      return [];
    }

    // concurrently; hasil tetap urut sesuai template
    const perTemplate = await Promise.all(templates.map(async (template) => {
      const resolvedSectionId = await resolveSectionId(template, section_department_id, line_code);
      if (!resolvedSectionId) {
        console.warn(`⚠️ Skipping template ${template.template_name} - could not resolve section_id`);
        return [];
      }

      const actorName = template.use_line_section ? `${template.actor_name} (${line_code})` : template.actor_name;
      const headData = await fetchHeadData(template.model_type, resolvedSectionId, actorName);
      if (headData.length === 0) {
        console.warn(`⚠️ No heads found for ${actorName} in section ${resolvedSectionId}`);
      }
      return headData;
    }));

    const allResults: HeadData[] = [];
    for (const headData of perTemplate) allResults.push(...headData);

    // hapus duplikat berdasarkan employee_code
    const uniqueHeads: HeadData[] = [];
    const seenCodes = new Set<string>();
    allResults.forEach((head) => {
      if (head.employee_code && !seenCodes.has(head.employee_code)) {
        seenCodes.add(head.employee_code);
        uniqueHeads.push(head);
      }
    });
    return uniqueHeads;
  } catch (error) {
    console.error("Error in getAllHeadsData:", error);
    if (error instanceof Error) {
      console.error(`Nama error: ${error.name}, Pesan: ${error.message}`);
      if (error.stack) console.error(`Stack: ${error.stack}`);
    }
    return [];
  }
}

const historyDescription: Record<string, string> = {
  updated: "has updated Proposed Changes",
  submitted: "was upload Proposed Changes",
  not_approved: "has not approved the Proposed Changes",
  rejected: "has rejected the Proposed Changes",
  approved: "has approved the Proposed Changes",
};

const historyDefaultNote: Record<string, string> = {
  submitted: "This proposed change has been submitted.",
  updated: "This proposed change has been updated.",
  not_approved: "This proposed change has not been approved.",
  rejected: "This proposed change has been rejected.",
  approved: "This proposed change has been approved.",
};

export async function createProposedChangeHistory(
  proposed_changes_id: number,
  auth_id: number,
  created_by: string,
  status: string = "submitted",
  note: string = "",
): Promise<void> {
  try {
    const auth = await repo.findEmployeeName(auth_id);
    const employeeName = auth?.employee_name || "Unknown";

    const description = Object.prototype.hasOwnProperty.call(historyDescription, status)
      ? `${employeeName} ${historyDescription[status]}`
      : `${employeeName} has changed Proposed Changes status to ${status}`;
    const defaultNote = Object.prototype.hasOwnProperty.call(historyDefaultNote, status)
      ? historyDefaultNote[status]
      : `Status has been changed to "${status}".`;

    await repo.createHistory({
      description,
      employee_code: created_by,
      proposed_changes_id,
      auth_id,
      note: note || defaultNote,
      status,
      created_date: new Date(),
      created_by,
    });
  } catch (error) {
    console.error("Error creating history:", error);
    throw error;
  }
}

/** Approver pertama on_going, sisanya pending. */
function prepareApprovalData(proposed_changes_id: number, heads: HeadData[]) {
  return heads
    .filter((head) => head.id_authorization !== null)
    .map((head, index) => ({
      proposed_changes_id,
      auth_id: head.id_authorization,
      step: index + 1,
      actor: head.directorship,
      employee_code: head.employee_code || "",
      status: index === 0 ? "on_going" : "pending",
      created_date: new Date(),
    }));
}

async function createProposedChangeApprovals(
  proposed_changes_id: number,
  section_department_id: number,
  line_code: string,
  need_engineering_approval: boolean,
  need_production_approval: boolean,
): Promise<void> {
  try {
    const heads = await getAllHeadsData(section_department_id, line_code, need_engineering_approval, need_production_approval);
    const approvalData = prepareApprovalData(proposed_changes_id, heads);
    if (approvalData.length > 0) {
      await repo.createApprovals(approvalData);
    } else {
      console.log("⚠️ No approval records created - no valid approvers found");
    }
  } catch (error) {
    console.error("Error creating approvals:", error);
    throw error;
  }
}

const requiredCreateFields = [
  "project_name", "line_code", "section_code",
  "department_id", "section_department_id", "plant_id",
  "change_type", "description", "reason", "created_by", "auth_id",
];

/** POST /proposedchanges */
export async function create(data: any) {
  // format pesan khusus ("Missing fields: a, b"), jadi tetap di service
  const missingFields = requiredCreateFields.filter((field) => !data[field]);
  if (missingFields.length > 0) {
    throw new HttpError(400, { error: "Validation Error", details: `Missing fields: ${missingFields.join(", ")}` });
  }

  const need_engineering_approval = data.need_engineering_approval === true;
  const need_production_approval = data.need_production_approval === true;

  const newChange = await repo.create({
    project_name: data.project_name,
    document_number_id: data.document_number_id,
    item_changes: data.item_changes,
    line_code: data.line_code,
    section_code: data.section_code,
    section_name: data.section_name,
    department_id: data.department_id,
    section_department_id: data.section_department_id,
    plant_id: data.plant_id,
    auth_id: data.auth_id,
    change_type: data.change_type,
    description: data.description,
    reason: data.reason,
    cost: data.cost,
    cost_text: data.cost_text,
    planning_start: data.planning_start ? new Date(data.planning_start) : undefined,
    planning_end: data.planning_end ? new Date(data.planning_end) : undefined,
    created_by: data.created_by,
    created_date: new Date(),
    need_engineering_approval,
    need_production_approval,
    other_sytem: data.other_sytem,
    status: data.status || "submitted",
    progress: data.progress,
  });

  await Promise.all([
    createProposedChangeHistory(newChange.id, data.auth_id, data.created_by, data.status || "submitted"),
    createProposedChangeApprovals(newChange.id, data.section_department_id, data.line_code, need_engineering_approval, need_production_approval),
  ]);

  try {
    await sendSubmissionEmails(newChange.id, data.auth_id);
  } catch (emailError) {
    console.error("Error sending email notifications:", emailError);
  }

  return newChange;
}

// ==================== Update ====================

/** PUT /proposedchanges/:id */
/** `editor` = user login (dari token): dicatat di history; auth_id/created_by di body sudah dibuang supaya kepemilikan tidak pindah. */
export async function update(id: string, data: any, editor: { auth_id: number; nik: string }) {
  if (!id || isNaN(Number(id))) {
    throw new HttpError(400, { error: "Validation Error", details: "Invalid ID parameter" });
  }

  const existingRecord = await repo.findById(Number(id));
  if (!existingRecord) {
    throw new HttpError(404, { error: "Not Found", details: `Proposed change with ID ${id} not found` });
  }

  const submitter = existingRecord?.auth_id ? await repo.findAuthorizationById(existingRecord.auth_id) : null;

  const updateData: any = {};

  // String fields
  for (const f of [
    "project_name", "item_changes", "line_code", "section_code", "change_type", "description",
    "reason", "cost", "cost_text", "other_sytem", "progress", "created_by",
  ]) {
    if (data[f] !== undefined) updateData[f] = String(data[f]);
  }

  // Numeric fields
  for (const f of ["document_number_id", "department_id", "section_department_id", "plant_id", "auth_id"]) {
    if (data[f] !== undefined) updateData[f] = data[f] !== null ? Number(data[f]) : null;
  }

  // Date fields
  for (const f of ["planning_start", "planning_end", "created_date"]) {
    if (data[f] !== undefined) updateData[f] = data[f] ? new Date(data[f]) : null;
  }

  // Boolean fields (TinyInt)
  for (const f of ["need_engineering_approval", "need_production_approval", "is_deleted"]) {
    if (data[f] !== undefined) updateData[f] = data[f] === true;
  }

  updateData.status = data.status || "updated";
  updateData.updated_at = new Date();

  const updatedChange = await repo.update(Number(id), updateData);

  await createProposedChangeHistory(Number(id), editor.auth_id, editor.nik, updateData.status);

  // approver yang sebelumnya memberi status not_approved
  let notApprovedApprovers = [];
  try {
    const approvalHistories = await repo.findNotApprovedApprovals(Number(id));

    // batch-load authorization, lalu ikuti urutan history
    const authIds = approvalHistories.map((h) => h.auth_id).filter((a): a is number => !!a);
    const approverById = new Map(
      (authIds.length > 0 ? await repo.findAuthorizationsByIds(authIds) : []).map((a) => [a.id, a]),
    );
    for (const history of approvalHistories) {
      if (history.auth_id) {
        const approver = approverById.get(history.auth_id);
        if (approver) notApprovedApprovers.push({ ...approver });
      }
    }
  } catch (error) {
    console.error("Error finding not_approved approvers:", error);
    notApprovedApprovers = [];
  }

  try {
    await sendUpdateNotificationEmails(Number(id), existingRecord, notApprovedApprovers, submitter);
  } catch (emailError) {
    console.error("Error sending notification emails:", emailError);
  }

  return updatedChange;
}
