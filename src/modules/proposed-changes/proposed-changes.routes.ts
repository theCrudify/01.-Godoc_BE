import express from "express";
import { validate } from "../../shared/middleware/validate";
import { upload } from "../../shared/middleware/uploadMiddleware";
import { bindApproverFromToken } from "../../shared/middleware/authMiddleware";
import {
  requireDocAccess, scopeList, forceSelfQuery, requireSelfParam, bindOwnerFromToken, stripOwnerFields,
} from "../../shared/middleware/documentAccess";
import { IdParams, ProposedIdParams, SupportDocIdParams } from "./proposed-changes.dto";
import * as controller from "./proposed-changes.controller";
import * as supportDoc from "./support-document/support-document.controller";
import * as approval from "./approval/approval.controller";
import * as approverChange from "./approver-change/approver-change.controller";

const router = express.Router();
const id = (req: express.Request) => req.params.id;

// Proposed change (submit bersamaan dengan support documents)
router.post("/proposedchanges", bindOwnerFromToken(), controller.create);
router.post("/proposedchanges-support", requireDocAccess("pc", "manage", (req) => (Array.isArray(req.body) ? req.body : [req.body]).map((d: any) => d?.proposed_id)), supportDoc.createMany);

router.get("/proposedchanges", scopeList("auth_id", "department_id"), controller.list);
router.delete("/proposedchanges/:id", requireDocAccess("pc", "manage", id), controller.softDelete);

router.put("/proposedchanges/:id", stripOwnerFields("auth_id", "created_by"), validate(IdParams, "params"), requireDocAccess("pc", "manage", id), controller.update);
router.put("/supportdocuments/:proposed_id/status", validate(ProposedIdParams, "params"), requireDocAccess("pc", "manage", (req) => req.params.proposed_id), supportDoc.updateStatuses);

router.get("/proposedchanges/:id", validate(IdParams, "params"), requireDocAccess("pc", "read", id), controller.getById);

// History
router.get("/proposedchangeshistory", controller.listHistories);
router.get("/proposedchangeshistory/:id", validate(IdParams, "params"), controller.getHistoryById);
router.get("/history-byID-proposed-changes/:id", validate(IdParams, "params"), requireDocAccess("pc", "read", id), controller.getHistoryByProposedId);

// Approval (riwayat)
router.get("/approval-byID-proposed-changes/:id", validate(IdParams, "params"), requireDocAccess("pc", "read", id), controller.getApprovalsByProposedId);

// Support document + note
router.get("/supportproposed/:id", validate(IdParams, "params"), requireDocAccess("pc", "read", id), supportDoc.listByProposedId);
router.put("/supportproposed/:id", requireDocAccess("supportDoc", "manage", id), supportDoc.updateTitle);
router.post("/supportproposednoted/", requireDocAccess("supportDoc", "read", (req) => req.body?.support_doc_id), supportDoc.createNote);
router.get("/support-docs-noted/:support_doc_id/notes/", validate(SupportDocIdParams, "params"), requireDocAccess("supportDoc", "read", (req) => req.params.support_doc_id), supportDoc.listNotes);

// Support document file
router.post("/uploadsupport/", upload.single("file"), requireDocAccess("supportDoc", "manage", (req) => req.body?.support_doc_id), supportDoc.uploadFile);
router.get("/uploadsupport/:support_doc_id", requireDocAccess("supportDoc", "read", (req) => req.params.support_doc_id), supportDoc.listFiles);
router.get("/uploadsupport/file/:id", requireDocAccess("supportFile", "read", id), supportDoc.getFile);
router.get("/support-docs/file/:id/view", validate(IdParams, "params"), requireDocAccess("supportFile", "read", id), supportDoc.viewFile);
router.get("/support-docs/file/:id/download", requireDocAccess("supportFile", "read", id), supportDoc.downloadFile);
router.get("/support-docs/file/:id/download-watermark", requireDocAccess("supportFile", "read", id), supportDoc.downloadWithWatermark);

// Approval proses
router.get("/ongoing", forceSelfQuery("approval_auth_id"), approval.listOngoing);
router.post("/status", bindApproverFromToken, approval.updateStatus);

// Completion
router.get("/completion", scopeList("auth_id", "department_id"), controller.listWithRelations);
router.get("/completion/:id", validate(IdParams, "params"), requireDocAccess("pc", "read", id), controller.getByIdWithRelations);
router.get("/completionapprover/:approver_id", requireSelfParam("approver_id"), controller.listWithRelationsByApprover);

// Approver change management (cek role admin ada di service; lihat approver-change.service.ts)
router.post("/approver-change/request", requireDocAccess("pc", "manage", (req) => req.body?.proposed_changes_id), approverChange.requestChange);
router.get("/approver-change/pending", approverChange.listPending);
router.patch("/approver-change/:id/process", approverChange.processRequest);
router.post("/approver-change/bypass", approverChange.bypass);
router.get("/approver-change/all", approverChange.listAll);
router.get("/approver-change/stats", approverChange.stats);
router.get("/approver-change/by-proposed/:proposed_changes_id", approverChange.listByProposedId);
router.get("/approver-change/detail/:id", validate(IdParams, "params"), approverChange.getDetail);

export default router;
