import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./doc-type.repository";

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const status = query.status === "true";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const validSortColumns = ["id", "document_type", "document_code", "status", "updated_at", "updated_by"];
  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };

  const where: any = { is_deleted: false, AND: [] };
  if (searchTerm) {
    where.OR = [
      { document_type: { contains: searchTerm.toLowerCase() } },
      { document_code: { contains: searchTerm.toLowerCase() } },
      { updated_by: { contains: searchTerm.toLowerCase() } },
    ];
  }
  if (query.status !== undefined) where.status = status;

  const [developments, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: developments,
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  const development = await repo.findActiveById(id);
  if (!development) throw new HttpError(404, { error: "Document type not found" });
  return development;
}

// document_code selalu kapital (tanpa cek wajib: kode kosong → 500 seperti sebelumnya)
export const create = (body: any) =>
  repo.create({
    document_type: body.document_type,
    document_code: body.document_code.toUpperCase(),
    status: body.status,
    updated_by: body.updated_by,
  });

export const update = (rawId: string, body: any) =>
  repo.update(Number(rawId), {
    document_type: body.document_type,
    document_code: body.document_code.toUpperCase(),
    status: body.status,
    updated_by: body.updated_by,
    updated_at: new Date(),
  });

export async function remove(rawId: string) {
  await repo.update(Number(rawId), { is_deleted: true });
}
