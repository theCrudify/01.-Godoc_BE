import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./sub-document.repository";

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const validSortColumns = ["id", "desc", "code"];
  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };

  const where: any = { AND: [] };
  if (searchTerm) {
    where.OR = [
      { desc: { contains: searchTerm.toLowerCase() } },
      { code: { contains: searchTerm.toLowerCase() } },
    ];
  }

  const [subdocuments, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: subdocuments,
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(rawId: string) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  const subdocument = await repo.findById(id);
  if (!subdocument) throw new HttpError(404, { error: "Subdocument not found" });
  return subdocument;
}

export const create = (body: any) => repo.create({ desc: body.desc, code: body.code });

export async function update(id: string, body: any) {
  if (!id) throw new HttpError(400, { error: "ID is required" });
  if (!(await repo.findById(Number(id)))) throw new HttpError(404, { error: "SubDocument not found" });
  return repo.update(Number(id), { desc: body.desc, code: body.code });
}

export async function remove(rawId: string) {
  await repo.deleteById(Number(rawId));
}
