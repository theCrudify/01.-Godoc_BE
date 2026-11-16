import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./document-number.repository";
import { CreateDocumentNumberDto, ListDocumentNumbersQuery } from "./document-number.dto";

export async function list(query: ListDocumentNumbersQuery) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const searchTerm = query.search || "";

  const where: any = {
    klasifikasi_document: "UP",
    // nomor yang sudah dipakai proposed change tidak ditampilkan
    proposedChanges: { none: {} },
  };
  if (query.auth_id) where.authorization = { id: Number(query.auth_id) };
  if (searchTerm) {
    where.OR = ["running_number", "klasifikasi_document", "line_code", "section_code", "department_code", "development_code", "created_by"]
      .map((field) => ({ [field]: { contains: searchTerm } }));
  }

  const [data, totalCount] = await repo.findPage(where, (page - 1) * limit, limit);
  const totalPages = Math.ceil(totalCount / limit);
  return {
    data,
    pagination: { totalCount, totalPages, currentPage: page, limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
}

export async function getById(id: number) {
  const document = await repo.findByIdWithRelations(id);
  if (!document) throw new HttpError(404, { error: "Document not found" });
  return {
    ...document,
    area: document.area ? { ...document.area, line: document.area.line } : null,
    category: document.category ? { id: document.category.id, category: document.category.category } : null,
  };
}

/** Nomor urut global = bagian pertama running number terakhir + 1. */
function nextGlobalSequence(lastRunningNumber?: string | null): number {
  const last = parseInt(lastRunningNumber?.split("/")[0] ?? "");
  return isNaN(last) ? 1 : last + 1;
}

/** Nomor urut per section = angka setelah "-" di bagian ketiga running number terakhir + 1. */
function nextSectionSequence(lastRunningNumber?: string | null): number {
  const sectionPart = lastRunningNumber?.split("/")[2]?.split("-");
  const last = sectionPart && sectionPart.length > 1 ? parseInt(sectionPart[1]) : NaN;
  return isNaN(last) ? 1 : last + 1;
}

export async function create(data: CreateDocumentNumberDto) {
  const klasifikasi = data.klasifikasi_document === "Usulan Perubahan (UP)" ? "UP" : data.klasifikasi_document;

  const [lastGlobal, lastInSection] = await Promise.all([
    repo.findLastRunningNumber(),
    repo.findLastRunningNumberInSection({
      line_code: data.line_code,
      section_code: data.section_code,
      plant_id: data.plant_id,
      area_id: data.area_id,
    }),
  ]);

  const sequence = String(nextGlobalSequence(lastGlobal?.running_number)).padStart(2, "0");
  const sectionSequence = String(nextSectionSequence(lastInSection?.running_number)).padStart(2, "0");
  const year = new Date(data.created_date || Date.now()).getFullYear().toString().slice(-2);
  const runningNumber = `${sequence}/${data.line_code}/${data.section_code}-${sectionSequence}/${klasifikasi}/${data.department_code}/${data.development_code}/${year}`;

  const created = await repo.create({
    running_number: runningNumber,
    category_id: data.category_id,
    klasifikasi_document: klasifikasi,
    line_code: data.line_code,
    section_code: data.section_code,
    department_code: data.department_code,
    development_code: data.development_code,
    id_proposed_header: data.id_proposed_header,
    sub_document: data.sub_document,
    section_id: data.section_id,
    plant_id: data.plant_id,
    is_internal_memo: data.is_internal_memo,
    is_surat_ketentuan: data.is_surat_ketentuan,
    created_by: data.created_by,
    created_date: data.created_date ? new Date(data.created_date) : new Date(),
    area_id: data.area_id,
    auth_id: data.auth_id,
  });
  console.log(`✅ SUCCESS: Document number ${runningNumber} created!`);
  return created;
}

export async function remove(id: number) {
  if (!(await repo.findById(id))) throw new HttpError(404, { error: "Document not found" });
  await repo.deleteById(id);
}
