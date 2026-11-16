import { Request, Response } from "express";
import { HttpError } from "../../../shared/utils/http-error";
import * as service from "./approver-authorization.service";

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
    fail(res, error, "❌ Error fetching template approval authorizations:");
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ data: await service.getById(req.params.id as string) });
  } catch (error) {
    fail(res, error, "❌ Error fetching template approval authorization by ID:");
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ message: "Template approval authorization created successfully", data });
  } catch (error) {
    fail(res, error, "❌ Error creating template approval authorization:");
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.update(req.params.id as string, req.body);
    res.status(200).json({ message: "Template approval authorization updated successfully", data });
  } catch (error) {
    fail(res, error, "❌ Error updating template approval authorization:");
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    await service.remove(req.params.id as string, req.body);
    res.status(200).json({ message: "Template approval authorization deleted successfully" });
  } catch (error) {
    fail(res, error, "❌ Error deleting template approval authorization:");
  }
};

export const bulkCreate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { successes, failures } = await service.bulkCreate(req.body);
    if (failures.length === 0) {
      res.status(201).json({ message: `${successes.length} template approval authorizations created successfully`, data: successes });
    } else {
      res.status(207).json({
        message: `${successes.length} template approval authorizations created, ${failures.length} failed`,
        successes,
        failures,
      });
    }
  } catch (error) {
    fail(res, error, "❌ Error bulk creating template approval authorizations:");
  }
};

export const listByTemplateName = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.listByTemplateName(req.params.template_name as string);
    res.status(200).json({ data, count: data.length });
  } catch (error) {
    fail(res, error, "❌ Error fetching template approval authorizations by template name:");
  }
};

export const listByLineCode = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listByLineCode(req.params.line_code as string));
  } catch (error) {
    fail(res, error, "❌ Error fetching template approval authorizations by line code:");
  }
};

export const listInsertSteps = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.listInsertSteps(req.query.line_code as string);
    res.status(200).json({ data, count: data.length });
  } catch (error) {
    fail(res, error, "❌ Error fetching insert steps:");
  }
};

export const toggleStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.toggleStatus(req.params.id as string, req.body);
    res.status(200).json({
      message: `Template approval authorization ${data.is_active ? "activated" : "deactivated"} successfully`,
      data,
    });
  } catch (error) {
    fail(res, error, "❌ Error toggling template approval authorization status:");
  }
};

export const getFlowByLineCode = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getFlowByLineCode(req.params.line_code as string));
  } catch (error) {
    fail(res, error, "❌ Error getting approval flow by line code:");
  }
};

export const listTemplateNames = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.listTemplateNames();
    res.status(200).json({ data, count: data.length });
  } catch (error) {
    fail(res, error, "❌ Error fetching unique template names:");
  }
};

export const listLineCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.listLineCodes();
    res.status(200).json({ data, count: data.length });
  } catch (error) {
    fail(res, error, "❌ Error fetching unique line codes:");
  }
};

export const validateFlow = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.validateFlow(req.body));
  } catch (error) {
    fail(res, error, "❌ Error validating approval flow:");
  }
};
