import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./proposed-changes.service";

// Controller: hanya baca request → panggil service → kirim response.

const devDetails = (error: any) => (process.env.NODE_ENV === "development" ? error.message : undefined);
const errorDetails = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.list(req.query));
  } catch (error: any) {
    console.error("❌ Error in getAllProposedChanges:", error);
    res.status(500).json({ error: "Internal Server Error", details: devDetails(error) });
  }
};

export const listWithRelations = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listWithRelations(req.query));
  } catch (error: any) {
    console.error("❌ Error in getAllProposedChangesWithRelations:", error);
    res.status(500).json({ error: "Internal Server Error", details: devDetails(error) });
  }
};

export const getByIdWithRelations = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getByIdWithRelations(req.params.id as string));
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error(`❌ Error in getProposedChangeByIdWithRelations: ${error.message}`);
    res.status(500).json({ error: "Internal Server Error", details: devDetails(error) });
  }
};

export const listWithRelationsByApprover = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listWithRelationsByApprover(req.query, req.params.approver_id as string));
  } catch (error: any) {
    console.error("❌ Error in getAllProposedChangesWithRelations:", error);
    res.status(500).json({ error: "Internal Server Error", details: devDetails(error) });
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getById(req.params.id as string));
  } catch (error: any) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ Error in getProposedChangeById:", error);
    res.status(500).json({ error: "Internal Server Error", details: devDetails(error) });
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ message: "Proposed change created successfully", data });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("Error creating proposed change:", error);
    res.status(500).json({ error: "Internal Server Error", details: errorDetails(error) });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const data = await service.update(req.params.id as string, req.body, { auth_id: Number(user?.auth_id), nik: user?.nik });
    res.status(200).json({ message: "Proposed change updated successfully", data });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("Error updating proposed change:", error);
    res.status(500).json({ error: "Internal Server Error", details: errorDetails(error) });
  }
};

export const softDelete = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const updatedBy = req.body.updated_by; // opsional: siapa yang menghapus

  try {
    res.status(200).json(await service.softDelete(id as string, updatedBy));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("❌ ERROR: Failed to soft delete proposed change:", error);
    res.status(500).json({ error: "Internal Server Error", details: errorDetails(error) });
  }
};

export const listHistories = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.listHistories());
  } catch (error) {
    console.error("Error fetching proposed changes history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getHistoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getHistoryById(req.params.id as string));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getHistoryByProposedId = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getHistoryByProposedId(req.params.id as string));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("Error fetching histories by proposed_changes_id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getApprovalsByProposedId = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await service.getApprovalsByProposedId(req.params.id as string));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json(error.body);
      return;
    }
    console.error("Error fetching approval history by proposed_changes_id:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
