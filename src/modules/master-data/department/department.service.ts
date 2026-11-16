import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./department.repository";

const invalidId = () => new HttpError(400, { error: "Invalid ID", details: "ID must be a valid number." });

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const code = (query.code as string) || "";
  const name = (query.name as string) || "";
  const status = query.status === "true";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const where: any = { is_deleted: false, AND: [] };
  if (searchTerm) {
    where.OR = [
      { department_code: { contains: searchTerm.toLowerCase() } },
      { department_name: { contains: searchTerm.toLowerCase() } },
    ];
  }
  if (code) where.AND.push({ department_code: { equals: code.toLowerCase() } });
  // filter "name" memang memakai department_code = code (perilaku lama dipertahankan)
  if (name) where.AND.push({ department_code: { equals: code.toLowerCase() } });
  if (query.status !== undefined) where.status = status;

  const [departments, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, { [sortColumn]: sortDirection });
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: departments.map((dept) => ({
      id: dept.id,
      department_name: dept.department_name,
      department_code: dept.department_code,
      plant_code: dept.plant?.plant_code ?? null,
      status: dept.status,
      created_by: dept.created_by,
      created_at: dept.created_at,
      updated_by: dept.updated_by,
      updated_at: dept.updated_at,
    })),
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const id = parseInt(rawId);
  if (isNaN(id)) throw invalidId();
  const department = await repo.findActiveById(id);
  if (!department) throw new HttpError(404, { error: "Department not found or has been deleted" });
  return department;
}

async function assertPlantExists(plant_id: any) {
  if (plant_id && !(await repo.findPlantById(plant_id))) {
    throw new HttpError(400, { error: "Invalid plant_id", details: "Plant with provided ID does not exist." });
  }
}

const duplicateCode = () =>
  new HttpError(409, { error: "Duplicate department_code", details: "Department with this code already exists." });

export async function create(data: any) {
  await assertPlantExists(data.plant_id);
  if (data.department_code && (await repo.findByCode(data.department_code))) throw duplicateCode();
  return repo.create({
    department_name: data.department_name,
    department_code: data.department_code,
    plant_id: data.plant_id,
    status: data.status,
    created_by: data.created_by,
  });
}

export async function update(rawId: string, data: any) {
  const id = parseInt(rawId);
  if (isNaN(id)) throw invalidId();
  const existing = await repo.findById(id);
  if (!existing) throw new HttpError(404, { error: "Department not found" });
  await assertPlantExists(data.plant_id);
  if (data.department_code && data.department_code !== existing.department_code && (await repo.findByCode(data.department_code))) {
    throw duplicateCode();
  }
  return repo.update(id, {
    department_name: data.department_name,
    department_code: data.department_code,
    plant_id: data.plant_id,
    status: data.status,
    updated_by: data.updated_by,
    updated_at: new Date(),
  });
}

export async function remove(rawId: string) {
  const id = parseInt(rawId);
  if (isNaN(id)) throw invalidId();
  const existing = await repo.findById(id);
  if (!existing) throw new HttpError(404, { error: "Department not found" });
  if (existing.is_deleted) throw new HttpError(404, { error: "Department already deleted" });
  await repo.update(id, { is_deleted: true });
}
