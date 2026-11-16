import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./section-department.repository";

const validSortColumns = ["id", "section_name", "status", "created_at", "updated_at", "department_name", "department_code", "plant_name"];

function parseId(rawId: string) {
  const id = parseInt(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  return id;
}

/** Sisa validateSectionDepartmentData lama (section_name wajib dicek DTO). */
function validate(data: any) {
  const errors: string[] = [];
  if (data.section_name && data.section_name.length > 255) errors.push("Section name cannot exceed 255 characters.");
  if (data.department_id == null) errors.push("Department ID is required.");
  else if (typeof data.department_id !== "number") errors.push("Department ID must be a number.");
  if (errors.length > 0) throw new HttpError(400, { error: "Validation Error", details: errors });
}

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const status = query.status === "true";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const orderBy: any = validSortColumns.includes(sortColumn)
    ? sortColumn === "department_name" || sortColumn === "department_code"
      ? { department: { [sortColumn]: sortDirection } }
      : sortColumn === "plant_name"
        ? { department: { plant: { plant_name: sortDirection } } }
        : { [sortColumn]: sortDirection }
    : { id: "asc" };

  const where: any = { is_deleted: false, AND: [] };
  if (searchTerm) {
    where.OR = [
      { section_name: { contains: searchTerm.toLowerCase() } },
      { department: { department_name: { contains: searchTerm.toLowerCase() } } },
      { department: { department_code: { contains: searchTerm.toLowerCase() } } },
      { department: { plant: { plant_name: { contains: searchTerm.toLowerCase() } } } },
    ];
  }
  if (query.status !== undefined) where.status = status;

  const [sections, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: sections.map((section) => ({
      id: section.id,
      department_id: section.department_id,
      section_name: section.section_name,
      status: section.status,
      created_by: section.created_by,
      created_at: section.created_at,
      updated_by: section.updated_by,
      updated_at: section.updated_at,
      is_deleted: section.is_deleted,
      plant_name: section.department?.plant?.plant_name ?? null,
      plant_id: section.department?.plant?.id ?? null,
      department_name: section.department?.department_name ?? null,
      department_code: section.department?.department_code ?? null,
    })),
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const section = await repo.findActiveById(parseId(rawId));
  if (!section) throw new HttpError(404, { error: "Section Department not found" });
  return section;
}

export async function create(data: any) {
  validate(data);
  if (data.department_id !== undefined && data.department_id !== null && !(await repo.findDepartmentById(data.department_id))) {
    throw new HttpError(400, { error: "Invalid department_id", details: "Department with provided ID does not exist." });
  }
  if (data.section_name && (await repo.findByNameInDepartment(data.section_name, data.department_id))) {
    throw new HttpError(409, {
      error: "Duplicate section_name",
      details: `Section with name ${data.section_name} already exist in this department`,
    });
  }
  return repo.create({
    section_name: data.section_name,
    department_id: data.department_id,
    status: data.status !== undefined ? data.status : true,
    created_by: data.created_by,
  });
}

export async function update(rawId: string, data: any) {
  const id = parseId(rawId);
  validate(data);
  return repo.update(id, {
    section_name: data.section_name,
    department_id: data.department_id,
    status: data.status,
    updated_by: data.updated_by,
    updated_at: new Date(),
  });
}

export async function remove(rawId: string) {
  await repo.update(parseId(rawId), { is_deleted: true });
}
