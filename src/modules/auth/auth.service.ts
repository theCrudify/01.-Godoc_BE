import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./auth.repository";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;

if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET is not defined in environment variables!");
}
if (!JWT_EXPIRATION) {
  throw new Error("❌ JWT_EXPIRATION is not defined in environment variables!");
}

type UserType = {
  user_id: number;
  username: string | null;
  email: string | null;
  password?: string | null; // Password mungkin null jika dari bypass
  employee_code: string;
  employee_name: string | null;
} | null;

const parsedExpiration: SignOptions["expiresIn"] = /^\d+$/.test(JWT_EXPIRATION)
  ? Number(JWT_EXPIRATION)
  : (JWT_EXPIRATION as SignOptions["expiresIn"]);

// Lockout per-username (di memori proses)
const loginAttempts = new Map<string, { count: number; timer?: NodeJS.Timeout; blockUntil?: number }>();

export async function login(body: any) {
  const { uname, username: empCode, password } = body;
  const key = empCode || uname;

  // --- Blokir sementara ---
  if (loginAttempts.get(key)?.blockUntil && Date.now() < loginAttempts.get(key)!.blockUntil!) {
    console.warn(`⚠️ User ${key} is blocked due to excessive login attempts.`);
    throw new HttpError(429, { error: "Too Many Attempts", details: "Your account is temporarily blocked. Please try again later." });
  }

  // --- Validasi input (lintas-field, setelah cek blokir) ---
  if (!empCode && !uname) {
    console.warn("⚠️ Missing required fields: 'uname' or 'username'");
    throw new HttpError(400, { error: "Employee code or username is required", details: "Both 'uname' and 'username' (employee code) are missing." });
  }

  // --- Tahap 1: Exact Match ---
  let user: UserType = await repo.findUserByCodeOrUsername(empCode, uname);

  // --- Tahap 2: employee code dengan padding, hanya jika input empCode < 5 karakter ---
  if (!user && empCode && empCode.length > 0 && empCode.length < 5) {
    const paddedCode = empCode.padStart(5, "0");
    console.log(`ℹ️ User not found with exact code '${empCode}'. Trying padded code: '${paddedCode}'`);

    const potentialUser = await repo.findUserByEmployeeCode(paddedCode);

    if (potentialUser) {
      // Jika kode di DB mulai '00' dan input TIDAK mulai '0', tolak.
      if (potentialUser.employee_code.startsWith("00") && !empCode.startsWith("0")) {
        console.warn(`⚠️ Found user with padded code '${paddedCode}', but original input '${empCode}' is invalid for a code starting with '00'. Rejecting.`);
      } else if (potentialUser.employee_code.length === 5 && potentialUser.employee_code.startsWith("0")) {
        console.log(`✅ Found user using padded code '${paddedCode}' from input '${empCode}'. Accepting.`);
        user = potentialUser;
      } else {
        console.log(`ℹ️ Found user with padded code '${paddedCode}', but the stored code is not 5 digits starting with '0'. Ignoring.`);
      }
    } else {
      console.log(`ℹ️ Padded code '${paddedCode}' also not found.`);
    }
  }

  if (!user) {
    handleFailedLogin(key);
    console.warn(`⚠️ User Not Found: ${key} (after exact match, padding attempt, and bypass check)`);
    throw new HttpError(404, { error: "User Not Found", details: "User not found with provided credentials or matching criteria." });
  }

  const auth = await repo.findAuthorization(user.employee_code, user.employee_name);

  if (!auth) {
    handleFailedLogin(key);
    console.warn(`⚠️ Authorization data missing for user: ${user.employee_code}`);
    throw new HttpError(404, { error: "Authorization Not Found", details: "Authorization data not found for the user." });
  }

  let isPasswordValid = false;
  if (user.password) {
    isPasswordValid = await bcrypt.compare(password, user.password);
  }

  if (!isPasswordValid) {
    handleFailedLogin(key);
    console.warn(`⚠️ Invalid Credentials for user: ${user.employee_code}`);
    throw new HttpError(401, { error: "Invalid Credentials", details: "Incorrect password." });
  }

  resetLoginAttempts(key);

  const payload = {
    auth_id: auth.id,
    nik: user.employee_code,
    name: user.employee_name,
    email: user.email,
    role: auth.role,
    department: auth.department,
    site: auth.plant,
    section: auth.section,
  };
  const token = jwt.sign(payload, JWT_SECRET!, { expiresIn: parsedExpiration });
  const cookieMaxAge = convertExpirationToMs(JWT_EXPIRATION!);

  console.log(`✅ Login successful: ${user.employee_code}`);
  return { data: payload, token, cookieMaxAge };
}

const convertExpirationToMs = (expiration: string): number => {
  try {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error("❌ Invalid JWT_EXPIRATION format!");

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s": return value * 1000;
      case "m": return value * 60 * 1000;
      case "h": return value * 60 * 60 * 1000;
      case "d": return value * 24 * 60 * 60 * 1000;
      default: throw new Error("❌ Invalid JWT_EXPIRATION format!");
    }
  } catch (error: any) {
    console.error("❌ Expiration Conversion Error:", error.message);
    throw error;
  }
};

const handleFailedLogin = (key: string) => {
  const attempt = loginAttempts.get(key) || { count: 0 };
  attempt.count += 1;
  loginAttempts.set(key, attempt);

  if (attempt.count >= 5 && !attempt.blockUntil) {
    attempt.blockUntil = Date.now() + 15 * 60 * 1000;
    console.warn(`⚠️ User ${key} exceeded login attempts. Blocked until ${new Date(attempt.blockUntil).toLocaleString()}`);
    attempt.timer = setTimeout(() => {
      attempt.count = 0;
      attempt.blockUntil = undefined;
      loginAttempts.set(key, attempt);
      console.log(` User ${key} login attempts unblocked.`);
    }, 15 * 60 * 1000);
    loginAttempts.set(key, attempt);
  }
};

const resetLoginAttempts = (key: string) => {
  const attempt = loginAttempts.get(key);
  if (attempt?.timer) clearTimeout(attempt.timer);
  loginAttempts.delete(key);
};
