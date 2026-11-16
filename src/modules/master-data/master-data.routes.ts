import express from "express";
import { requireSuperAdmin } from "../../shared/middleware/authMiddleware";
import { validate } from "../../shared/middleware/validate";

import * as authorization from "./authorization/authorization.controller";
import * as department from "./department/department.controller";
import * as departmentDto from "./department/department.dto";
import * as sectionDepartment from "./section-department/section-department.controller";
import * as sectionDepartmentDto from "./section-department/section-department.dto";
import * as line from "./line/line.controller";
import * as lineDto from "./line/line.dto";
import * as area from "./area/area.controller";
import * as areaDto from "./area/area.dto";
import * as plant from "./plant/plant.controller";
import * as headDepartment from "./head-department/head-department.controller";
import * as headDepartmentDto from "./head-department/head-department.dto";
import * as headSection from "./head-section/head-section.controller";
import * as headSectionDto from "./head-section/head-section.dto";
import * as approverProposed from "./approver-proposed/approver-proposed.controller";
import * as approverAuthorization from "./approver-authorization/approver-authorization.controller";
import * as approverAuthorizationDto from "./approver-authorization/approver-authorization.dto";
import * as approverHandover from "./approver-handover/approver-handover.controller";
import * as supportDocument from "./support-document/support-document.controller";
import * as supportDocumentDto from "./support-document/support-document.dto";
import * as subDocument from "./sub-document/sub-document.controller";
import * as development from "./development/development.controller";
import * as docType from "./doc-type/doc-type.controller";
import * as documentCategories from "./document-categories/document-categories.controller";
import * as documentCategoriesDto from "./document-categories/document-categories.dto";

// Master data: dulu routesMasterORG lalu routesMasterDOC — urutan route dipertahankan.
// validate() diletakkan SETELAH requireSuperAdmin supaya non-admin tetap mendapat 403, bukan 400.
const router = express.Router();

// ===== Organisasi =====
router.post("/userGodoc", requireSuperAdmin, authorization.create);
router.get("/userGodoc", authorization.list);
router.get("/userGodoc/:id", authorization.getById);
router.put("/userGodoc/:id", requireSuperAdmin, authorization.update);
router.delete("/userGodoc/:id", requireSuperAdmin, authorization.remove);
router.get("/getAllRoles", authorization.listRoles);

router.post("/departments", requireSuperAdmin, validate(departmentDto.CreateDepartmentDto), department.create);
router.get("/departments", department.list);
router.get("/departments/:id", department.getById);
router.put("/departments/:id", requireSuperAdmin, validate(departmentDto.UpdateDepartmentDto), department.update);
router.delete("/departments/:id", requireSuperAdmin, department.remove);

router.post("/sectiondepartments", requireSuperAdmin, validate(sectionDepartmentDto.SectionDepartmentDto), sectionDepartment.create);
router.get("/sectiondepartments", sectionDepartment.list);
router.get("/sectiondepartments/:id", sectionDepartment.getById);
router.put("/sectiondepartments/:id", requireSuperAdmin, validate(sectionDepartmentDto.SectionDepartmentDto), sectionDepartment.update);
router.delete("/sectiondepartments/:id", requireSuperAdmin, sectionDepartment.remove);

// POST /lines sengaja TANPA requireSuperAdmin (perilaku lama).
router.post("/lines", validate(lineDto.LineDto), line.create);
router.get("/lines", line.list);
router.get("/lines/:id", line.getById);
router.put("/lines/:id", requireSuperAdmin, validate(lineDto.LineDto), line.update);
router.delete("/lines/:id", requireSuperAdmin, line.remove);

router.post("/areas", requireSuperAdmin, validate(areaDto.CreateAreaDto), area.create);
router.get("/areas", area.list);
router.get("/areas/:id", area.getById);
router.put("/areas/:id", requireSuperAdmin, area.update);
router.delete("/areas/:id", requireSuperAdmin, area.remove);

router.get("/plants", plant.list);
router.get("/plants/:id", plant.getById);

router.post("/headDepartments", requireSuperAdmin, validate(headDepartmentDto.CreateHeadDepartmentDto), headDepartment.create);
router.get("/headDepartments", headDepartment.list);
router.get("/headDepartments/:id", headDepartment.getById);
router.put("/headDepartments/:id", requireSuperAdmin, headDepartment.update);
router.delete("/headDepartments/:id", requireSuperAdmin, headDepartment.remove);

router.post("/headSection", requireSuperAdmin, validate(headSectionDto.CreateHeadSectionDto), headSection.create);
router.get("/headSection", headSection.list);
router.get("/headSection/:id", headSection.getById);
router.put("/headSection/:id", requireSuperAdmin, headSection.update);
router.delete("/headSection/:id", requireSuperAdmin, headSection.remove);

