import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./rating.service";

// Controller: hanya baca request → panggil service → kirim response.

export const finishHandover = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.finishHandover(req.params.id as string, req.body));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ Error finishing handover:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const submitRating = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.submitRating(req.params.handover_id as string, req.body));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ Error submitting rating:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
