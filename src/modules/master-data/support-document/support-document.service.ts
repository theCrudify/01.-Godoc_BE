import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./support-document.repository";

/** Sisa validasi lama (document_type wajib sudah dicek DTO). */
function validateDocumentData(data: any): string[] {
  const errors: string[] = [];
  if (data.document_type && data.document_type.length > 255) {
    errors.push("Document type cannot exceed 255 characters.");
  }
  if (data.status !== undefined && typeof data.status !== "boolean") {
    errors.push("Status must be a boolean.");
  }
  return errors;
}

export async function list(query: any) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = (query.search as string) || "";
  const status = query.status === "true";
  const sortColumn = (query.sort as string) || "id";
  const sortDirection = query.direction === "desc" ? "desc" : "asc";

  const validSortColumns = ["id", "document_type", "status", "updated_at", "updated_by"];
  const orderBy: any = validSortColumns.includes(sortColumn) ? { [sortColumn]: sortDirection } : { id: "asc" };

  const where: any = { is_deleted: 0, AND: [] };
  if (searchTerm) {
    where.OR = [
      { document_type: { contains: searchTerm.toLowerCase() } },
      { updated_by: { contains: searchTerm.toLowerCase() } },
    ];
  }
  if (query.status !== undefined) where.status = status;

  const [documents, totalCount] = await repo.findPage(where, (page - 1) * limit, limit, orderBy);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: documents,
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export const listInstant = () => repo.findAllActive();

export async function getById(rawId: string) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { error: "Invalid ID" });
  const document = await repo.findActiveById(id);
  if (!document) throw new HttpError(404, { error: "Document not found" });
  return document;
}

export async function create(body: any) {
  const errors = validateDocumentData(body);
  if (errors.length > 0) throw new HttpError(400, { errors });
  if (await repo.findByDocumentType(body.document_type)) throw new HttpError(409, { error: "Duplicate document type" });
  return repo.create({ document_type: body.document_type, status: body.status });
}

export async function update(rawId: string, body: any) {
  const id = Number(rawId);
  const errors = validateDocumentData(body);
  if (errors.length > 0) throw new HttpError(400, { errors });
  return repo.update(id, {
    document_type: body.document_type,
    status: body.status,
    updated_by: body.updated_by,
    updated_at: new Date(),
  });
}

export async function remove(rawId: string) {
  await repo.update(Number(rawId), { is_deleted: 1 });
}
