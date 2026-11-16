import mime from "mime-types";
import path from "path";
import fs from "fs";
import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./additional-doc.repository";

// Validasi input tetap di sini: setiap endpoint punya body 400 khusus yang tidak sama dengan format validate().

const uploadsDir = path.join(process.cwd(), "src", "uploads");

// ===== Additional DOC metadata =====

function getDevelopmentDescription(code: string): string {
  const developmentMap: { [key: string]: string } = {
    PSD: "Process Development",
    PJD: "Project Development",
  };
  return developmentMap[code] || "";
}

export async function getProposedChangeById(id: string) {
  const numericId = Number(id);
  if (!id || isNaN(numericId)) throw new HttpError(400, { error: "Invalid ID provided" });

  const [proposedChange, authorizationDoc] = await Promise.all([
    repo.findProposedChangeDetail(numericId),
    repo.findAuthorizationDocIdByProposedChange(numericId),
  ]);

  if (!proposedChange) throw new HttpError(404, { error: "Proposed Change not found or has been deleted" });

  const authorization_doc_id = authorizationDoc?.id || "not yet";

  return {
    id: proposedChange.id,
    project_name: proposedChange.project_name,
    document_number: proposedChange.documentNumber?.running_number || "",
    item_changes: proposedChange.item_changes,
    line: `Line ${proposedChange.line_code}`,
    section: proposedChange.documentNumber?.area?.area || "",
    department: proposedChange.department?.department_name || "",
    section_department: proposedChange.section_department?.id?.toString() || "",
    change_type: proposedChange.change_type,
    description: proposedChange.description,
    reason: proposedChange.reason,
    cost: proposedChange.cost_text?.replace(/\*\*/g, "").replace(/\n/g, " ") || "",
    planning_start: proposedChange.planning_start,
    planning_end: proposedChange.planning_end,
    plant: proposedChange.plant?.plant_name || "",
    created_date: proposedChange.created_date,
    created_by: proposedChange.created_by,
    updated_at: proposedChange.updated_at,
    need_engineering_approval: proposedChange.need_engineering_approval ? 1 : 0,
    need_production_approval: proposedChange.need_production_approval ? 1 : 0,
    other_sytem: proposedChange.other_sytem,
    status: proposedChange.status,
    progress: proposedChange.progress,
    area: `Line ${proposedChange.line_code} - ${proposedChange.documentNumber?.area?.area || ""}`,
    code_line: proposedChange.line_code,
    running_number: proposedChange.documentNumber?.running_number || "",
    document_category: proposedChange.documentNumber?.category?.category || "",
    klasifikasi_document: proposedChange.documentNumber?.klasifikasi_document || "",
    line_code: proposedChange.line_code,
    section_code: proposedChange.section_code,
    department_code: proposedChange.department?.department_code || "",
    development_code: proposedChange.documentNumber?.development_code || "",
    id_proposed_header: proposedChange.documentNumber?.id_proposed_header || null,
    sub_document: proposedChange.documentNumber?.sub_document || "",
    code_sub: proposedChange.documentNumber?.klasifikasi_document || "",
    is_internal_memo: proposedChange.documentNumber?.is_internal_memo || null,
    is_surat_ketentuan: proposedChange.documentNumber?.is_surat_ketentuan || null,
    id_document_number: proposedChange.document_number_id,
    development_desc: getDevelopmentDescription(proposedChange.documentNumber?.development_code || ""),
    authorization_doc_id,
    id_usulan_perubahan: 1,

    category_id: proposedChange.documentNumber?.category?.id || null,
    plant_id: proposedChange.plant?.id || null,
    area_id: proposedChange.documentNumber?.area?.id || null,
    section_id: proposedChange.section_department?.id || null,
    auth_id: proposedChange.auth_id || null,
  };
}

