import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./plant.service";

// Controller: hanya baca request → panggil service → kirim response.

const fail = (res: Response, error: unknown) => {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.body);
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Internal Server Error" });
};

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.list(req.query));
  } catch (error) {
    fail(res, error);
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getById(req.params.id as string));
  } catch (error) {
    fail(res, error);
  }
};
