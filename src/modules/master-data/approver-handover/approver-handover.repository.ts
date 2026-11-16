import { prismaDB2 } from "../../../shared/config/database";
import { Prisma } from "../../../../prisma/generated/db2";

// Akses data mst_template_approval_handover — hanya query Prisma, tanpa logika bisnis.

type Client = Prisma.TransactionClient | typeof prismaDB2;

const withSection = {
  section_department: {
    select: {
      id: true,
      section_name: true,
      department: { select: { id: true, department_name: true } },
    },
  },
} as const;

export const findPage = (where: any, orderBy: any, skip: number, take: number) =>
  Promise.all([
    prismaDB2.mst_template_approval_handover.findMany({ where, orderBy, skip, take, include: withSection }),
    prismaDB2.mst_template_approval_handover.count({ where }),
  ]);

export const findActiveByIdWithSection = (id: number) =>
  prismaDB2.mst_template_approval_handover.findFirst({ where: { id, is_deleted: false }, include: withSection });

export const findActiveById = (id: number) =>
  prismaDB2.mst_template_approval_handover.findFirst({ where: { id, is_deleted: false } });

export const findFirst = (where: any, client: Client = prismaDB2) =>
  client.mst_template_approval_handover.findFirst({ where });

export const transaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prismaDB2.$transaction(fn);

export const createWithSection = (data: any, client: Client = prismaDB2) =>
  client.mst_template_approval_handover.create({ data, include: withSection });

export const create = (data: any, client: Client = prismaDB2) =>
  client.mst_template_approval_handover.create({ data });

export const updateByIdWithSection = (id: number, data: any) =>
  prismaDB2.mst_template_approval_handover.update({ where: { id }, data, include: withSection });

export const updateById = (id: number, data: any) =>
  prismaDB2.mst_template_approval_handover.update({ where: { id }, data });

export const findActiveByTemplateName = (template_name: string) =>
  prismaDB2.mst_template_approval_handover.findMany({
    where: { template_name, is_deleted: false, is_active: true },
    orderBy: [{ is_insert_step: "asc" }, { step_order: "asc" }],
    include: withSection,
  });

export const findDefaultTemplatesWithSection = () =>
  prismaDB2.mst_template_approval_handover.findMany({
    where: { line_code: null, is_insert_step: false, is_active: true, is_deleted: false },
    orderBy: { step_order: "asc" },
    include: withSection,
  });

export const findInsertStepsWithSection = () =>
  prismaDB2.mst_template_approval_handover.findMany({
    where: { is_insert_step: true, is_active: true, is_deleted: false },
    include: withSection,
  });
