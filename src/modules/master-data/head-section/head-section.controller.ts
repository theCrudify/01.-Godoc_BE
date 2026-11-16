import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./head-section.service";

// Controller: hanya baca request → panggil service → kirim response.

const fail = (res: Response, error: unknown, label?: string) => {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.body);
    return;
  }
  if (label) console.error(label, error);
  else console.error(error);
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
    res.status(200).json(await service.getById(req.query, req.params.id as string));
  } catch (error) {
    fail(res, error);
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restored, data } = await service.create(req.body);
    if (restored) {
      res.status(200).json({
        message: "Section Head sebelumnya ditemukan dalam kondisi terhapus. Data telah dipulihkan.",
        data,
      });
      return;
    }
    res.status(201).json({ message: "Data Section Head berhasil ditambahkan", data });
  } catch (error) {
    fail(res, error, "Error creating Section Head:");
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.remove(req.params.id as string);
    res.status(200).json({ message: "Section Head successfully soft deleted" });
  } catch (error) {
    fail(res, error);
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.update(req.params.id as string, req.body);
    res.status(200).json({ message: "Data Section Head berhasil diperbarui", data });
  } catch (error) {
    fail(res, error, "Error updating Section Head:");
  }
};
