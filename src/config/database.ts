import { PrismaClient as PrismaClientDB1 } from "../../prisma/generated/db1";
import { PrismaClient as PrismaClientDB2 } from "../../prisma/generated/db2";
import * as dotenv from "dotenv";

// Load environment-specific configuration
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env.development';

dotenv.config({ path: envFile });

// Fallback to default .env if environment-specific file doesn't exist
if (!process.env.DATABASE_URL_1 || !process.env.DATABASE_URL_2) {
  dotenv.config();
}

const prismaDB1 = new PrismaClientDB1({
  datasources: { db: { url: process.env.DATABASE_URL_1 } },
  log: nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
});

const prismaDB2 = new PrismaClientDB2({
  datasources: { db: { url: process.env.DATABASE_URL_2 } },
  log: nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
});

export { prismaDB1, prismaDB2 };
