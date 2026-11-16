import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./line.repository";

const validSortColumns = [
  "id", "line", "code_line", "status", "created_at", "updated_at",
  "section_name", "department_name", "plant_name", "plant_code",
];

function parseId(rawId: string) {
  const id = parseInt(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  return id;
}

/** Sisa validateLineData lama (line wajib dicek DTO). */
function validate(data: any) {
  const errors: string[] = [];
  if (data.line && data.line.length > 255) errors.push("Line name cannot exceed 255 characters.");
  if (data.id_section_manufacture == null) errors.push("Section Manufacture ID is required.");
  else if (typeof data.id_section_manufacture !== "number") errors.push("Section Manufacture ID must be a number.");
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
    ? sortColumn === "section_name"
      ? { section_manufacture: { section_name: sortDirection } }
      : sortColumn === "department_name"
        ? { section_manufacture: { department: { department_name: sortDirection } } }
        : sortColumn === "plant_name" || sortColumn === "plant_code"
          ? { section_manufacture: { department: { plant: { [sortColumn]: sortDirection } } } }
          : { [sortColumn]: sortDirection }
    : { id: "asc" };

  const where: any = { is_deleted: false, AND: [] };
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    where.OR = [
      { line: { contains: term } },
      { code_line: { contains: term } },
      { section_manufacture: { section_name: { contains: term } } },
      { section_manufacture: { department: { department_name: { contains: term } } } },
      { section_manufacture: { department: { plant: { plant_name: { contains: term } } } } },
      { section_manufacture: { department: { plant: { plant_code: { contains: term } } } } },
    ];
  }
  if (query.status !== undefined) where.status = status;

  const [lines, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: lines.map((line) => ({
      id: line.id,
      line: line.line,
      code_line: line.code_line,
      status: line.status,
      created_by: line.created_by,
      created_at: line.created_at,
      updated_by: line.updated_by,
      updated_at: line.updated_at,
      section_name: line.section_manufacture?.section_name ?? null,
      department_name: line.section_manufacture?.department?.department_name ?? null,
      plant_name: line.section_manufacture?.department?.plant?.plant_name ?? null,
      plant_code: line.section_manufacture?.department?.plant?.plant_code ?? null,
    })),
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const line = await repo.findActiveById(parseId(rawId));
  if (!line) throw new HttpError(404, { error: "Line not found" });
  return line;
}

export async function create(data: any) {
  validate(data);
  if (!(await repo.findSectionById(data.id_section_manufacture))) {
    throw new HttpError(400, { error: "Invalid id_section_manufacture", details: "Section with provided ID does not exist." });
  }
  if (await repo.findByNameInSection(data.line, data.id_section_manufacture)) {
    throw new HttpError(409, { error: "Duplicate line", details: `Line with name ${data.line} already exists in this section` });
  }
  return repo.create({
    line: data.line,
    id_section_manufacture: data.id_section_manufacture,
    code_line: data.code_line,
    status: data.status ?? true,
    created_by: data.created_by,
  });
}

export async function update(rawId: string, data: any) {
  const id = parseId(rawId);
  validate(data);
  return repo.update(id, {
    line: data.line,
    id_section_manufacture: data.id_section_manufacture,
    code_line: data.code_line,
    status: data.status,
    updated_by: data.updated_by,
    updated_at: new Date(),
  });
}

export async function remove(rawId: string) {
  await repo.update(parseId(rawId), { is_deleted: true });
}
