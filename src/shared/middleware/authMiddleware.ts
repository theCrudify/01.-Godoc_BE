import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("❌ JWT_SECRET is not defined in environment variables!");

// Extend Express Request
interface AuthenticatedRequest extends Request {
  user?: any;
}

export const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(403).json({ error: "Unauthorized: No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = decoded; // ← Simpan ke req.user (bukan `as any`)
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

// Cek role dari JWT (bukan dari body). Super Admin = global; Admin = admin area; lainnya = user biasa.
export const requireRole = (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (roles.includes(req.user?.role?.role_name)) {
      next();
      return;
    }
    res.status(403).json({ error: "Forbidden: insufficient role" });
  };

// Master data & manajemen user: hanya Super Admin (sesuai menu FE)
export const requireSuperAdmin = requireRole("Super Admin");

// Approval: identitas approver selalu dari JWT, supaya user tidak bisa approve atas nama orang lain
export const bindApproverFromToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.auth_id) {
    res.status(403).json({ error: "Forbidden: token has no authorization id" });
    return;
  }
  req.body = { ...req.body, auth_id: req.user.auth_id, employee_code: req.user.nik };
  next();
};
