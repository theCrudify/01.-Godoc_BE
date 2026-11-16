import express from "express";
import { validate } from "../../shared/middleware/validate";
import {
  requireDocAccess,
  scopeList,
  forceSelfQuery,
  requireSelfParam,
  bindOwnerFromToken,
  stripOwnerFields,
} from "../../shared/middleware/documentAccess";
import { bindApproverFromToken } from "../../shared/middleware/authMiddleware";
import { CreateAuthDocDto, IdParams, ListAuthDocQuery, UpdateAuthDocDto } from "./authorization-doc.dto";
import { OngoingAuthDocQuery, UpdateApprovalStatusDto } from "./approval/approval.dto";
import {
  BypassDto,
  ChangeRequestListQuery,
  ProcessChangeRequestDto,
  RequestApproverChangeDto,
} from "./approver-change/approver-change.dto";
import * as controller from "./authorization-doc.controller";
import * as approval from "./approval/approval.controller";
import * as approverChange from "./approver-change/approver-change.controller";

// Menggantikan src/routes/routesActivity/ActivityAuthDoc.ts (path, method & urutan sama).
const router = express.Router();
const docId = (req: express.Request) => req.params.id;

// ---------- dokumen ----------
router.post("/authdoc", bindOwnerFromToken(), validate(CreateAuthDocDto), controller.create);
router.get("/authdoc", scopeList("auth_id", "department_id"), validate(ListAuthDocQuery, "query"), controller.list);
router.get("/authdoc/:id", validate(IdParams, "params"), requireDocAccess("authdoc", "read", docId), controller.getById);
router.put("/authdoc/:id", stripOwnerFields("auth_id"), validate(IdParams, "params"), validate(UpdateAuthDocDto), requireDocAccess("authdoc", "read", docId), controller.update);
router.get("/history-byID-authdoc/:id", validate(IdParams, "params"), requireDocAccess("authdoc", "read", docId), controller.getHistory);
router.get("/approval-byID-authdoc/:id", validate(IdParams, "params"), requireDocAccess("authdoc", "read", docId), controller.getApprovalList);

// ---------- approval ----------
router.get("/authdocongoing", forceSelfQuery("approval_auth_id"), validate(OngoingAuthDocQuery, "query"), approval.listOngoing);
router.post("/authstatus", bindApproverFromToken, validate(UpdateApprovalStatusDto), approval.updateStatus);

router.get("/authdoc/by-auth/:id", validate(IdParams, "params"), requireSelfParam("id"), controller.getDoneByAuthId);

// ---------- perubahan approver & bypass ----------
router.get("/approver-change-authdoc/by-authdoc/:authorization_doc_id", validate(ChangeRequestListQuery, "query"), approverChange.listByAuthdoc);
router.post(
  "/approver-change-authdoc/request",
  validate(RequestApproverChangeDto),
  requireDocAccess("authdoc", "manage", (req) => req.body?.authorization_doc_id),
  approverChange.requestChange,
);
router.get("/approver-change-authdoc/pending", validate(ChangeRequestListQuery, "query"), approverChange.listPending);
router.get("/approver-change-authdoc/all", validate(ChangeRequestListQuery, "query"), approverChange.listAll);
router.get("/approver-change-authdoc/stats", approverChange.getStats);
router.get("/approver-change-authdoc/detail/:id", validate(IdParams, "params"), approverChange.getDetail);
router.patch("/approver-change-authdoc/:id/process", validate(IdParams, "params"), validate(ProcessChangeRequestDto), approverChange.processRequest);
// khusus Super Admin (dicek di service)
router.post("/approver-change-authdoc/bypass", validate(BypassDto), approverChange.bypass);

export default router;
