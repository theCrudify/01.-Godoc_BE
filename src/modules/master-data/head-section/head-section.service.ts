import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./head-section.repository";

const validSortColumns = ["id", "id_authorization", "id_section_department", "status", "created_by"];

function pageParams(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";
  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };
  return { page, limit, orderBy };
}

const searchConditions = (searchTerm: string) => [
  { created_by: { contains: searchTerm, mode: "insensitive" } },
  { authorization: { employee_code: { contains: searchTerm, mode: "insensitive" } } },
  { authorization: { employee_name: { contains: searchTerm, mode: "insensitive" } } },
  { section: { section_name: { contains: searchTerm, mode: "insensitive" } } },
  { section: { department: { department_name: { contains: searchTerm, mode: "insensitive" } } } },
];

async function findPage(query: any, where: any) {
  const { page, limit, orderBy } = pageParams(query);
  if (query.status !== undefined) where.authorization = { status: query.status === "true" };

  const [heads, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: heads.map((head) => ({
      id: head.id,
      id_authorization: head.authorization?.id ?? null,
      employee_code: head.authorization?.employee_code ?? null,
      employee_name: head.authorization?.employee_name ?? null,
      authorization_status: head.authorization?.status ?? null,
      id_section_department: head.section?.id ?? null,
      department_id: head.section?.department_id ?? null,
      department_name: head.section?.department?.department_name ?? null,
      section_name: head.section?.section_name ?? null,
      created_by: head.created_by,
      is_deleted: head.is_deleted,
    })),
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function list(query: any) {
  const searchTerm = (query.search as string) || "";
  const where: any = { is_deleted: false, AND: [] };
  if (searchTerm) where.OR = searchConditions(searchTerm);
  return findPage(query, where);
}

/** GET /headSection/:id — query paging/sort/status tetap dipakai, pencarian hanya berdasarkan :id. */
export async function getById(query: any, idSearchTerm: string) {
  if (!idSearchTerm) throw new HttpError(400, { error: "ID is required for search" });
  return findPage(query, { is_deleted: false, id: Number(idSearchTerm) || 0 });
}

export async function create(body: any) {
  const { authorization_id, section_id, created_by } = body;

  if (!(await repo.findAuthorizationById(authorization_id))) {
    throw new HttpError(404, { error: `Authorization dengan ID ${authorization_id} tidak ditemukan.` });
  }
  if (!(await repo.findSectionById(section_id))) {
    throw new HttpError(404, { error: `Section dengan ID ${section_id} tidak ditemukan.` });
  }

  const existing = await repo.findByAuthorizationAndSection(authorization_id, section_id);
  if (existing) {
    if (existing.is_deleted) {
      return { restored: true, data: await repo.update(existing.id, { is_deleted: false, created_by }) };
    }
    throw new HttpError(400, {
      error: `Section Head dengan authorization ID ${authorization_id} dan section ID ${section_id} sudah ada.`,
    });
  }

  return { restored: false, data: await repo.create({ authorization_id, section_id, created_by, is_deleted: false }) };
}

function parseId(rawId: string) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  return id;
}

export async function remove(rawId: string) {
  const id = parseId(rawId);
  if (!(await repo.findById(id))) throw new HttpError(404, { error: "Section Head not found" });
  await repo.update(id, { is_deleted: true });
}

export async function update(rawId: string, body: any) {
  const id = parseId(rawId);
  const { authorization_id, section_id, created_by, is_deleted } = body;
  if (!(await repo.findById(id))) throw new HttpError(404, { error: "Section Head not found" });

  const updateData: any = {};
  if (authorization_id) updateData.authorization_id = authorization_id;
  if (section_id) {
    if (await repo.findOtherActiveBySection(section_id, id)) {
      throw new HttpError(400, { error: `Section ID ${section_id} sudah digunakan oleh Section Head lain.` });
    }
    updateData.section_id = section_id;
  }
  if (created_by) updateData.created_by = created_by;
  if (is_deleted !== undefined) updateData.is_deleted = is_deleted;

  if (Object.keys(updateData).length === 0) throw new HttpError(400, { error: "Tidak ada data yang diperbarui." });

  return repo.update(id, updateData);
}
