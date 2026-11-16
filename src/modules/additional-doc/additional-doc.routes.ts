import express from "express";
import { requireDocAccess } from "../../shared/middleware/documentAccess";
import { upload } from "../../shared/middleware/uploadMiddleware";
import * as controller from "./additional-doc.controller";

// Tidak ada validate(Dto): semua cek input lama punya body 400 khusus per endpoint → tetap di service.

const router = express.Router();

// ===== Additional DOC metadata =====
router.get("/superproposed/:id", requireDocAccess("pc", "read", (req) => req.params.id), controller.SupergetProposedChangeById);
router.post("/superproposed", requireDocAccess("pc", "manage", (req) => req.body?.form_data?.proposed_change_id), controller.insertDocumentNumber);
router.put("/superproposed/:id", requireDocAccess("docNumber", "manage", (req) => req.params.id), controller.updateDocumentNumber);
// Example: /api/additionalbyid/search?proposed_change_id=1
router.get("/additionalbyid/search", requireDocAccess("pc", "read", (req) => req.query.proposed_change_id), controller.searchByProposedChangeId);

// ===== File operations =====
// Example: /api/document/files?tr_additional_doc_id=1
router.get("/document/files", requireDocAccess("additionalDoc", "read", (req) => req.query.tr_additional_doc_id), controller.getDocumentFilesByDocId);
router.post("/documents/upload", upload.single("file"), requireDocAccess("additionalDoc", "manage", (req) => req.body?.tr_additional_doc_id), controller.uploadDocumentFile);
router.get("/document/files/download/:fileId", requireDocAccess("additionalFile", "read", (req) => req.params.fileId), controller.downloadDocumentFile);
router.get("/document/files/view/:fileId", requireDocAccess("additionalFile", "read", (req) => req.params.fileId), controller.viewDocumentFile);
router.delete("/document/files/delete/:fileId", requireDocAccess("additionalFile", "manage", (req) => req.params.fileId), controller.deleteAdditionalFile);

// ===== Update progress (support percentage) =====
router.put("/transaction/proposed-changes/status/:id", requireDocAccess("pc", "manage", (req) => req.params.id), controller.updateProgressSupport);

export default router;
