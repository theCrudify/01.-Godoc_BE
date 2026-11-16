import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./approver-proposed.repository";
import { TemplateApprovalData } from "./approver-proposed.dto";

const DUPLICATE_MESSAGE = "Template approval with same name, step order, and model type already exists";

function validateTemplateApprovalData(data: any): string[] {
  const errors: string[] = [];

  if (!data.template_name || data.template_name.trim() === "") {
    errors.push("Template name is required.");
  } else if (data.template_name.length > 255) {
    errors.push("Template name cannot exceed 255 characters.");
  }

  if (!data.actor_name || data.actor_name.trim() === "") {
    errors.push("Actor name is required.");
  } else if (data.actor_name.length > 255) {
    errors.push("Actor name cannot exceed 255 characters.");
  }

  if (!data.created_by || data.created_by.trim() === "") {
    errors.push("Created by is required.");
  } else if (data.created_by.length > 100) {
    errors.push("Created by cannot exceed 100 characters.");
  }

  if (data.step_order === undefined || data.step_order === null) {
    errors.push("Step order is required.");
  } else if (!Number.isInteger(data.step_order) || data.step_order < 0) {
    errors.push("Step order must be a non-negative integer.");
  }

  if (!data.model_type || data.model_type.trim() === "") {
    errors.push("Model type is required.");
  }

  if (data.line_code && data.line_code.length > 50) {
    errors.push("Line code cannot exceed 50 characters.");
  }

  if (data.updated_by && data.updated_by.length > 100) {
    errors.push("Updated by cannot exceed 100 characters.");
  }

  if (data.section_id !== undefined && data.section_id !== null && !Number.isInteger(data.section_id)) {
    errors.push("Section ID must be an integer.");
  }

  if (data.priority !== undefined && data.priority !== null && (!Number.isInteger(data.priority) || data.priority < 0)) {
    errors.push("Priority must be a non-negative integer.");
  }

  if (data.need_engineering_approval !== undefined && typeof data.need_engineering_approval !== "boolean") {
    errors.push("Need engineering approval must be a boolean.");
  }

  if (data.need_production_approval !== undefined && typeof data.need_production_approval !== "boolean") {
    errors.push("Need production approval must be a boolean.");
  }

  if (data.use_dynamic_section !== undefined && typeof data.use_dynamic_section !== "boolean") {
    errors.push("Use dynamic section must be a boolean.");
  }

  if (data.use_line_section !== undefined && typeof data.use_line_section !== "boolean") {
    errors.push("Use line section must be a boolean.");
  }

  if (data.is_active !== undefined && typeof data.is_active !== "boolean") {
    errors.push("Is active must be a boolean.");
  }

  return errors;
}

function parseId(rawId: string): number {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID parameter" });
  return id;
}

async function findExisting(id: number) {
  const existing = await repo.findActiveById(id);
  if (!existing) throw new HttpError(404, { error: "Template approval not found" });
  return existing;
}

const createData = (data: TemplateApprovalData) => ({
  template_name: data.template_name,
  line_code: data.line_code || null,
  need_engineering_approval: data.need_engineering_approval ?? null,
  need_production_approval: data.need_production_approval ?? null,
  step_order: data.step_order,
  actor_name: data.actor_name,
  model_type: data.model_type as any,
  section_id: data.section_id ?? null,
  use_dynamic_section: data.use_dynamic_section ?? false,
  use_line_section: data.use_line_section ?? false,
  is_active: data.is_active ?? true,
  priority: data.priority ?? 0,
  description: data.description || null,
  created_by: data.created_by,
  created_date: new Date(),
  updated_by: data.created_by,
  updated_date: new Date(),
  is_deleted: false,
});

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const isActive = query.is_active === "true" ? true : query.is_active === "false" ? false : undefined;
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";
  const lineCode = query.line_code as string;
  const modelType = query.model_type as string;

  const validSortColumns = [
    "id", "template_name", "line_code", "step_order", "actor_name",
    "model_type", "priority", "created_date", "updated_date",
  ];

  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };

  const whereCondition: any = { is_deleted: false };
  const andConditions = [];

  if (isActive !== undefined) andConditions.push({ is_active: isActive });
  if (lineCode) andConditions.push({ line_code: lineCode });
  if (modelType) andConditions.push({ model_type: modelType });
  if (searchTerm) {
    andConditions.push({
      OR: [
        { template_name: { contains: searchTerm } },
        { line_code: { contains: searchTerm } },
        { actor_name: { contains: searchTerm } },
        { model_type: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { created_by: { contains: searchTerm } },
      ],
    });
  }
  if (andConditions.length > 0) whereCondition.AND = andConditions;

  const [templateApprovals, totalCount] = await repo.findPage(whereCondition, orderBy, (page - 1) * limit, limit);
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: templateApprovals,
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  return findExisting(parseId(rawId));
}

