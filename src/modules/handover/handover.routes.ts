import express from "express";
import { validate } from "../../shared/middleware/validate";
import { requireDocAccess, scopeList, forceSelfQuery, bindOwnerFromToken, stripOwnerFields } from "../../shared/middleware/documentAccess";
import { bindApproverFromToken } from "../../shared/middleware/authMiddleware";
import {
  CreateHandoverDto,
  ListApproverHandoversQuery,
  ListHandoversQuery,
  UpdateHandoverApprovalDto,
  UpdateHandoverDto,
} from "./handover.dto";
import { FinishHandoverDto, SubmitRatingDto } from "../rating/rating.dto";
import * as controller from "./handover.controller";
import * as ratingController from "../rating/rating.controller";

const router = express.Router();
const docId = (req: express.Request) => req.params.id;

// Handover
router.post("/handover", bindOwnerFromToken(), validate(CreateHandoverDto), controller.create);
router.put("/handover/:id", stripOwnerFields("auth_id"), validate(UpdateHandoverDto), requireDocAccess("handover", "read", docId), controller.update);
router.get("/handover", scopeList("auth_id", "department_id"), validate(ListHandoversQuery, "query"), controller.list);
router.get("/handover/:id", requireDocAccess("handover", "read", docId), controller.getById);

// Approval
router.get("/ongoinghandover", forceSelfQuery("approval_auth_id"), validate(ListApproverHandoversQuery, "query"), controller.listForApprover);
router.post("/approvalhandover", bindApproverFromToken, validate(UpdateHandoverApprovalDto), controller.updateApprovalStatus);

// History & approval list
router.get("/history-byID-handover/:id", requireDocAccess("handover", "read", docId), controller.getHistory);
router.get("/approval-byID-handover/:id", requireDocAccess("handover", "read", docId), controller.getApprovals);

// Rating (controller di modules/rating)
router.put("/handover/:id/finish", validate(FinishHandoverDto), requireDocAccess("handover", "read", docId), ratingController.finishHandover);
router.post("/handover/:handover_id/rate", bindOwnerFromToken(), validate(SubmitRatingDto), requireDocAccess("handover", "read", (req) => req.params.handover_id), ratingController.submitRating);

export default router;
