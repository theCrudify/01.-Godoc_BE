import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./approver-change.service";

// Controller: hanya baca request → panggil service → kirim response.

type AuthedRequest = Request & { user?: any };

const meta = (req: Request): service.RequestMeta => ({
  ip: req.ip || req.socket.remoteAddress,
  userAgent: req.get("User-Agent") || null,
});

/** 500 standar modul ini: detail hanya di development. */
const handle = (res: Response, error: unknown, label: string) => {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.body);
    return;
  }
  console.error(label, error);
  res.status(500).json({
    error: "Internal Server Error",
    details: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
  });
};

export const listByAuthdoc = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listByAuthdoc(req.user, req.params.authorization_doc_id as string, req.query as any));
  } catch (error) {
    handle(res, error, "❌ Error getting approval requests by authorization doc ID:");
  }
};

export const requestChange = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(201).json(await service.requestChange(req.user, req.body));
  } catch (error) {
    handle(res, error, "❌ Error creating approver change request for authorization document:");
  }
};

export const listPending = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listPending(req.user, req.query as any));
  } catch (error) {
    handle(res, error, "❌ Error getting pending requests:");
  }
};

export const listAll = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listAll(req.user, req.query as any));
  } catch (error) {
    handle(res, error, "❌ Error getting all requests:");
  }
};

export const getStats = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getStats(req.user));
  } catch (error) {
    handle(res, error, "❌ Error getting request stats:");
  }
};

export const getDetail = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getDetail(req.params.id as string));
  } catch (error) {
    handle(res, error, "❌ Error getting approval request detail:");
  }
};

export const processRequest = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.processRequest(req.user, req.params.id as string, req.body, meta(req)));
  } catch (error) {
    handle(res, error, "❌ Error processing approver change request for authorization document:");
  }
};

export const bypass = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.bypass(req.user, req.body, meta(req)));
  } catch (error) {
    handle(res, error, "❌ ADMIN BYPASS AUTHDOC CRITICAL ERROR:");
  }
};
