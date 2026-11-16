import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./authorization.repository";

function parseId(rawId: string) {
  const id = parseInt(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  return id;
}

const pagination = (totalCount: number, page: number, limit: number) => {
  const totalPages = Math.ceil(totalCount / limit);
  return { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 };
};

export async function getById(rawId: string) {
  const authorization = await repo.findActiveByIdWithRelations(parseId(rawId));
  if (!authorization) throw new HttpError(404, { error: "Authorization not found" });
  return authorization;
}

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const status = query.status === "true";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const where: any = { is_deleted: false, AND: [] };
  if (searchTerm) {
    where.OR = [{ employee_code: { contains: searchTerm } }, { employee_name: { contains: searchTerm } }];
  }
  if (query.status !== undefined) where.status = status;

  const [authorizations, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, { [sortColumn]: sortDirection });
  return {
    data: authorizations.map((auth) => ({
      id: auth.id,
      employee_code: auth.employee_code,
      employee_name: auth.employee_name,
      department_name: auth.department?.department_name ?? null,
      section_name: auth.section?.section_name ?? null,
      plant_code: auth.plant?.plant_code ?? null,
      role_name: auth.role?.role_name ?? null,
      department_id: auth.department_id,
      section_id: auth.section_id,
      plant_id: auth.plant_id,
      role_id: auth.role_id,
      email: auth.email,
      number_phone: auth.number_phone,
      gender: auth.gender,
      status: auth.status,
      created_by: auth.created_by,
      created_at: auth.created_at,
      updated_by: auth.updated_by,
      updated_at: auth.updated_at,
    })),
    pagination: pagination(totalCount, page, limit),
  };
}

export async function remove(rawId: string) {
  await repo.update(parseId(rawId), { is_deleted: true });
}

export async function update(rawId: string, data: any) {
  const id = parseId(rawId);
  if (!(await repo.findActiveById(id))) {
    throw new HttpError(404, { error: "Authorization not found or has been deleted" });
  }
  return repo.update(id, {
    employee_code: data.employee_code,
    employee_name: data.employee_name,
    department_id: data.department_id,
    section_id: data.section_id,
    plant_id: data.plant_id,
    role_id: data.role_id,
    status: data.status,
    email: data.email,
    number_phone: data.number_phone,
    gender: data.gender || "M",
    updated_by: data.updated_by,
    updated_at: new Date(),
  });
}

export async function create(data: any) {
  if (await repo.findActiveByEmployeeCode(data.employee_code)) {
    console.warn("⚠️ Duplicate Employee Code:", data.employee_code);
    throw new HttpError(400, {
      error: "Duplicate Employee Code",
      message: "Employee authorization already exists and is active.",
    });
  }
  return repo.create({
    employee_code: data.employee_code,
    employee_name: data.employee_name,
    department_id: data.department_id,
    section_id: data.section_id,
    plant_id: data.plant_id,
    role_id: data.role_id,
    status: data.status ?? true,
    email: data.email,
    number_phone: data.number_phone,
    gender: data.gender || "M",
    created_by: data.created_by,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

const validRoleSortColumns = ["id", "role_name", "description", "created_at", "updated_at", "created_by", "updated_by"];

export async function listRoles(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  if (!validRoleSortColumns.includes(sortColumn)) throw new HttpError(400, { error: "Invalid sort column" });

  const where: any = {};
  if (searchTerm) {
    where.role_name = { contains: searchTerm.toLowerCase() };
    where.description = { contains: searchTerm.toLowerCase() };
  }

  const [roles, totalCount] = await repo.findRolePage(where, (page - 1) * limit, limit, { [sortColumn]: sortDirection });
  return { data: roles, pagination: pagination(totalCount, page, limit) };
}
