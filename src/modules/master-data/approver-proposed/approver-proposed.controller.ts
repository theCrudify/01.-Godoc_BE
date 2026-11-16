import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./approver-proposed.service";

// Controller: hanya baca request → panggil service → kirim response.

function fail(res: Response, error: unknown, logMessage: string): void {
  if (error instanceof HttpError) {
    res.status(error.status).json(error.body);
    return;
  }
  console.error(logMessage, error);
  res.status(500).json({
    error: "Internal Server Error",
    details: error instanceof Error ? error.message : "Unknown error",
  });
}

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.list(req.query));
  } catch (error) {
    fail(res, error, "❌ Error fetching template approvals:");
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ data: await service.getById(req.params.id as string) });
  } catch (error) {
    fail(res, error, "❌ Error fetching template approval by ID:");
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ message: "Template approval created successfully", data });
  } catch (error) {
    fail(res, error, "❌ Error creating template approval:");
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.update(req.params.id as string, req.body);
    res.status(200).json({ message: "Template approval updated successfully", data });
  } catch (error) {
    fail(res, error, "❌ Error updating template approval:");
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.remove(req.params.id as string, req.body);
    res.status(200).json({ message: "Template approval deleted successfully" });
  } catch (error) {
    fail(res, error, "❌ Error deleting template approval:");
  }
};

export const bulkCreate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { successes, failures } = await service.bulkCreate(req.body);
    if (failures.length === 0) {
      res.status(201).json({ message: `${successes.length} template approvals created successfully`, data: successes });
    } else {
      res.status(207).json({
        message: `${successes.length} template approvals created, ${failures.length} failed`,
        successes,
        failures,
      });
    }
  } catch (error) {
    fail(res, error, "❌ Error bulk creating template approvals:");
  }
};

export const listByTemplateName = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.listByTemplateName(req.params.template_name as string);
    res.status(200).json({ data, count: data.length });
  } catch (error) {
    fail(res, error, "❌ Error fetching template approvals by template name:");
  }
};

export const listByLineCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.listByLineCode(req.params.line_code as string);
    res.status(200).json({ data, count: data.length });
  } catch (error) {
    fail(res, error, "❌ Error fetching template approvals by line code:");
  }
};

export const toggleStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.toggleStatus(req.params.id as string, req.body);
    res.status(200).json({
      message: `Template approval ${data.is_active ? "activated" : "deactivated"} successfully`,
      data,
    });
  } catch (error) {
    fail(res, error, "❌ Error toggling template approval status:");
  }
};