export async function insertDocumentNumber(body: any) {
  const data = body.form_data || {};

  const requiredFields = ["klasifikasi_document", "plant_id"];
  const missingFields = requiredFields.filter((field) => !data[field]);
  if (missingFields.length > 0) {
    throw new HttpError(400, { error: "Validation Error", details: `Missing fields: ${missingFields.join(", ")}` });
  }

  const is_internal_memo = data.is_internal_memo === true;
  const is_surat_ketentuan = data.is_surat_ketentuan === true;

  const newDocumentNumber = await repo.createAdditionalDoc({
    running_number: data.running_number,
    klasifikasi_document: data.klasifikasi_document,
    category_id: data.category_id ? parseInt(data.category_id) : undefined,
    plant_id: parseInt(data.plant_id),
    area_id: data.area_id ? parseInt(data.area_id) : undefined,
    section_id: data.section_id ? parseInt(data.section_id) : undefined,
    auth_id: data.auth_id ? parseInt(data.auth_id) : undefined,
    proposed_change_id: data.proposed_change_id,
    line_code: data.line_code,
    section_code: data.section_code,
    department_code: data.department_code,
    development_code: data.development_code,
    id_proposed_header: data.id_proposed_header,
    sub_document: data.sub_document,
    is_internal_memo,
    is_surat_ketentuan,
    created_by: data.created_by,
    created_date: data.created_date ? new Date(data.created_date) : new Date(),
  });

  console.log("===> [insertDocumentNumber] Document number berhasil dibuat dengan ID:", newDocumentNumber.id);
  return newDocumentNumber;
}

/** Hasil update: `updated=false` berarti tidak ada field yang dikirim (response "No data to update"). */
export async function updateDocumentNumber(id: string, body: any) {
  const data = body.form_data || {};

  const existing = await repo.findDocumentNumberById(parseInt(id));
  if (!existing) {
    console.log(`❌ [updateDocumentNumber] Document number dengan ID ${id} tidak ditemukan`);
    throw new HttpError(404, { error: "Not Found", details: `Document number with ID ${id} not found` });
  }

  // Hanya sertakan field yang dikirim
  const updateData: any = {};
  if (data.running_number !== undefined) updateData.running_number = data.running_number;
  if (data.klasifikasi_document !== undefined) updateData.klasifikasi_document = data.klasifikasi_document;
  if (data.category_id !== undefined) updateData.category_id = data.category_id ? parseInt(data.category_id) : null;
  if (data.plant_id !== undefined) updateData.plant_id = parseInt(data.plant_id);
  if (data.area_id !== undefined) updateData.area_id = data.area_id ? parseInt(data.area_id) : null;
  if (data.section_id !== undefined) updateData.section_id = data.section_id ? parseInt(data.section_id) : null;
  if (data.auth_id !== undefined) updateData.auth_id = data.auth_id ? parseInt(data.auth_id) : null;
  if (data.line_code !== undefined) updateData.line_code = data.line_code;
  if (data.section_code !== undefined) updateData.section_code = data.section_code;
  if (data.department_code !== undefined) updateData.department_code = data.department_code;
  if (data.development_code !== undefined) updateData.development_code = data.development_code;
  if (data.id_proposed_header !== undefined) updateData.id_proposed_header = data.id_proposed_header;
  if (data.sub_document !== undefined) updateData.sub_document = data.sub_document;
  if (data.is_internal_memo !== undefined) updateData.is_internal_memo = data.is_internal_memo === true;
  if (data.is_surat_ketentuan !== undefined) updateData.is_surat_ketentuan = data.is_surat_ketentuan === true;

  if (Object.keys(updateData).length === 0) return { updated: false, data: existing };

  const updatedDocumentNumber = await repo.updateDocumentNumber(parseInt(id), updateData);
  console.log(`===> [updateDocumentNumber] Document number berhasil diupdate dengan ID: ${updatedDocumentNumber.id}`);
  return { updated: true, data: updatedDocumentNumber };
}

