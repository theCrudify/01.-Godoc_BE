import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./authorization-doc.repository";
import { sendSubmissionEmails, sendAuthDocUpdateNotificationEmails } from "./authorization-doc.mail";
import { ListAuthDocQuery } from "./authorization-doc.dto";

// ==========================================
// TEMPLATE APPROVAL & APPROVER (dipakai saat create)
// ==========================================

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
  position?: number;
};

interface AuthApprovalTemplate {
  id: number;
  template_name: string;
  line_code: string | null;
  step_order: number;
  actor_name: string;
  model_type: "section" | "department";
  section_id: number | null;
  use_dynamic_section: boolean;
  use_line_section: boolean;
  is_insert_step: boolean;
  insert_after_step: number | null;
  applies_to_lines: any;
  is_active: boolean;
  priority: number;
  description: string | null;
}

interface FetchConfiguration {
  modelType: "section" | "department";
  sectionId: number;
  directorship: string;
  position: number;
}

/** Apakah line code termasuk applies_to_lines (string JSON / array) sebuah insert step. */
function checkLineApplies(appliesTo: any, lineCode: string): boolean {
  if (!appliesTo) return false;
  try {
    let lineArray: string[] = [];
    if (typeof appliesTo === "string") {
      const parsed = JSON.parse(appliesTo);
      if (Array.isArray(parsed)) lineArray = parsed;
    } else if (Array.isArray(appliesTo)) {
      lineArray = appliesTo;
    } else if (typeof appliesTo === "object" && appliesTo !== null) {
      lineArray = appliesTo;
    }
    return lineArray.includes(lineCode);
  } catch (error) {
    console.error("Error parsing applies_to_lines:", error);
    return false;
  }
}

function transformAuthTemplate(template: any): AuthApprovalTemplate {
  return {
    id: template.id,
    template_name: template.template_name,
    line_code: template.line_code,
    step_order: template.step_order,
    actor_name: template.actor_name,
    model_type: template.model_type,
    section_id: template.section_id,
    use_dynamic_section: template.use_dynamic_section ?? false,
    use_line_section: template.use_line_section ?? false,
    is_insert_step: template.is_insert_step ?? false,
    insert_after_step: template.insert_after_step,
    applies_to_lines: template.applies_to_lines,
    is_active: template.is_active ?? true,
    priority: template.priority ?? 0,
    description: template.description,
  };
}

/** Alur default + insert step yang berlaku untuk line_code, dengan step_order berurutan. */
async function getAuthApprovalTemplates(line_code: string): Promise<AuthApprovalTemplate[]> {
  try {
    const [defaultTemplates, insertSteps] = await Promise.all([repo.findDefaultTemplates(), repo.findInsertStepTemplates()]);

    const applicableInsertSteps = insertSteps.filter((step) => checkLineApplies(step.applies_to_lines, line_code));

    if (applicableInsertSteps.length === 0) {
      return defaultTemplates.map((template, index) => {
        const transformed = transformAuthTemplate(template);
        transformed.step_order = index + 1;
        return transformed;
      });
    }

    const finalTemplates: AuthApprovalTemplate[] = [];
    let currentStep = 1;

    const insertStepMap = new Map<number, any[]>();
    applicableInsertSteps.forEach((step) => {
      const afterStep = step.insert_after_step || 0;
      if (!insertStepMap.has(afterStep)) insertStepMap.set(afterStep, []);
      insertStepMap.get(afterStep)!.push(step);
    });

    defaultTemplates.forEach((defaultTemplate) => {
      const transformed = transformAuthTemplate(defaultTemplate);
      transformed.step_order = currentStep++;
      finalTemplates.push(transformed);

      const insertsAfterThisStep = insertStepMap.get(defaultTemplate.step_order) || [];
      insertsAfterThisStep.forEach((insertStep) => {
        const insertTransformed = transformAuthTemplate(insertStep);
        insertTransformed.step_order = currentStep++;
        finalTemplates.push(insertTransformed);
      });
    });

    return finalTemplates;
  } catch (error) {
    console.error("Error getting auth approval templates:", error);
    return [];
  }
}

