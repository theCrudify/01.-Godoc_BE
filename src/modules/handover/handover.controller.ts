import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./handover.service";
import { DatabaseError } from "./handover.service";

// Controller: hanya baca request → panggil service → kirim response.

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ success: true, message: "Handover document created successfully", data });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
    } else if (error instanceof DatabaseError) {
      res.status(500).json({
        success: false,
        error: "Database Error",
        message: "Database operation failed",
        details: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.update(req.params.id as string, req.body, { auth_id: Number((req as any).user?.auth_id) || undefined }));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ Error updating handover document:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.list(req.query as any));
  } catch (error: any) {
    console.error("❌ Error in getAllHandovers:", error);
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
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ Error fetching handover:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const listForApprover = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listForApprover(req.query as any));
  } catch (error: any) {
    console.error("❌ Error in getHandoverByIdApprover:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateApprovalStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.updateApprovalStatus(req.body));
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ [ERROR] updateHandoverApprovalStatus:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getHistory(req.params.id as string));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("Error fetching handover history by handover_id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getApprovals = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getApprovals(req.params.id as string));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("Error fetching approval history by handover_id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
