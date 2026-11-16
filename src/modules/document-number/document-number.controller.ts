import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./document-number.service";

// Controller: hanya baca request → panggil service → kirim response.

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.list(req.query as any));
  } catch (error: any) {
    console.error("❌ Error in getAllDocumentNumbers:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    const document = await service.getById(Number(req.params.id));
    res.status(200).json({ data: [document] });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ message: "Document number created successfully", data });
  } catch (error) {
    console.error("❌ ERROR: Failed to create document number:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.remove(Number(req.params.id));
    res.status(200).json({ message: "Document successfully deleted" });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
