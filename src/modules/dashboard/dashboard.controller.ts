import { Request, Response } from "express";
import { HttpError } from "../../shared/utils/http-error";
import * as service from "./dashboard.service";

/**
 * Handler dashboard standar: 200 { status: "success", message, ...hasil }.
 * Error → HttpError apa adanya, selain itu 500 { status: "error", message: errorMessage, error }.
 */
const handle = (
  run: (req: Request) => Promise<Record<string, unknown>>,
  successMessage: (result: any) => string,
  errorLog: string,
  errorMessage: string,
) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await run(req);
      res.status(200).json({ status: "success", message: successMessage(result), ...result });
    } catch (error) {
      if (error instanceof HttpError) {
        res.status(error.status).json(error.body);
        return;
      }
      console.error(errorLog, error);
      res.status(500).json({
        status: "error",
        message: errorMessage,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

export const getDocumentStatusMapping = async (req: Request, res: Response) => {
  try {
    res.json(await service.getDocumentStatusMapping());
  } catch (error) {
    console.error("Error fetching document mapping:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getDepartmentInvolvement = handle(
  async () => ({ data: await service.getDepartmentInvolvement() }),
  () => "Data keterlibatan departemen berhasil diambil",
  "Error saat mengambil data keterlibatan departemen:",
  "Gagal mengambil data keterlibatan departemen",
);

export const getDepartmentInvolvementDetail = handle(
  async (req) => ({ data: await service.getDepartmentInvolvementDetail(req.params.id as string) }),
  () => "Detail keterlibatan departemen berhasil diambil",
  "Error saat mengambil detail departemen:",
  "Gagal mengambil detail keterlibatan departemen",
);

export const getDocumentTimeStatistics = handle(
  (req) => service.getDocumentTimeStatistics(req.query),
  () => "Statistik dokumen berhasil diambil",
  "Error saat mengambil statistik dokumen:",
  "Gagal mengambil statistik dokumen",
);

export const getDocumentTrends = handle(
  (req) => service.getDocumentTrends(req.query),
  () => "Tren dokumen berhasil diambil",
  "Error saat mengambil tren dokumen:",
  "Gagal mengambil tren dokumen",
);

export const getTopHandoverSubmitters = handle(
  (req) => service.getTopHandoverSubmitters(req.query),
  (r) => `Top ${r.filters.limit} handover submitters berhasil diambil`,
  "Error saat mengambil top handover submitters:",
  "Gagal mengambil data top handover submitters",
);

export const getTopHandoverApprovers = handle(
  (req) => service.getTopHandoverApprovers(req.query),
  (r) => `Top ${r.filters.limit} handover approvers berhasil diambil`,
  "Error saat mengambil top handover approvers:",
  "Gagal mengambil data top handover approvers",
);

export const getLineCodeStatistics = handle(
  (req) => service.getLineCodeStatistics(req.query),
  () => "Statistik line_code berhasil diambil",
  "Error saat mengambil statistik line_code:",
  "Gagal mengambil statistik line_code",
);

export const getLineCodeStatusFlow = handle(
  (req) => service.getLineCodeStatusFlow(req.query),
  () => "Statistik alur dokumen berdasarkan line_code berhasil diambil",
  "Error saat mengambil statistik flow line_code:",
  "Gagal mengambil statistik flow line_code",
);
