import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./approver-handover.repository";
import { TemplateApprovalHandoverData } from "./approver-handover.dto";
import { formatAppliesToLines, parseAppliesToLines, validateTemplateApprovalAuthData as validateTemplateApprovalHandoverData } from "../approver-authorization/approver-authorization.utils";

const NOT_FOUND = { error: "Template approval handover not found" };
const DUPLICATE = { error: "Template approval handover with same name, step order, model type, and line code already exists" };

const withFormattedLines = <T extends { applies_to_lines: any }>(item: T) => ({
  ...item,
  applies_to_lines: formatAppliesToLines(item.applies_to_lines),
});

const appliesToLine = (lineCode: string) => (step: { applies_to_lines: any }) => {
  const appliesToLines = formatAppliesToLines(step.applies_to_lines);
  return appliesToLines && appliesToLines.includes(lineCode);
};

function parseId(rawId: string): number {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID parameter" });
  return id;
}

const createData = (data: TemplateApprovalHandoverData, parsedAppliesToLines: any) => ({
  template_name: data.template_name,
  line_code: data.line_code || null,
  step_order: data.step_order,
  actor_name: data.actor_name,
  model_type: data.model_type as any,
  section_id: data.section_id ?? null,
  use_dynamic_section: data.use_dynamic_section ?? false,
  use_line_section: data.use_line_section ?? false,
  is_insert_step: data.is_insert_step ?? false,
  insert_after_step: data.insert_after_step ?? null,
  applies_to_lines: parsedAppliesToLines,
  is_active: data.is_active ?? true,
  priority: data.priority ?? 0,
  description: data.description || null,
  created_by: data.created_by,
  created_date: new Date(),
  updated_by: data.created_by,
  updated_date: new Date(),
  is_deleted: false,
});

const duplicateWhere = (data: TemplateApprovalHandoverData) => ({
  template_name: data.template_name,
  step_order: data.step_order,
  model_type: data.model_type as any,
  line_code: data.line_code || null,
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
  const templateName = query.template_name as string;
  const isInsertStep = query.is_insert_step === "true" ? true : query.is_insert_step === "false" ? false : undefined;

  const validSortColumns = [
    "id", "template_name", "line_code", "step_order", "actor_name",
    "model_type", "priority", "is_insert_step", "insert_after_step", "created_date", "updated_date",
  ];

  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };

  const whereCondition: any = { is_deleted: false };
  const andConditions = [];

  if (isActive !== undefined) andConditions.push({ is_active: isActive });
  if (lineCode) andConditions.push({ line_code: lineCode });
  if (modelType) andConditions.push({ model_type: modelType });
  if (templateName) andConditions.push({ template_name: templateName });
  if (isInsertStep !== undefined) andConditions.push({ is_insert_step: isInsertStep });
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

  const [templateHandovers, totalCount] = await repo.findPage(whereCondition, orderBy, (page - 1) * limit, limit);
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: templateHandovers.map(withFormattedLines),
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const templateHandover = await repo.findActiveByIdWithSection(parseId(rawId));
  if (!templateHandover) throw new HttpError(404, NOT_FOUND);
  return withFormattedLines(templateHandover);
}

export async function create(body: any) {
  const validationErrors = validateTemplateApprovalHandoverData(body);
  if (validationErrors.length > 0) throw new HttpError(400, { errors: validationErrors });

  const data: TemplateApprovalHandoverData = body;
  const parsedAppliesToLines = parseAppliesToLines(data.applies_to_lines);

  const created = await repo.transaction(async (tx) => {
    if (await repo.findFirst(duplicateWhere(data), tx)) throw new HttpError(409, DUPLICATE);
    return repo.createWithSection(createData(data, parsedAppliesToLines), tx);
  });

  return withFormattedLines(created);
}

export async function update(rawId: string, body: any) {
  const id = parseId(rawId);

  const validationErrors = validateTemplateApprovalHandoverData(body);
  if (validationErrors.length > 0) throw new HttpError(400, { errors: validationErrors });

  if (!(await repo.findActiveById(id))) throw new HttpError(404, NOT_FOUND);

  const data: TemplateApprovalHandoverData = body;
  if (await repo.findFirst({ ...duplicateWhere(data), id: { not: id } })) throw new HttpError(409, DUPLICATE);

  const parsedAppliesToLines = parseAppliesToLines(data.applies_to_lines);

  const updated = await repo.updateByIdWithSection(id, {
    template_name: data.template_name,
    line_code: data.line_code || null,
    step_order: data.step_order,
    actor_name: data.actor_name,
    model_type: data.model_type as any,
    section_id: data.section_id ?? null,
    use_dynamic_section: data.use_dynamic_section ?? false,
    use_line_section: data.use_line_section ?? false,
    is_insert_step: data.is_insert_step ?? false,
    insert_after_step: data.insert_after_step ?? null,
    applies_to_lines: parsedAppliesToLines,
    is_active: data.is_active ?? true,
    priority: data.priority ?? 0,
    description: data.description || null,
    updated_by: data.updated_by || data.created_by,
    updated_date: new Date(),
  });

  return withFormattedLines(updated);
}

export async function remove(rawId: string, body: any) {
  const id = Number(rawId);
  const deletedBy = body.deleted_by || "system";
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID parameter" });

  if (!(await repo.findActiveById(id))) throw new HttpError(404, NOT_FOUND);

  await repo.updateById(id, {
    is_deleted: true,
    is_active: false,
    updated_by: deletedBy,
    updated_date: new Date(),
  });
}

export async function bulkCreate(body: any) {
  const { data: templateHandovers } = body;

  if (!Array.isArray(templateHandovers) || templateHandovers.length === 0) {
    throw new HttpError(400, { error: "Data must be a non-empty array" });
  }

  const successes: any[] = [];
  const failures: any[] = [];

  await repo.transaction(async (tx) => {
    for (let i = 0; i < templateHandovers.length; i++) {
      try {
        const validationErrors = validateTemplateApprovalHandoverData(templateHandovers[i]);
        if (validationErrors.length > 0) {
          failures.push({ index: i, error: `Validation failed: ${validationErrors.join(", ")}` });
          continue;
        }

        const data: TemplateApprovalHandoverData = templateHandovers[i];

        if (await repo.findFirst(duplicateWhere(data), tx)) {
          failures.push({ index: i, error: DUPLICATE.error });
          continue;
        }

        const result = await repo.create(createData(data, parseAppliesToLines(data.applies_to_lines)), tx);
        successes.push(withFormattedLines(result));
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
  const templateHandovers = await repo.findActiveByTemplateName(templateName);
  return templateHandovers.map(withFormattedLines);
}

export async function listByLineCode(lineCode: string) {
  if (!lineCode) throw new HttpError(400, { error: "Line code is required" });

  const [defaultTemplates, insertSteps] = await Promise.all([
    repo.findDefaultTemplatesWithSection(),
    repo.findInsertStepsWithSection(),
  ]);
  const applicableInsertSteps = insertSteps.filter(appliesToLine(lineCode));
  const formattedData = [...defaultTemplates, ...applicableInsertSteps].map(withFormattedLines);

  return {
    data: formattedData,
    count: formattedData.length,
    default_steps: defaultTemplates.length,
    insert_steps: applicableInsertSteps.length,
  };
}
