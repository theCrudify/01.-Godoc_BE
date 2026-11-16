import "./shared/config/env"; // muat env sebelum modul lain
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";

import userRoutes from "./modules/users/users.routes";
import LoginApps from "./modules/auth/auth.routes";
import MasterData from "./modules/master-data/master-data.routes";

import DocumentNumbers from "./modules/document-number/document-number.routes";
import ProposedChanges from "./modules/proposed-changes/proposed-changes.routes";
import AdditionalDoc from "./modules/additional-doc/additional-doc.routes";
import AuthDoc from "./modules/authorization-doc/authorization-doc.routes";
import Handover from "./modules/handover/handover.routes";
import mappingdashboard from "./modules/dashboard/dashboard.routes";


import { errorHandler } from "./shared/middleware/errorMiddleware";
import { prismaDB1, prismaDB2 } from "./shared/config/database";
import { verifyToken } from "./shared/middleware/authMiddleware";

import * as dotenv from "dotenv";


// Load environment variables
const nodeEnv = process.env.NODE_ENV || "development";
const envFile = nodeEnv === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });
dotenv.config();

// ~800 console.log di jalur request memperlambat produksi; set LOG_VERBOSE=true untuk menyalakan lagi
if (nodeEnv === "production" && process.env.LOG_VERBOSE !== "true") {
  console.log = () => {};
  console.debug = () => {};
}

// Initialize Express app
const app = express();
// Production ada di belakang reverse proxy (/godoc-api); tanpa ini rate-limit login melihat semua user sebagai 1 IP
app.set("trust proxy", 1);
const PORT = process.env.PORT || 7777;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:4200";

// Middleware: Body parsing & security
app.use(express.json()); // Parsing JSON
app.use(cors({ origin: CORS_ORIGIN })); // CORS policy
app.use(helmet()); // Enhanced security
app.use(compression()); // Gzip JSON responses
app.use(morgan("dev")); // Logging HTTP requests

// API Routes
app.get("/", (req, res) => {
  res.send("🚀 Server is running!");
});

app.use("/api/users", userRoutes, LoginApps);

app.use("/api/", verifyToken, MasterData); // All Master

app.use("/api/",verifyToken, DocumentNumbers, ProposedChanges, AdditionalDoc, AuthDoc, Handover, mappingdashboard); //Activity Pag

// Global Error Handling Middleware
app.use(errorHandler);

// Start the server
const server = app.listen(PORT, async () => {
  try {
    await prismaDB1.$connect();
    await prismaDB2.$connect();
    console.info(`✅ Database connected successfully`);
  } catch (error) {
    console.error(`❌ Database connection failed:`, error);
  }

  console.info(`✅ Server running at http://localhost:${PORT}`);
});

// Graceful shutdown handling (Menutup Prisma saat server berhenti)
const shutdown = async (signal: string) => {
  console.info(`\n🔻 Received ${signal}. Closing server gracefully...`);
  await prismaDB1.$disconnect();
  await prismaDB2.$disconnect();
  server.close(() => {
    console.info("✅ Server shut down cleanly.");
    process.exit(0);
  });
};

// Promise yang gagal tanpa catch tidak boleh mematikan seluruh server (default Node >= 15)
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

// Menangani sinyal penghentian proses
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});

console.log("Jidan was here, thanks btw!"); // Tambahan buat seru-seruan aja 😆
