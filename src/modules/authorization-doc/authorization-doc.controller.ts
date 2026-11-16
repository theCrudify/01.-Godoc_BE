import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./authorization-doc.service";

// Controller: hanya baca request → panggil service → kirim response.

const sendHttpError = (res: Response, error: unknown): boolean => {
  if (!(error instanceof HttpError)) return false;
  res.status(error.status).json(error.body);
  return true;
};

const detailsOf = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ message: "Authorization document created successfully", data });
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error creating authorization document:", error);
    res.status(500).json({ error: "Internal Server Error", details: detailsOf(error) });
  }
};

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.list(req.query as any));
  } catch (error: any) {
    console.error("❌ Error in getAllAuthDoc:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getById(req.params.id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error fetching authorization document:", error);
    res.status(500).json({ error: "Internal Server Error", details: detailsOf(error) });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.update(req.params.id as string, req.body, { auth_id: Number((req as any).user?.auth_id) || undefined }));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("❌ Error updating authorization document:", error);
    res.status(500).json({ error: "Internal Server Error", details: detailsOf(error) });
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getHistory(req.params.id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error fetching histories by authdoc_id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getApprovalList = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getApprovalList(req.params.id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error fetching approval history by authdoc_id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDoneByAuthId = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getDoneByAuthId(req.params.id as string));
  } catch (error) {
    if (sendHttpError(res, error)) return;
    console.error("Error retrieving filtered authdoc:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
