import rateLimit from "express-rate-limit";
import express from "express";
import * as controller from "./auth.controller";

const router = express.Router();

// Batasi percobaan login per IP (anti brute-force); lockout per-username di service tetap ada
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

// Validasi input login (uname/username) bersifat lintas-field dan harus setelah cek lockout → tetap di service.
router.post("/loginUserGodoc", loginLimiter, controller.loginUserGodoc);

export default router;