export async function create(body: any) {
  const validationErrors = validateTemplateApprovalData(body);
  if (validationErrors.length > 0) throw new HttpError(400, { errors: validationErrors });

  const data: TemplateApprovalData = body;
  const existingTemplate = await repo.findFirst({
    template_name: data.template_name,
    step_order: data.step_order,
    model_type: data.model_type as any,
    is_deleted: false,
  });
  if (existingTemplate) throw new HttpError(409, { error: DUPLICATE_MESSAGE });

  return repo.create(createData(data));
}

export async function update(rawId: string, body: any) {
  const id = parseId(rawId);

  const validationErrors = validateTemplateApprovalData(body);
  if (validationErrors.length > 0) throw new HttpError(400, { errors: validationErrors });

  await findExisting(id);

  const data: TemplateApprovalData = body;
  const duplicateTemplate = await repo.findFirst({
    template_name: data.template_name,
    step_order: data.step_order,
    model_type: data.model_type as any,
    id: { not: id },
    is_deleted: false,
  });
  if (duplicateTemplate) throw new HttpError(409, { error: DUPLICATE_MESSAGE });

  return repo.updateById(id, {
    template_name: data.template_name,
    line_code: data.line_code || null,
    need_engineering_approval: data.need_engineering_approval ?? null,
    need_production_approval: data.need_production_approval ?? null,
    step_order: data.step_order,
    actor_name: data.actor_name,
    model_type: data.model_type as any,
    section_id: data.section_id ?? null,
    use_dynamic_section: data.use_dynamic_section ?? false,
    use_line_section: data.use_line_section ?? false,
    is_active: data.is_active ?? true,
    priority: data.priority ?? 0,
    description: data.description || null,
    updated_by: data.updated_by || data.created_by,
    updated_date: new Date(),
  });
}

export async function remove(rawId: string, body: any) {
  const id = Number(rawId);
  const deletedBy = body.deleted_by || "system";
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID parameter" });

  await findExisting(id);

  await repo.updateById(id, {
    is_deleted: true,
    is_active: false,
    updated_by: deletedBy,
    updated_date: new Date(),
  });
}

export async function bulkCreate(body: any) {
  const { data: templateApprovals } = body;

  if (!Array.isArray(templateApprovals) || templateApprovals.length === 0) {
    throw new HttpError(400, { error: "Data must be a non-empty array" });
  }

  const successes: any[] = [];
  const failures: any[] = [];

  await repo.transaction(async (tx) => {
    for (let i = 0; i < templateApprovals.length; i++) {
      try {
        const validationErrors = validateTemplateApprovalData(templateApprovals[i]);
        if (validationErrors.length > 0) {
          failures.push({ index: i, error: `Validation failed: ${validationErrors.join(", ")}` });
          continue;
        }

        const data: TemplateApprovalData = templateApprovals[i];

        const existingTemplate = await repo.findFirst({
          template_name: data.template_name,
          step_order: data.step_order,
          model_type: data.model_type as any,
          is_deleted: false,
        }, tx);

        if (existingTemplate) {
          failures.push({ index: i, error: DUPLICATE_MESSAGE });
          continue;
        }

        successes.push(await repo.create(createData(data), tx));
      } catch (err) {
        console.error(`❌ Failed to insert at index ${i}`, err);
        failures.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  });

  return { successes, failures };
}

export async function listByTemplateName(templateName: string) {
  if (!templateName) throw new HttpError(400, { error: "Template name is required" });
  return repo.findActiveByTemplateName(templateName);
}

export async function listByLineCode(lineCode: string) {
  if (!lineCode) throw new HttpError(400, { error: "Line code is required" });
  return repo.findActiveByLineCode(lineCode);
}

export async function toggleStatus(rawId: string, body: any) {
  const id = Number(rawId);
  const updatedBy = body.updated_by || "system";
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID parameter" });

  const existingTemplate = await findExisting(id);

  return repo.updateById(id, {
    is_active: !existingTemplate.is_active,
    updated_by: updatedBy,
    updated_date: new Date(),
  });
}
