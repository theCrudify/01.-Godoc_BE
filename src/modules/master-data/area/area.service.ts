import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./area.repository";

const validSortColumns = ["id", "area", "code_area", "status", "created_at", "updated_at", "line.code_line"];

function parseId(rawId: string) {
  const id = parseInt(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  return id;
}

/** Sisa validateAreaData lama (area & code_area wajib dicek DTO). */
function validate(data: any) {
  const errors: string[] = [];
  if (data.area && data.area.length > 255) errors.push("Area name cannot exceed 255 characters.");
  if (data.code_area && data.code_area.length > 255) errors.push("Code Area cannot exceed 255 characters.");
  if (data.id_line !== undefined && data.id_line !== null && typeof data.id_line !== "number") {
    errors.push("Line ID must be a number.");
  }
  if (errors.length > 0) throw new HttpError(400, { error: "Validation Error", details: errors });
}

async function assertLineExists(id_line: any) {
  if (id_line !== undefined && id_line !== null && !(await repo.findLineById(id_line))) {
    throw new HttpError(400, { error: "Invalid id_line", details: "Line with provided ID does not exist." });
  }
}

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const status = query.status === "true";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };

  const where: any = { is_deleted: false, AND: [] };
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    where.OR = [
      { area: { contains: term } },
      { code_area: { contains: term } },
      { line: { line: { contains: term } } },
      { line: { code_line: { contains: term } } },
    ];
  }
  if (query.status !== undefined) where.status = status;

  const [areas, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: areas.map((area) => ({
      id: area.id,
      id_line: area.id_line,
      area: area.area,
      code_area: area.code_area,
      status: area.status,
      created_by: area.created_by,
      created_at: area.created_at,
      updated_by: area.updated_by,
      updated_at: area.updated_at,
      line_details: area.line ?? null,
    })),
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const area = await repo.findByIdWithLine(parseId(rawId));
  if (!area) throw new HttpError(404, { error: "Area not found" });
  return area;
}

export async function create(data: any) {
  validate(data);
  await assertLineExists(data.id_line);
  return repo.create({
    area: data.area,
    code_area: data.code_area,
    id_line: data.id_line,
    status: data.status !== undefined ? data.status : true,
    created_by: data.created_by,
  });
}

export async function update(rawId: string, data: any) {
  const id = parseId(rawId);
  if (!(await repo.findById(id))) throw new HttpError(404, { error: "Area not found" });
  await assertLineExists(data.id_line);
  return repo.update(id, {
    area: data.area,
    code_area: data.code_area,
    id_line: data.id_line,
    status: data.status,
    updated_by: data.updated_by,
    updated_at: new Date(),
  });
}

export async function remove(rawId: string) {
  const id = parseId(rawId);
  if (!(await repo.findById(id))) throw new HttpError(404, { error: "Area not found" });
  await repo.update(id, { is_deleted: true });
}
