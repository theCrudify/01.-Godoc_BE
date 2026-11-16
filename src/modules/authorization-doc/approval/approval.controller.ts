import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./approval.service";

// Controller: hanya baca request → panggil service → kirim response.

export const listOngoing = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listOngoing(req.query as any));
  } catch (error: any) {
    console.error("❌ Error in getAuthDocByIdApprover:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.updateStatus(req.body));
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ [ERROR] updateAuthApprovalStatus:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
