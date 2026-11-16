import express from "express";
import * as controller from "./dashboard.controller";

// Tidak ada validate(Dto): cek query/params lama (bulan, id departemen) punya body 400 khusus → tetap di service.

const router = express.Router();

router.get("/documentmapping", controller.getDocumentStatusMapping);

// Department involvement
router.get("/dashboarddepartments", controller.getDepartmentInvolvement);
router.get("/dashboarddepartments/:id", controller.getDepartmentInvolvementDetail);

// Document time statistics
router.get("/docstatistics/time", controller.getDocumentTimeStatistics);
router.get("/docstatistics/trends", controller.getDocumentTrends);

// Top performers
router.get("/top-performers/submitters", controller.getTopHandoverSubmitters);
router.get("/top-performers/approvers", controller.getTopHandoverApprovers);

// Line code statistics
router.get("/line-codes", controller.getLineCodeStatistics);
router.get("/line-codes/flow", controller.getLineCodeStatusFlow);

export default router;
