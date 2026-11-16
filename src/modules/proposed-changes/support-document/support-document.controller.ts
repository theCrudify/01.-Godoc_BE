import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./support-document.service";

const errorDetails = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

/** Kirim HttpError apa adanya; true jika sudah ditangani. */
const sendHttpError = (res: Response, error: unknown): boolean => {
  if (!(error instanceof HttpError)) return false;
  res.status(error.status).json(error.body);
  return true;
};

export const createMany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, body } = await service.createMany(req.body);
    res.status(status).json(body);
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ General ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: errorDetails(error) });
  }
};

export const updateStatuses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, body } = await service.updateStatuses(req.params.proposed_id as string, req.body);
    res.status(status).json(body);
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ General ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: errorDetails(error) });
  }
};

export const listByProposedId = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listByProposedId(req.params.id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error fetching approval history by proposed_id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateTitle = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.updateTitle(req.params.id as string, req.body));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error(`Error updating title for document ID ${req.params.id}:`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createNote = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json(await service.createNote(req.body));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error creating support doc note:", error);
    res.status(500).json({ error: "Internal Server Error", details: errorDetails(error) });
  }
};

export const listNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listNotes(req.params.support_doc_id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error fetching support document notes:", error);
    res.status(500).json({ error: "Internal Server Error", details: errorDetails(error) });
  }
};

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  const { support_doc_id, created_by, updated_by } = req.body;

  try {
    res.status(201).json(await service.uploadFile({ support_doc_id, created_by, updated_by }, req.file));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const listFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listFiles(req.params.support_doc_id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error fetching files:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getFile = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getFile(req.params.id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error fetching file:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const viewFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filePath, mimeType } = await service.getFileForView(req.params.id as string);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.sendFile(filePath);
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error retrieving file:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const downloadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filePath, fileName } = await service.getFileForDownload(Number(req.params.id));
    res.download(filePath, fileName);
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error downloading file:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const downloadWithWatermark = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await service.getWatermarkedFile(Number(req.params.id));
    if (result.kind === "image") {
      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename=${result.fileName}`);
    }
    res.send(result.buffer);
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error applying watermark:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