function buildFetchConfigurations(templates: AuthApprovalTemplate[], sectionDepartmentId: number, lineCode: string): FetchConfiguration[] {
  const configs: FetchConfiguration[] = [];

  templates.forEach((template) => {
    let sectionId = template.section_id;
    if (template.use_dynamic_section) sectionId = sectionDepartmentId;
    if (template.use_line_section) {
      // Resolusi section dari line belum diimplementasikan
      console.log(`⚠️ Line section resolution not implemented for ${lineCode}`);
    }

    if (sectionId) {
      configs.push({ modelType: template.model_type, sectionId, directorship: template.actor_name, position: template.step_order });
    } else {
      console.warn(`⚠️ Could not resolve section_id for template: ${template.actor_name}`);
    }
  });

  return configs.sort((a, b) => a.position - b.position);
}

async function fetchHeadData(modelType: "section" | "department", sectionId: number, directorship: string): Promise<HeadData[]> {
  if (!sectionId) return [];
  try {
    const results = modelType === "section" ? await repo.findSectionHeads(sectionId) : await repo.findDepartmentHeads(sectionId);

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

/** Head unik (per employee_code) sesuai template, diurutkan menurut posisi step. */
async function getAllHeadsDataWithTemplate(section_department_id: number, line_code: string): Promise<HeadData[]> {
  try {
    const normalizedLineCode = line_code?.trim() || "";

    const templates = await getAuthApprovalTemplates(normalizedLineCode);
    if (templates.length === 0) {
      console.warn("⚠️ No approval templates found for authorization document");
      return [];
    }

    const fetchConfigs = buildFetchConfigurations(templates, section_department_id, normalizedLineCode);
    if (fetchConfigs.length === 0) {
      console.warn("⚠️ No valid fetch configurations built from templates");
      return [];
    }

    // paralel; urutan hasil tetap mengikuti config (fetchHeadData menangkap error-nya sendiri)
    const allResults: HeadData[] = [];
    const headDataPerConfig = await Promise.all(
      fetchConfigs.map((config) => fetchHeadData(config.modelType, config.sectionId, config.directorship)),
    );

    fetchConfigs.forEach((config, i) => {
      const headData = headDataPerConfig[i];
      if (headData.length > 0) {
        headData.forEach((head) => {
          head.position = config.position;
        });
        allResults.push(...headData);
      } else {
        console.warn(`⚠️ No heads found for ${config.directorship} in section ${config.sectionId}`);
      }
    });

    const uniqueHeads: HeadData[] = [];
    const seenCodes = new Set<string>();
    allResults.sort((a, b) => (a.position || 0) - (b.position || 0));
    allResults.forEach((head) => {
      if (head.employee_code && !seenCodes.has(head.employee_code)) {
        seenCodes.add(head.employee_code);
        uniqueHeads.push(head);
      }
    });

    return uniqueHeads;
  } catch (error) {
    console.error("Error in getAllHeadsDataWithTemplate:", error);
    return [];
  }
}

function prepareApprovalData(authdoc_id: number, heads: HeadData[]) {
  const validHeads = heads.filter((head) => head.id_authorization !== null);
  return validHeads.map((head, index) => ({
    authdoc_id,
    auth_id: head.id_authorization,
    step: index + 1,
    actor: head.directorship,
    employee_code: head.employee_code || "",
    status: index === 0 ? "on_going" : "pending",
    created_date: new Date(),
  }));
}

async function createdAuthApprovals(authdoc_id: number, section_department_id: number, line_code: string): Promise<void> {
  try {
    const heads = await getAllHeadsDataWithTemplate(section_department_id, line_code);
    const approvalData = prepareApprovalData(authdoc_id, heads);
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

async function createAuthDocMembers(
  authdocId: number,
  members: Array<{ employee_code: string; employee_name: string; status?: string }>,
): Promise<void> {
  try {
    const membersData = members.map((member) => ({
      authdoc_id: authdocId,
      employee_code: String(member.employee_code),
      employee_name: member.employee_name,
      status: member.status || "active",
      created_date: new Date(),
      is_deleted: false,
    }));
    await repo.createMembers(membersData);
  } catch (error) {
    console.error(`Error creating auth doc members for doc ID ${authdocId}:`, error);
    throw error;
  }
}

// ==========================================
// HISTORY
// ==========================================

function historyDescription(employeeName: string, status: string): string {
  switch (status) {
    case "updated":
      return `${employeeName} has updated Authorization Document`;
    case "submitted":
      return `${employeeName} was upload Authorization Document`;
    case "not_approved":
      return `${employeeName} has not approved the Authorization Document`;
    case "rejected":
      return `${employeeName} has rejected the Authorization Document`;
    case "approved":
      return `${employeeName} has approved the Authorization Document`;
    default:
      return `${employeeName} has changed Authorization Document status to ${status}`;
  }
}

function historyDefaultNote(status: string): string {
  switch (status) {
    case "submitted":
      return "This authorization document has been submitted.";
    case "updated":
      return "This authorization document has been updated.";
    case "not_approved":
      return "This authorization document has not been approved.";
    case "rejected":
      return "This authorization document has been rejected.";
    case "approved":
      return "This authorization document has been approved.";
    default:
      return `Status has been changed to "${status}".`;
  }
}

async function createAuthHistory(
  authdoc_id: number,
  auth_id: number,
  created_by: string,
  status: string = "submitted",
  note: string = "",
): Promise<void> {
  try {
    const auth = await repo.findEmployeeName(auth_id);
    const employeeName = auth?.employee_name || "Unknown";
    await repo.createHistory({
      description: historyDescription(employeeName, status),
      employee_code: created_by,
      authdoc_id,
      auth_id,
      note: note || historyDefaultNote(status),
      status,
      created_date: new Date(),
      created_by,
      updated_date: new Date(),
    });
  } catch (error) {
    console.error("❌ Error creating history:", error);
    throw error;
  }
}

/** line_code = bagian kedua doc_number (XX/LINE_CODE/...). */
const lineCodeOf = (docNumber?: string | null) => {
  const parts = docNumber?.split("/") || [];
  return parts.length >= 2 ? parts[1] : null;
};

// ==========================================
// USE CASES
// ==========================================

const REQUIRED_CREATE_FIELDS = [
  "description", "created_by", "auth_id",
  "plant_id", "department_id", "section_department_id",
  "doc_number", "implementation_date", "evaluation", "conclution",
];

export async function create(data: any) {
  // Format pesan "Missing fields: a, b" dipertahankan, jadi cek wajib tetap di sini (bukan di DTO).
  const missingFields = REQUIRED_CREATE_FIELDS.filter((field) => !data[field]);
  if (missingFields.length > 0) {
    throw new HttpError(400, { error: "Validation Error", details: `Missing fields: ${missingFields.join(", ")}` });
  }

  const docNumberParts = data.doc_number.split("/");
  if (docNumberParts.length < 2) {
    throw new HttpError(400, {
      error: "Invalid doc_number format",
      details: "doc_number must follow the format: XX/LINE_CODE/...",
    });
  }
  const line_code = docNumberParts[1];

  const newChange = await repo.createDoc({
    proposed_change_id: data.proposed_change_id,
    doc_number: data.doc_number,
    implementation_date: data.implementation_date ? new Date(data.implementation_date) : undefined,
    evaluation: data.evaluation,
    description: data.description,
    conclution: data.conclution,
    concept: data.concept,
    standart: data.standart,
    method: data.method,
    status: data.status || "submitted",
    created_by: data.created_by,
    created_date: new Date(),
    auth_id: data.auth_id,
    plant_id: data.plant_id,
    department_id: data.department_id,
    section_department_id: data.section_department_id,
  });

  const operations = [
    createAuthHistory(newChange.id, data.auth_id, data.created_by, data.status || "submitted"),
    createdAuthApprovals(newChange.id, data.section_department_id, line_code),
  ];
  if (data.members && Array.isArray(data.members) && data.members.length > 0) {
    operations.push(createAuthDocMembers(newChange.id, data.members));
  }
  await Promise.all(operations);

  try {
    await sendSubmissionEmails(newChange.id, data.auth_id);
  } catch (emailError) {
    console.error("⚠️ Error sending email notifications:", emailError);
  }

  return newChange;
}

const VALID_SORT_COLUMNS = [
  "id", "doc_number", "implementation_date", "evaluation", "description",
  "conclution", "concept", "standart", "method", "status",
  "created_date", "created_by", "plant_id", "department_id", "section_department_id",
  "project_name",
];

export async function list(query: ListAuthDocQuery) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  let orderBy: any = { id: "asc" };
  if (VALID_SORT_COLUMNS.includes(sortColumn)) {
    orderBy = sortColumn === "project_name"
      ? { proposedChange: { project_name: sortDirection } }
      : { [sortColumn]: sortDirection };
  }

  const andConditions: any[] = [];
  if (searchTerm) {
    andConditions.push({
      OR: [
        { doc_number: { contains: searchTerm } },
        { evaluation: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { conclution: { contains: searchTerm } },
        { concept: { contains: searchTerm } },
        { standart: { contains: searchTerm } },
        { method: { contains: searchTerm } },
        { status: { contains: searchTerm } },
        { proposedChange: { project_name: { contains: searchTerm } } },
      ],
    });
  }

  if (query.status) andConditions.push({ status: query.status });
  if (query.plant_id) andConditions.push({ plant_id: Number(query.plant_id) });
  if (query.department_id) andConditions.push({ department_id: Number(query.department_id) });
  if (query.section_department_id) andConditions.push({ section_department_id: Number(query.section_department_id) });
  if (query.created_by) andConditions.push({ created_by: query.created_by });
  if (query.progress) andConditions.push({ progress: query.progress });
  if (query.change_type) andConditions.push({ change_type: query.change_type });
  if (query.need_engineering_approval !== undefined) {
    andConditions.push({ need_engineering_approval: query.need_engineering_approval === "true" });
  }
  if (query.need_production_approval !== undefined) {
    andConditions.push({ need_production_approval: query.need_production_approval === "true" });
  }
  if (query.auth_id) andConditions.push({ auth_id: Number(query.auth_id) });

  // dokumen yang sudah dipakai tr_handover tidak ditampilkan
  const where: any = { AND: andConditions, tr_handover: { none: {} } };

  const [data, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data,
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

const parseDocId = (id: string) => {
  const authDocId = parseInt(id, 10);
  if (isNaN(authDocId)) throw new HttpError(400, { error: "Validation Error", details: "ID must be a valid number" });
  return authDocId;
};

const notFound = (authDocId: number) =>
  new HttpError(404, { error: "Not Found", details: `Authorization document with ID ${authDocId} not found` });

export async function getById(id: string) {
  const authDocId = parseDocId(id);
  const authDoc = await repo.findByIdWithMembers(authDocId);
  if (!authDoc) throw notFound(authDocId);
  return {
    status: "success",
    data: [{ ...authDoc, line_code: lineCodeOf(authDoc.doc_number), project_name: authDoc.proposedChange?.project_name || null }],
  };
}

/** Approver yang sebelumnya "not_approved" (dari approval, fallback ke history) + catatan terakhirnya. */
async function findNotApprovedApprovers(authDocId: number): Promise<any[]> {
  const notApprovedApprovers: any[] = [];
  try {
    const authdocApprovals = await repo.findNotApprovedApprovals(authDocId);

    const approvalAuthIds = authdocApprovals.map((a) => a.auth_id).filter((id): id is number => !!id);
    const [approverRows, approverHistoryRows] = approvalAuthIds.length > 0
      ? await Promise.all([repo.findAuthorizationsByIds(approvalAuthIds), repo.findNotApprovedHistoriesOf(authDocId, approvalAuthIds)])
      : [[], []];
    const approverById = new Map(approverRows.map((a) => [a.id, a]));
    const latestHistoryByAuthId = new Map<number, (typeof approverHistoryRows)[number]>();
    for (const h of approverHistoryRows) {
      if (h.auth_id != null && !latestHistoryByAuthId.has(h.auth_id)) latestHistoryByAuthId.set(h.auth_id, h);
    }

    for (const approval of authdocApprovals) {
      if (approval.auth_id) {
        const approver = approverById.get(approval.auth_id);
        if (approver) {
          const approverHistory = latestHistoryByAuthId.get(approval.auth_id);
          notApprovedApprovers.push({ ...approver, note: approverHistory?.note || "No additional notes provided." });
        }
      }
    }

    if (notApprovedApprovers.length === 0) {
      const approvalHistories = await repo.findNotApprovedHistoriesDistinct(authDocId);
      const historyAuthIds = approvalHistories.map((h) => h.auth_id).filter((id): id is number => !!id);
      const historyApprovers = historyAuthIds.length > 0 ? await repo.findAuthorizationsByIds(historyAuthIds) : [];
      const historyApproverById = new Map(historyApprovers.map((a) => [a.id, a]));
      for (const history of approvalHistories) {
        if (history.auth_id) {
          const approver = historyApproverById.get(history.auth_id);
          if (approver) notApprovedApprovers.push({ ...approver, note: history.note || "No additional notes provided." });
        }
      }
    }
    return notApprovedApprovers;
  } catch (error) {
    console.error("❌ Error finding not_approved approvers:", error);
    return [];
  }
}

/** `editor` = user login (token); dicatat di history. Pemilik dokumen (auth_id record) tidak berubah. */
export async function update(id: string, updateData: any, editor: { auth_id?: number }) {
  const authDocId = parseDocId(id);

  const existingDoc = await repo.findByIdWithAuthorization(authDocId);
  if (!existingDoc) throw notFound(authDocId);

  const auth_id = editor.auth_id || existingDoc.auth_id;
  const created_by = updateData.created_by ?? existingDoc.created_by;
  if (!auth_id) {
    throw new HttpError(400, { error: "Validation Error", details: "auth_id is required for creating history" });
  }

  // status selalu "updated" bila tidak dikirim
  const documentStatus = updateData.status || "updated";

  const updatedAuthDoc = await repo.updateById(authDocId, {
    doc_number: updateData.doc_number ?? existingDoc.doc_number,
    implementation_date: updateData.implementation_date ? new Date(updateData.implementation_date) : existingDoc.implementation_date,
    evaluation: updateData.evaluation ?? existingDoc.evaluation,
    description: updateData.description ?? existingDoc.description,
    conclution: updateData.conclution ?? existingDoc.conclution,
    concept: updateData.concept ?? existingDoc.concept,
    standart: updateData.standart ?? existingDoc.standart,
    method: updateData.method ?? existingDoc.method,
    status: documentStatus,
    progress: updateData.progress ?? existingDoc.progress,
    auth_id: existingDoc.auth_id, // kepemilikan tidak ikut pindah ke pengedit
    plant_id: updateData.plant_id ?? existingDoc.plant_id,
    department_id: updateData.department_id ?? existingDoc.department_id,
    section_department_id: updateData.section_department_id ?? existingDoc.section_department_id,
    updated_at: new Date(),
  });

  if (updateData.members && Array.isArray(updateData.members)) {
    for (const member of updateData.members) {
      if (member.id) {
        await repo.updateMember(member.id, {
          employee_code: member.employee_code,
          employee_name: member.employee_name,
          status: member.status ?? "ACTIVE",
        });
      } else {
        await repo.createMember({
          authdoc_id: authDocId,
          employee_code: member.employee_code,
          employee_name: member.employee_name,
          status: member.status ?? "ACTIVE",
          created_date: new Date(),
          is_deleted: false,
        });
      }
    }

    if (updateData.deleted_member_ids && Array.isArray(updateData.deleted_member_ids)) {
      for (const memberId of updateData.deleted_member_ids) {
        await repo.softDeleteMember(memberId);
      }
    }
  }

  const status = documentStatus;
  const note = updateData.note || "";
  try {
    await createAuthHistory(authDocId, auth_id, created_by || "system", status, note);
  } catch (historyError) {
    console.error("❌ Error creating history record:", historyError);
    // fallback: coba insert sekali lagi dengan data yang sama
    try {
      await createAuthHistory(authDocId, auth_id, created_by || "system", status, note);
    } catch (forceError) {
      console.error("❌ Force insert also failed:", forceError);
    }
  }

  const notApprovedApprovers = await findNotApprovedApprovers(authDocId);

  const submitter = updatedAuthDoc?.auth_id ? await repo.findAuthorizationById(updatedAuthDoc.auth_id) : null;

  try {
    await sendAuthDocUpdateNotificationEmails(authDocId, updatedAuthDoc, notApprovedApprovers, submitter);
  } catch (emailError) {
    console.error("❌ Error sending notification emails:", emailError);
  }

  const updatedDoc = await repo.findByIdWithMembers(authDocId);
  return {
    status: "success",
    data: [{ ...updatedDoc, line_code: lineCodeOf(updatedDoc?.doc_number), project_name: updatedDoc?.proposedChange?.project_name || null }],
  };
}

export async function getHistory(id: string) {
  const authdocId = Number(id);
  if (isNaN(authdocId)) throw new HttpError(400, { error: "Invalid authdoc_id" });
  const histories = await repo.findHistories(authdocId);
  if (histories.length === 0) throw new HttpError(404, { message: `No history found for authdoc_id ${authdocId}` });
  return { data: histories };
}

export async function getApprovalList(id: string) {
  const authdocId = Number(id);
  if (isNaN(authdocId)) throw new HttpError(400, { error: "Invalid authdoc_id" });
  const approvals = await repo.findApprovals(authdocId);
  if (approvals.length === 0) throw new HttpError(404, { message: `No approval history found for authdoc_id ${authdocId}` });
  return { data: approvals };
}

export async function getDoneByAuthId(id: string) {
  const authId = Number(id);
  if (isNaN(authId)) throw new HttpError(400, { error: "Invalid auth_id parameter" });
  const result = await repo.findDoneByAuthId(authId);
  if (result.length === 0) {
    throw new HttpError(404, { message: `No documents found for auth_id ${authId} with progress 100% and status done` });
  }
  return { data: result };
}
