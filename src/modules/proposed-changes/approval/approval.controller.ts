import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./approval.service";

export const listOngoing = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listOngoing(req.query));
  } catch (error: any) {
    console.error("❌ Error in getOngoingApprovalsByAuthId:", error);
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
    console.error("❌ [ERROR] updateApprovalStatus:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
