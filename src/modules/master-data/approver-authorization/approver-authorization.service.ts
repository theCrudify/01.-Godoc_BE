import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./approver-authorization.repository";
import { TemplateApprovalAuthData, ValidateApprovalFlowDto } from "./approver-authorization.dto";
import { formatAppliesToLines, parseAppliesToLines, validateTemplateApprovalAuthData } from "./approver-authorization.utils";

const NOT_FOUND = { error: "Template approval authorization not found" };
const DUPLICATE = { error: "Template approval authorization with same name, step order, model type, and line code already exists" };

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

const createData = (data: TemplateApprovalAuthData, parsedAppliesToLines: any) => ({
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

const duplicateWhere = (data: TemplateApprovalAuthData) => ({
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

  const [templateAuthorizations, totalCount] = await repo.findPage(whereCondition, orderBy, (page - 1) * limit, limit);
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: templateAuthorizations.map(withFormattedLines),
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const templateAuthorization = await repo.findActiveByIdWithSection(parseId(rawId));
  if (!templateAuthorization) throw new HttpError(404, NOT_FOUND);
  return withFormattedLines(templateAuthorization);
}

export async function create(body: any) {
  const validationErrors = validateTemplateApprovalAuthData(body);
  if (validationErrors.length > 0) throw new HttpError(400, { errors: validationErrors });

  const data: TemplateApprovalAuthData = body;
  const parsedAppliesToLines = parseAppliesToLines(data.applies_to_lines);

  const created = await repo.transaction(async (tx) => {
    if (await repo.findFirst(duplicateWhere(data), tx)) throw new HttpError(409, DUPLICATE);
    return repo.createWithSection(createData(data, parsedAppliesToLines), tx);
  });

  return withFormattedLines(created);
}

export async function update(rawId: string, body: any) {
  const id = parseId(rawId);

  const validationErrors = validateTemplateApprovalAuthData(body);
  if (validationErrors.length > 0) throw new HttpError(400, { errors: validationErrors });

  if (!(await repo.findActiveById(id))) throw new HttpError(404, NOT_FOUND);

  const data: TemplateApprovalAuthData = body;
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
  const { data: templateAuthorizations } = body;

  if (!Array.isArray(templateAuthorizations) || templateAuthorizations.length === 0) {
    throw new HttpError(400, { error: "Data must be a non-empty array" });
  }

  const successes: any[] = [];
  const failures: any[] = [];

  await repo.transaction(async (tx) => {
    for (let i = 0; i < templateAuthorizations.length; i++) {
      try {
        const validationErrors = validateTemplateApprovalAuthData(templateAuthorizations[i]);
        if (validationErrors.length > 0) {
          failures.push({ index: i, error: `Validation failed: ${validationErrors.join(", ")}` });
          continue;
        }

        const data: TemplateApprovalAuthData = templateAuthorizations[i];

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
  const templateAuthorizations = await repo.findActiveByTemplateName(templateName);
  return templateAuthorizations.map(withFormattedLines);
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

export async function listInsertSteps(lineCode: string) {
  const insertSteps = await repo.findInsertStepsOrdered();
  const filteredSteps = lineCode ? insertSteps.filter(appliesToLine(lineCode)) : insertSteps;
  return filteredSteps.map(withFormattedLines);
}

export async function toggleStatus(rawId: string, body: any) {
  const id = Number(rawId);
  const updatedBy = body.updated_by || "system";
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID parameter" });

  const existingTemplate = await repo.findActiveById(id);
  if (!existingTemplate) throw new HttpError(404, NOT_FOUND);

  const updated = await repo.updateByIdWithSection(id, {
    is_active: !existingTemplate.is_active,
    updated_by: updatedBy,
    updated_date: new Date(),
  });
  return withFormattedLines(updated);
}

export async function getFlowByLineCode(lineCode: string) {
  if (!lineCode) throw new HttpError(400, { error: "Line code is required" });

  const [defaultTemplates, insertSteps] = await Promise.all([
    repo.findDefaultTemplatesWithSection(),
    repo.findInsertStepsWithSection(),
  ]);
  const applicableInsertSteps = insertSteps.filter(appliesToLine(lineCode));

  if (applicableInsertSteps.length === 0) {
    const formattedDefaultData = defaultTemplates.map((template, index) => ({
      ...template,
      step_order: index + 1,
      applies_to_lines: formatAppliesToLines(template.applies_to_lines),
      flow_type: "default",
    }));

    return {
      data: formattedDefaultData,
      flow_info: {
        line_code: lineCode,
        total_steps: formattedDefaultData.length,
        default_steps: formattedDefaultData.length,
        insert_steps: 0,
        flow_type: "default_only",
      },
    };
  }

  // Sisipkan insert step tepat setelah step default yang ditunjuk insert_after_step.
  const finalFlow: any[] = [];
  let currentStep = 1;

  const insertStepMap = new Map<number, any[]>();
  applicableInsertSteps.forEach((step) => {
    const afterStep = step.insert_after_step || 0;
    if (!insertStepMap.has(afterStep)) insertStepMap.set(afterStep, []);
    insertStepMap.get(afterStep)!.push(step);
  });

  defaultTemplates.forEach((defaultTemplate) => {
    finalFlow.push({
      ...defaultTemplate,
      step_order: currentStep++,
      applies_to_lines: formatAppliesToLines(defaultTemplate.applies_to_lines),
      flow_type: "default",
    });

    const insertsAfterThisStep = insertStepMap.get(defaultTemplate.step_order) || [];
    insertsAfterThisStep.forEach((insertStep) => {
      finalFlow.push({
        ...insertStep,
        step_order: currentStep++,
        applies_to_lines: formatAppliesToLines(insertStep.applies_to_lines),
        flow_type: "insert",
      });
    });
  });

  return {
    data: finalFlow,
    flow_info: {
      line_code: lineCode,
      total_steps: finalFlow.length,
      default_steps: defaultTemplates.length,
      insert_steps: applicableInsertSteps.length,
      flow_type: "combined",
    },
  };
}

export async function listTemplateNames() {
  const templates = await repo.findUniqueTemplateNames();
  return templates.map((t) => t.template_name);
}

export async function listLineCodes() {
  const allTemplates = await repo.findActiveAppliesToLines();

  const templatesWithLinesCodes = allTemplates.filter(
    (template) => template.applies_to_lines !== null && template.applies_to_lines !== undefined,
  );

  const allLineCodes = new Set<string>();
  templatesWithLinesCodes.forEach((template) => {
    const lineCodes = formatAppliesToLines(template.applies_to_lines);
    if (lineCodes && lineCodes.length > 0) {
      lineCodes.forEach((code) => {
        if (code && code.trim()) allLineCodes.add(code.trim());
      });
    }
  });

  return Array.from(allLineCodes).sort();
}

export async function validateFlow(body: ValidateApprovalFlowDto) {
  const { line_code } = body;

  const [defaultTemplates, insertSteps] = await Promise.all([repo.findDefaultTemplates(), repo.findInsertSteps()]);
  const applicableInsertSteps = insertSteps.filter(appliesToLine(line_code));

  const validationResults = {
    is_valid: true,
    warnings: [] as string[],
    errors: [] as string[],
    flow_summary: {
      default_steps: defaultTemplates.length,
      insert_steps: applicableInsertSteps.length,
      total_steps: defaultTemplates.length + applicableInsertSteps.length,
    },
  };

  if (defaultTemplates.length === 0) {
    validationResults.errors.push("No default approval templates found");
    validationResults.is_valid = false;
  }

  const defaultStepOrders = defaultTemplates.map((t) => t.step_order).sort((a, b) => a - b);
  for (let i = 1; i < defaultStepOrders.length; i++) {
    if (defaultStepOrders[i] !== defaultStepOrders[i - 1] + 1) {
      validationResults.warnings.push(`Gap in default template step order between ${defaultStepOrders[i - 1]} and ${defaultStepOrders[i]}`);
    }
  }

  applicableInsertSteps.forEach((step) => {
    if (step.insert_after_step === null || step.insert_after_step === undefined) {
      validationResults.errors.push(`Insert step "${step.actor_name}" has no insert_after_step defined`);
      validationResults.is_valid = false;
    } else if (step.insert_after_step < 0 || step.insert_after_step > defaultTemplates.length) {
      validationResults.errors.push(`Insert step "${step.actor_name}" has invalid insert_after_step: ${step.insert_after_step}`);
      validationResults.is_valid = false;
    }
  });

  return { line_code, validation: validationResults };
}
