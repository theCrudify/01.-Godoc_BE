import * as dotenv from "dotenv";

// Harus jadi import pertama di server.ts: file env per-environment menang, .env hanya fallback.
// (dotenv tidak menimpa variabel yang sudah ter-set, jadi dotenv.config() di modul lain jadi no-op)
const nodeEnv = process.env.NODE_ENV || "development";
dotenv.config({ path: nodeEnv === "production" ? ".env.production" : ".env.development" });
dotenv.config();
