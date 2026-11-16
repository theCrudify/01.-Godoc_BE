import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./users.service";

// Semua handler user memakai body 500 yang sama seperti sebelumnya.
const handleError = (res: Response, error: unknown) => {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.body);
    return;
  }
  console.error(error);
  res.status(500).json({ error: "Internal Server Error" });
};

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.listEmployees(req.query));
  } catch (error) {
    handleError(res, error);
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.list());
  } catch (error) {
    handleError(res, error);
  }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await service.getById(Number(req.params.id)));
  } catch (error) {
    handleError(res, error);
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const newUser = await service.create(req.body);
    res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedUser = await service.update(Number(req.params.id), req.body);
    res.json({ message: "User updated successfully", updatedUser });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.remove(Number(req.params.id));
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    handleError(res, error);
  }
};

export const softDeleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.softDelete(Number(req.params.id));
    res.json({ message: "User soft deleted successfully" });
  } catch (error) {
    handleError(res, error);
  }
};
