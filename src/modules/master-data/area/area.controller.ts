import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./area.service";

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

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ message: "Area created successfully", data });
  } catch (error) {
    fail(res, error);
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.update(req.params.id as string, req.body);
    res.status(200).json({ message: "Area updated successfully", data });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("Error in updateArea:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.remove(req.params.id as string);
    res.status(200).json({ message: "Area soft-deleted successfully" });
  } catch (error) {
    fail(res, error);
  }
};