// ===== Template approval: proposed changes =====
router.get("/approverproposed", approverProposed.list);
router.get("/approverproposed/:id", approverProposed.getById);
router.post("/approverproposed", requireSuperAdmin, approverProposed.create);
router.put("/approverproposed/:id", requireSuperAdmin, approverProposed.update);
router.delete("/approverproposed/:id", requireSuperAdmin, approverProposed.remove);
router.post("/approverproposed/bulk/create", requireSuperAdmin, approverProposed.bulkCreate);
router.get("/approverproposed/template/:template_name", approverProposed.listByTemplateName);
router.get("/approverproposed/line/:line_code", approverProposed.listByLineCode);
router.patch("/approverproposed/:id/toggle-status", requireSuperAdmin, approverProposed.toggleStatus);

// ===== Template approval: authorization =====
// insert-steps, template-names, line-codes tertutup oleh "/:id" di atasnya (perilaku lama, urutan dipertahankan).
router.get("/approverauthorization", approverAuthorization.list);
router.get("/approverauthorization/:id", approverAuthorization.getById);
router.post("/approverauthorization", requireSuperAdmin, approverAuthorization.create);
router.put("/approverauthorization/:id", requireSuperAdmin, approverAuthorization.update);
router.delete("/approverauthorization/:id", requireSuperAdmin, approverAuthorization.remove);
router.post("/approverauthorization/bulk/create", requireSuperAdmin, approverAuthorization.bulkCreate);
router.get("/approverauthorization/template/:template_name", approverAuthorization.listByTemplateName);
router.get("/approverauthorization/line/:line_code", approverAuthorization.listByLineCode);
router.get("/approverauthorization/insert-steps", approverAuthorization.listInsertSteps);
router.get("/approverauthorization/flow/:line_code", approverAuthorization.getFlowByLineCode);
router.post("/approverauthorization/validate-flow", requireSuperAdmin, validate(approverAuthorizationDto.ValidateApprovalFlowDto), approverAuthorization.validateFlow);
router.get("/approverauthorization/template-names", approverAuthorization.listTemplateNames);
router.get("/approverauthorization/line-codes", approverAuthorization.listLineCodes);
router.patch("/approverauthorization/:id/toggle-status", requireSuperAdmin, approverAuthorization.toggleStatus);

// ===== Template approval: handover =====
router.get("/approverhandover", approverHandover.list);
router.get("/approverhandover/:id", approverHandover.getById);
router.post("/approverhandover", requireSuperAdmin, approverHandover.create);
router.put("/approverhandover/:id", requireSuperAdmin, approverHandover.update);
router.delete("/approverhandover/:id", requireSuperAdmin, approverHandover.remove);
router.post("/approverhandover/bulk/create", requireSuperAdmin, approverHandover.bulkCreate);
router.get("/approverhandover/template/:template_name", approverHandover.listByTemplateName);
router.get("/approverhandover/line/:line_code", approverHandover.listByLineCode);

// ===== Dokumen =====
router.post("/mastersupportdoc", requireSuperAdmin, validate(supportDocumentDto.SupportDocumentDto), supportDocument.create);
router.get("/mastersupportdoc", supportDocument.list);
router.get("/mastersupportdoc/:id", supportDocument.getById);
router.put("/mastersupportdoc/:id", requireSuperAdmin, validate(supportDocumentDto.SupportDocumentDto), supportDocument.update);
router.delete("/mastersupportdoc/:id", requireSuperAdmin, supportDocument.remove);
router.get("/instantsupportdoc", supportDocument.listInstant);

router.post("/subdocument", requireSuperAdmin, subDocument.create);
router.get("/subdocument", subDocument.list);
router.get("/subdocument/:id", subDocument.getById);
router.put("/subdocument/:id", requireSuperAdmin, subDocument.update);
router.delete("/subdocument/:id", requireSuperAdmin, subDocument.remove);

router.post("/development", requireSuperAdmin, development.create);
router.get("/development", development.list);
router.get("/development/:id", development.getById);
router.put("/development/:id", requireSuperAdmin, development.update);
router.delete("/development/:id", requireSuperAdmin, development.remove);

router.post("/doctype", requireSuperAdmin, docType.create);
router.get("/doctype", docType.list);
router.get("/doctype/:id", docType.getById);
router.put("/doctype/:id", requireSuperAdmin, docType.update);
router.delete("/doctype/:id", requireSuperAdmin, docType.remove);

router.post("/categories", requireSuperAdmin, validate(documentCategoriesDto.DocumentCategoryDto), documentCategories.create);
router.get("/categories", documentCategories.list);
router.get("/categories/:id", documentCategories.getById);
router.put("/categories/:id", requireSuperAdmin, validate(documentCategoriesDto.DocumentCategoryDto), documentCategories.update);
router.delete("/categories/:id", requireSuperAdmin, documentCategories.remove);

export default router;
