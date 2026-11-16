import fs from "fs";
import path from "path";
import sharp from "sharp";
import mime from "mime-types";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { HttpError } from "../../../shared/utils/http-error";
import * as repo from "./support-document.repository";

const uploadsDir = path.join(process.cwd(), "src", "uploads");

// Validasi array per-index dengan format pesan khusus tetap di service (bukan zod).

/** POST /proposedchanges-support → { status: 201 | 207, body } */
export async function createMany(dataList: any) {
  if (!Array.isArray(dataList) || dataList.length === 0) {
    throw new HttpError(400, { error: "Input must be a non-empty array of documents" });
  }

  const validationErrors: string[] = [];
  const validData = dataList.filter((data, index) => {
    if (!data.created_by) {
      validationErrors.push(`Missing 'created_by' at index ${index}`);
      return false;
    }
    if (typeof data.support_doc_id !== "number") {
      validationErrors.push(`Invalid or missing 'support_doc_id' at index ${index}`);
      return false;
    }
    if (typeof data.proposed_id !== "number") {
      validationErrors.push(`Invalid or missing 'proposed_id' at index ${index}`);
      return false;
    }
    if (typeof data.document_type !== "string") {
      validationErrors.push(`Invalid or missing 'document_type' at index ${index}`);
      return false;
    }
    return true;
  });

  if (validationErrors.length > 0) {
    throw new HttpError(400, { error: "Validation Error", details: validationErrors });
  }

  const successes: any[] = [];
  const failures: { index: number; error: string }[] = [];

  for (let i = 0; i < validData.length; i++) {
    const data = validData[i];
    try {
      successes.push(await repo.create({
        support_doc_id: data.support_doc_id,
        proposed_id: data.proposed_id,
        document_type: data.document_type,
        status: data.status ?? false,
        created_by: data.created_by,
        created_date: data.created_date ? new Date(data.created_date) : new Date(),
        updated_by: data.updated_by,
        is_deleted: data.is_deleted ?? false,
      }));
    } catch (err) {
      console.error(`❌ Failed to insert at index ${i}`, err);
      failures.push({ index: i, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  if (failures.length === 0) {
    return { status: 201, body: { message: `${successes.length} support documents created successfully`, data: successes } };
  }
  return { status: 207, body: { message: `${successes.length} documents inserted, ${failures.length} failed`, successes, failures } };
}

/** PUT /supportdocuments/:proposed_id/status → { status: 200 | 207, body } */
export async function updateStatuses(proposed_id: string, dataList: any) {
  if (!proposed_id || isNaN(Number(proposed_id))) {
    throw new HttpError(400, { error: "Validation Error", details: "Invalid proposed_id parameter" });
  }
  if (!Array.isArray(dataList) || dataList.length === 0) {
    throw new HttpError(400, { error: "Input must be a non-empty array of documents" });
  }

  const existingProposed = await repo.findProposedChangeById(Number(proposed_id));
  if (!existingProposed) {
    throw new HttpError(404, { error: "Not Found", details: `Proposed change with ID ${proposed_id} not found` });
  }

  const validationErrors: string[] = [];
  const validData = dataList.filter((data, index) => {
    if (!data.id) {
      validationErrors.push(`Missing 'id' at index ${index}`);
      return false;
    }
    if (typeof data.id !== "number") {
      validationErrors.push(`Invalid 'id' at index ${index}`);
      return false;
    }
    if (data.status === undefined) {
      validationErrors.push(`Missing 'status' at index ${index}`);
      return false;
    }
    if (typeof data.status !== "boolean") {
      validationErrors.push(`'status' must be a boolean at index ${index}`);
      return false;
    }
    if (!data.updated_by) {
      validationErrors.push(`Missing 'updated_by' at index ${index}`);
      return false;
    }
    return true;
  });

  if (validationErrors.length > 0) {
    throw new HttpError(400, { error: "Validation Error", details: validationErrors });
  }

  const successes: any[] = [];
  const failures: { id: number; error: string }[] = [];

  for (const data of validData) {
    try {
      successes.push(await repo.updateStatus(Number(data.id), Number(proposed_id), {
        status: data.status,
        updated_by: data.updated_by,
        updated_at: new Date(),
      }));
    } catch (err) {
      console.error(`❌ Failed to update status for document ID ${data.id}`, err);
      failures.push({ id: data.id, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  if (failures.length === 0) {
    return { status: 200, body: { message: `${successes.length} support documents status updated successfully`, data: successes } };
  }
  return { status: 207, body: { message: `${successes.length} documents updated, ${failures.length} failed`, successes, failures } };
}

/** GET /supportproposed/:id */
export async function listByProposedId(rawId: string) {
  const proposedChangesId = Number(rawId);
  if (isNaN(proposedChangesId)) throw new HttpError(400, { error: "Invalid proposed_id" });

  const documents = await repo.findByProposedId(proposedChangesId);
  if (documents.length === 0) {
    throw new HttpError(404, { message: `No approval history found for proposed_id ${proposedChangesId}` });
  }
  return { data: documents };
}

/** PUT /supportproposed/:id — judul diambil dari body[0].title. */
export async function updateTitle(id: string, bodyArray: any) {
  if (!id) {
    console.warn("Update title failed: ID is missing");
    throw new HttpError(400, { error: "ID is required" });
  }
  if (!Array.isArray(bodyArray) || bodyArray.length === 0) {
    console.warn(`Update title failed: Body is not a valid array. Body: ${JSON.stringify(bodyArray)}`);
    throw new HttpError(400, { error: "Request body must be a non-empty array" });
  }

  const { title } = bodyArray[0];
  if (!title) {
    console.warn("Update title failed: Title is missing in body[0]");
    throw new HttpError(400, { error: "Title is required" });
  }

  const existingDocument = await repo.findById(Number(id));
  if (!existingDocument || existingDocument.is_deleted) {
    console.warn(`Update title failed: Document with ID ${id} not found or deleted`);
    throw new HttpError(404, { error: "Support Document not found" });
  }

  const updatedDocument = await repo.updateTitle(Number(id), title);
  return { message: "Support Document title updated successfully", data: updatedDocument };
}

// ==================== Note ====================

/** POST /supportproposednoted/ */
export async function createNote(data: any) {
  // format pesan khusus ("Missing fields: ..."), dan harus dicek setelah requireDocAccess
  const missingFields = ["support_doc_id", "noted", "created_by"].filter((field) => !data[field]);
  if (missingFields.length > 0) {
    console.warn("Validation Error: Missing fields -", missingFields);
    throw new HttpError(400, { error: "Validation Error", details: `Missing fields: ${missingFields.join(", ")}` });
  }

  const supportDocId = Number(data.support_doc_id);
  const [supportDoc, lastNote] = await Promise.all([repo.findById(supportDocId), repo.findLastNote(supportDocId)]);
  if (!supportDoc || supportDoc.is_deleted) {
    console.warn(`Document not found or deleted: ID ${supportDocId}`);
    throw new HttpError(404, { error: "Not Found", details: "Support document not found or already deleted." });
  }

  const newVersion = lastNote ? lastNote.version + 1 : 1;
  const newNote = await repo.createNote({
    support_doc_id: supportDocId,
    version: newVersion,
    noted: data.noted,
    created_by: data.created_by,
    updated_by: data.updated_by ?? data.created_by,
    created_date: new Date(),
  });

  return { message: "Note created successfully", data: newNote };
}

/** GET /support-docs-noted/:support_doc_id/notes/ */
export async function listNotes(support_doc_id: string) {
  if (!support_doc_id || isNaN(Number(support_doc_id))) {
    console.warn("Invalid or missing support_doc_id:", support_doc_id);
    throw new HttpError(400, { error: "Validation Error", details: "Valid support_doc_id is required in URL params" });
  }

  const docId = Number(support_doc_id);
  const [supportDoc, notes] = await Promise.all([repo.findById(docId), repo.findNotes(docId)]);
  if (!supportDoc || supportDoc.is_deleted) {
    console.warn(`Support document not found or deleted: ID ${docId}`);
    throw new HttpError(404, { error: "Not Found", details: "Support document not found or already deleted." });
  }

  return { message: "Notes fetched successfully", data: notes };
}

// ==================== File ====================

/** POST /uploadsupport/ — versi file = versi terakhir + 1. */
export async function uploadFile(body: { support_doc_id: any; created_by: any; updated_by: any }, file?: Express.Multer.File) {
  const { support_doc_id, created_by, updated_by } = body;
  if (!support_doc_id || !file) {
    console.warn("Create file failed: Missing support_doc_id or file");
    throw new HttpError(400, { message: "support_doc_id and file are required" });
  }

  const [supportDoc, lastVersion] = await Promise.all([
    repo.findById(Number(support_doc_id)),
    repo.findLastFileVersion(Number(support_doc_id)),
  ]);
  if (!supportDoc || supportDoc.is_deleted) {
    console.warn(`Document with ID ${support_doc_id} not found or deleted`);
    throw new HttpError(404, { message: "Support document not found" });
  }

  const newVersion = lastVersion ? lastVersion.version + 1 : 1;
  const newFile = await repo.createFile({
    support_doc_id: Number(support_doc_id),
    version: newVersion,
    file: file.filename,
    created_by,
    updated_by,
    created_date: new Date(),
  });

  return { message: "File uploaded successfully", data: newFile };
}

/** GET /uploadsupport/:support_doc_id */
export async function listFiles(support_doc_id: string) {
  if (!support_doc_id) throw new HttpError(400, { message: "support_doc_id is required" });

  const files = await repo.findFilesBySupportDocId(Number(support_doc_id));
  if (!files || files.length === 0) throw new HttpError(404, { message: "No files found for this support_doc_id" });

  return { message: "Files fetched successfully", data: files };
}

/** GET /uploadsupport/file/:id */
export async function getFile(id: string) {
  if (!id) throw new HttpError(400, { message: "File ID is required" });

  const fileData = await repo.findFileById(Number(id));
  if (!fileData || fileData.is_deleted) throw new HttpError(404, { message: "File not found" });

  return { message: "File fetched successfully", data: fileData };
}

/** Path file di storage untuk view (inline). */
export async function getFileForView(rawId: string) {
  const id = Number(rawId);
  if (isNaN(id)) throw new HttpError(400, { message: "Invalid file ID" });

  const file = await repo.findFileById(id);
  if (!file || file.is_deleted || !file.file) throw new HttpError(404, { message: "File not found" });

  const filePath = path.join(uploadsDir, file.file);
  if (!fs.existsSync(filePath)) throw new HttpError(404, { message: "File not found in storage" });

  return { filePath, mimeType: mime.lookup(filePath) || "application/octet-stream" };
}

async function findStoredFile(id: number) {
  const file = await repo.findFileById(id);
  if (!file || file.is_deleted) throw new HttpError(404, { message: "File not found" });
  return { file, filePath: path.join(uploadsDir, file.file ?? "") };
}

/** Path + nama file untuk download. */
export async function getFileForDownload(id: number) {
  const { file, filePath } = await findStoredFile(id);
  if (!fs.existsSync(filePath)) throw new HttpError(404, { message: "File not found in storage" });
  return { filePath, fileName: file.file ?? "downloaded_file" };
}

/** File dengan watermark "GODoc Confidential" (PDF atau gambar). */
export async function getWatermarkedFile(id: number): Promise<
  | { kind: "pdf"; buffer: Buffer }
  | { kind: "image"; buffer: Buffer; contentType: string; fileName: string | null }
> {
  const { file, filePath } = await findStoredFile(id);
  const ext = path.extname(file.file ?? "").toLowerCase();
  if (!fs.existsSync(filePath)) throw new HttpError(404, { message: "File not found in storage" });

  if (ext === ".pdf") {
    const pdfDoc = await PDFDocument.load(await fs.promises.readFile(filePath));
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize();
      page.drawText("GODoc Confidential", {
        x: width - 220,
        y: height - 50,
        size: 20,
        font: helveticaFont,
        color: rgb(0.95, 0.1, 0.1),
        opacity: 0.4,
      });
    }
    return { kind: "pdf", buffer: Buffer.from(await pdfDoc.save()) };
  }

  if ([".jpg", ".jpeg", ".png"].includes(ext)) {
    const imageBuffer = await fs.promises.readFile(filePath);
    const watermarked = await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(
            `<svg width="200" height="50">
                <text x="0" y="35" font-size="30" fill="red" opacity="0.4">GODoc Confidential</text>
              </svg>`
          ),
          gravity: "northeast",
        },
      ])
      .toBuffer();
    return { kind: "image", buffer: watermarked, contentType: `image/${ext.replace(".", "")}`, fileName: file.file };
  }

  throw new HttpError(415, { message: "Watermark not supported for this file type" });
}
