import { prismaDB2 } from "../../../shared/config/database";
import { Prisma } from "../../../../prisma/generated/db2";

// Akses data mst_template_approval_proposedchanges — hanya query Prisma, tanpa logika bisnis.

type Client = Prisma.TransactionClient | typeof prismaDB2;

export const findPage = (where: any, orderBy: any, skip: number, take: number) =>
  Promise.all([
    prismaDB2.mst_template_approval_proposedchanges.findMany({ where, orderBy, skip, take }),
    prismaDB2.mst_template_approval_proposedchanges.count({ where }),
  ]);

export const findActiveById = (id: number) =>
  prismaDB2.mst_template_approval_proposedchanges.findFirst({ where: { id, is_deleted: false } });

export const findFirst = (where: any, client: Client = prismaDB2) =>
  client.mst_template_approval_proposedchanges.findFirst({ where });

export const create = (data: any, client: Client = prismaDB2) =>
  client.mst_template_approval_proposedchanges.create({ data });

export const updateById = (id: number, data: any) =>
  prismaDB2.mst_template_approval_proposedchanges.update({ where: { id }, data });

export const transaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prismaDB2.$transaction(fn);

export const findActiveByTemplateName = (template_name: string) =>
  prismaDB2.mst_template_approval_proposedchanges.findMany({
    where: { template_name, is_deleted: false, is_active: true },
    orderBy: { step_order: "asc" },
  });

export const findActiveByLineCode = (line_code: string) =>
  prismaDB2.mst_template_approval_proposedchanges.findMany({
    where: { line_code, is_deleted: false, is_active: true },
    orderBy: [{ template_name: "asc" }, { step_order: "asc" }],
  });
