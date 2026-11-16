import fs from "fs";
import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./additional-doc.service";

const sendHttpError = (res: Response, error: unknown): boolean => {
  if (!(error instanceof HttpError)) return false;
  res.status(error.status).json(error.body);
  return true;
};

const fileErrorBody = (error: unknown) => ({
  status: false,
  message: error instanceof Error ? error.message : "Unknown error",
});

export const SupergetProposedChangeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const transformedData = await service.getProposedChangeById(req.params.id as string);
    res.status(200).json({ status: true, data: [transformedData] });
  } catch (error: any) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error in getProposedChangeById:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const insertDocumentNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.insertDocumentNumber(req.body);
    res.status(201).json({ message: "Document number created successfully", data });
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error creating document number:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateDocumentNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await service.updateDocumentNumber(req.params.id as string, req.body);
    res.status(200).json({
      message: result.updated ? "Document number updated successfully" : "No data to update",
      data: result.data,
    });
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error(`❌ Error updating document number:`, error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const searchByProposedChangeId = async (req: Request, res: Response): Promise<void> => {
  try {
    const documents = await service.searchByProposedChangeId(req.query.proposed_change_id);
    if (documents.length === 0) {
      res.status(200).json({
        status: true,
        message: "No documents found with the provided proposed_change_id",
        data: [],
        count: 0,
      });
      return;
    }
    res.status(200).json({
      status: true,
      message: "Documents retrieved successfully",
      data: documents,
      count: documents.length,
    });
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error searching documents by proposed_change_id:", error);
    res.status(500).json({
      status: false,
      message: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getDocumentFilesByDocId = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = await service.getFilesByDocId(req.query.tr_additional_doc_id);
    res.status(200).json({ status: true, message: "Files retrieved successfully", data: files });
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error retrieving document files:", error);
    res.status(500).json(fileErrorBody(error));
  }
};

export const uploadDocumentFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const newDocumentFile = await service.uploadFile(req.body, req.file);
    res.status(201).json({ status: true, message: "File uploaded successfully", data: newDocumentFile });
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error uploading document file:", error);
    res.status(500).json(fileErrorBody(error));
  }
};

/** Kirim file sebagai stream; disposition "attachment" (download) atau "inline" (view). */
const streamFile = (disposition: "attachment" | "inline", logLabel: string) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { filePath, fileName, contentType } = await service.resolveFile(req.params.fileId as string);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `${disposition}; filename=${fileName}`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      if (sendHttpError(res, error)) return;
      console.error(logLabel, error);
      res.status(500).json(fileErrorBody(error));
    }
  };

export const downloadDocumentFile = streamFile("attachment", "❌ Error downloading document file:");
export const viewDocumentFile = streamFile("inline", "❌ Error viewing document file:");

export const deleteAdditionalFile = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.deleteFile(req.params.fileId as string);
    res.status(200).json({ status: true, message: "File marked as deleted successfully" });
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error deleting file:", error);
    res.status(500).json(fileErrorBody(error));
  }
};

export const updateProgressSupport = async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await service.updateProgressSupport(req.params.id as string, req.body);
    res.status(200).json({ status: true, message: "Progress support updated successfully", data: updated });
  } catch (error: any) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error updating progresssupport:", error);
    res.status(500).json({
      status: false,
      error: "Failed to update progresssupport",
      name: error.name || "UnknownError",
      message: error.message || "An unexpected error occurred",
      meta: error.meta || null,
    });
  }
};
