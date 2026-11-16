import express from "express";
import { verifyToken, requireSuperAdmin } from "../../shared/middleware/authMiddleware";
import { validateUserInput } from "../../shared/middleware/validationMiddleware";
import { validate } from "../../shared/middleware/validate";
import { UserIdParams } from "./users.dto";
import * as controller from "./users.controller";

const router = express.Router();
const idParams = validate(UserIdParams, "params");

// Employee
router.get("/employees", verifyToken, controller.getEmployees); // /api/users/employees

// Users (Super Admin)
router.get("/", verifyToken, requireSuperAdmin, controller.getUsers);
router.get("/:id", verifyToken, requireSuperAdmin, idParams, controller.getUser);
router.post("/", verifyToken, requireSuperAdmin, validateUserInput, controller.createUser);
router.put("/:id", verifyToken, requireSuperAdmin, validateUserInput, idParams, controller.updateUser);
router.delete("/:id", verifyToken, requireSuperAdmin, idParams, controller.deleteUser);
router.delete("/soft/:id", verifyToken, requireSuperAdmin, idParams, controller.softDeleteUser);

export default router;