export async function searchByProposedChangeId(proposed_change_id: any) {
  if (!proposed_change_id) {
    throw new HttpError(400, { status: false, message: "Validation Error", details: "proposed_change_id is required" });
  }

  const proposedChangeIdInt = parseInt(proposed_change_id as string, 10);
  if (isNaN(proposedChangeIdInt)) {
    throw new HttpError(400, { status: false, message: "Validation Error", details: "proposed_change_id must be a valid number" });
  }

  const documents = await repo.findAdditionalDocsByProposedChange(proposedChangeIdInt);
  if (documents.length === 0) return documents;

  // Lampirkan hanya file versi terbaru per dokumen
  return Promise.all(
    documents.map(async (doc) => {
      const latestFile = await repo.findLatestActiveFile(doc.id);
      return { ...doc, file: latestFile || null };
    }),
  );
}

// ===== File operations =====

export async function getFilesByDocId(tr_additional_doc_id: any) {
  if (!tr_additional_doc_id) {
    throw new HttpError(400, { status: false, message: "tr_additional_doc_id is required" });
  }
  const docId = parseInt(tr_additional_doc_id as string, 10);
  if (isNaN(docId)) {
    throw new HttpError(400, { status: false, message: "tr_additional_doc_id must be a valid number" });
  }
  return repo.findActiveFilesByDoc(docId);
}

export async function uploadFile(body: any, file: Express.Multer.File | undefined) {
  const { tr_additional_doc_id, created_by } = body;

  if (!tr_additional_doc_id || !file) {
    throw new HttpError(400, { status: false, message: "tr_additional_doc_id and file are required" });
  }

  const docId = parseInt(tr_additional_doc_id, 10);
  if (isNaN(docId)) {
    throw new HttpError(400, { status: false, message: "tr_additional_doc_id must be a valid number" });
  }

  if (!(await repo.findAdditionalDocById(docId))) {
    throw new HttpError(404, { status: false, message: "Document not found" });
  }

  const latestVersion = await repo.findLatestFileVersion(docId);
  const newVersion = latestVersion ? latestVersion.version + 1 : 1;
  const detectedMimetype = mime.lookup(file.originalname) || "application/octet-stream";

  const fileExtension = path.extname(file.originalname);
  const newFileName = `document-${docId}-${Date.now()}${fileExtension}`;
  fs.renameSync(file.path, path.join(file.destination, newFileName));

  return repo.createFile({
    tr_additional_doc_id: docId,
    version: newVersion,
    file: newFileName, // simpan nama file saja
    mimetype: detectedMimetype,
    created_by,
    created_date: new Date(),
  });
}

/** Cari file aktif di DB + pastikan file fisiknya ada. Dipakai download & view. */
export async function resolveFile(fileId: string) {
  if (!fileId) throw new HttpError(400, { status: false, message: "File ID is required" });

  const id = parseInt(fileId, 10);
  if (isNaN(id)) throw new HttpError(400, { status: false, message: "File ID must be a valid number" });

  const fileInfo = await repo.findActiveFileById(id);
  if (!fileInfo || !fileInfo.file) throw new HttpError(404, { status: false, message: "File not found" });

  const filePath = path.join(uploadsDir, fileInfo.file);
  if (!fs.existsSync(filePath)) throw new HttpError(404, { status: false, message: "File not found on server" });

  return {
    filePath,
    fileName: fileInfo.file,
    // Content-Type dari ekstensi file di server, bukan dari mimetype kiriman client saat upload
    contentType: mime.lookup(fileInfo.file) || "application/octet-stream",
  };
}

export async function deleteFile(fileId: string) {
  if (!fileId) throw new HttpError(400, { status: false, message: "File ID is required" });

  const id = parseInt(fileId, 10);
  if (isNaN(id)) throw new HttpError(400, { status: false, message: "File ID must be a valid number" });

  if (!(await repo.findActiveFileFirst(id))) {
    throw new HttpError(404, { status: false, message: "File not found or already deleted" });
  }
  await repo.softDeleteFile(id);
}

export async function updateProgressSupport(rawId: string, body: any) {
  const id = Number(rawId);
  const { progresssupport } = body;

  if (isNaN(id)) throw new HttpError(400, { status: false, error: "Invalid ID format" });
  if (typeof progresssupport !== "string") {
    throw new HttpError(400, { status: false, error: "progresssupport must be a string" });
  }

  return repo.updateProgressSupport(id, progresssupport);
}
