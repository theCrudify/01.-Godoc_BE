import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./document-categories.service";

const fail = (res: Response, error: unknown) => {
  if (error instanceof HttpError) return res.status(error.status).json(error.body);
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
    res.status(200).json({ data: await service.getById(req.params.id as string) });
  } catch (error) {
    fail(res, error);
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json({ data: await service.create(req.body) });
  } catch (error) {
    fail(res, error);
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ data: await service.update(req.params.id as string, req.body) });
  } catch (error) {
    fail(res, error);
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.remove(req.params.id as string);
    res.status(200).json({ message: "Document soft deleted successfully" });
  } catch (error) {
    fail(res, error);
  }
};
