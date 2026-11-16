import express from "express";
import { validate } from "../../shared/middleware/validate";
import { requireDocAccess, scopeList } from "../../shared/middleware/documentAccess";
import { CreateDocumentNumberDto, DocumentNumberIdParams, ListDocumentNumbersQuery } from "./document-number.dto";
import * as controller from "./document-number.controller";

const router = express.Router();
const docId = (req: express.Request) => req.params.id;

router.get("/documentnumbers", scopeList("auth_id"), validate(ListDocumentNumbersQuery, "query"), controller.list);
router.get("/documentnumbers/:id", validate(DocumentNumberIdParams, "params"), requireDocAccess("docNumber", "read", docId), controller.getById);
router.post("/documentnumbers", validate(CreateDocumentNumberDto), controller.create);
router.delete("/documentnumbers/:id", validate(DocumentNumberIdParams, "params"), requireDocAccess("docNumber", "manage", docId), controller.remove);

export default router;
