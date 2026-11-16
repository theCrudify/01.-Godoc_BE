import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./approver-change.service";
import { AuthenticatedUser, ClientInfo } from "./approver-change.service";

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

const clientInfo = (req: Request): ClientInfo => ({
  ip: req.ip || req.socket.remoteAddress,
  userAgent: req.get("User-Agent") || null,
});

/** HttpError → body apa adanya; lainnya → 500 dengan detail hanya di development. */
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

export const listByProposedId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listByProposedId(req.user, req.params.proposed_changes_id as string, req.query.status as string));
  } catch (error) {
    handle(res, error, "❌ Error getting approval requests by proposed ID:");
  }
};

export const requestChange = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(201).json(await service.requestChange(req.user, req.body));
  } catch (error) {
    handle(res, error, "❌ Error creating approver change request:");
  }
};

export const listPending = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listPending(req.user, req.query));
  } catch (error) {
    handle(res, error, "❌ Error getting pending requests:");
  }
};

export const processRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.processRequest(req.user, req.params.id as string, req.body, clientInfo(req)));
  } catch (error) {
    handle(res, error, "❌ Error processing approver change request:");
  }
};

export const bypass = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.bypass(req.user, req.body, clientInfo(req)));
  } catch (error) {
    handle(res, error, "❌ ADMIN BYPASS CRITICAL ERROR:");
  }
};

export const listAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listAll(req.user, req.query));
  } catch (error) {
    handle(res, error, "❌ Error getting all requests:");
  }
};

export const stats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.stats(req.user));
  } catch (error) {
    handle(res, error, "❌ Error getting request stats:");
  }
};

export const getDetail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getDetail(req.params.id as string));
  } catch (error) {
    handle(res, error, "❌ Error getting approval request detail:");
  }
};
