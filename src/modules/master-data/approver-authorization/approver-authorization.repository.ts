import { prismaDB2 } from "../../../shared/config/database";
import { Prisma } from "../../../../prisma/generated/db2";

// Akses data mst_template_approval_authorization — hanya query Prisma, tanpa logika bisnis.

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
    prismaDB2.mst_template_approval_authorization.findMany({ where, orderBy, skip, take, include: withSection }),
    prismaDB2.mst_template_approval_authorization.count({ where }),
  ]);

export const findActiveByIdWithSection = (id: number) =>
  prismaDB2.mst_template_approval_authorization.findFirst({ where: { id, is_deleted: false }, include: withSection });

export const findActiveById = (id: number) =>
  prismaDB2.mst_template_approval_authorization.findFirst({ where: { id, is_deleted: false } });

export const findFirst = (where: any, client: Client = prismaDB2) =>
  client.mst_template_approval_authorization.findFirst({ where });

export const transaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => prismaDB2.$transaction(fn);

export const createWithSection = (data: any, client: Client = prismaDB2) =>
  client.mst_template_approval_authorization.create({ data, include: withSection });

export const create = (data: any, client: Client = prismaDB2) =>
  client.mst_template_approval_authorization.create({ data });

export const updateByIdWithSection = (id: number, data: any) =>
  prismaDB2.mst_template_approval_authorization.update({ where: { id }, data, include: withSection });

export const updateById = (id: number, data: any) =>
  prismaDB2.mst_template_approval_authorization.update({ where: { id }, data });

export const findActiveByTemplateName = (template_name: string) =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { template_name, is_deleted: false, is_active: true },
    orderBy: [{ is_insert_step: "asc" }, { step_order: "asc" }],
    include: withSection,
  });

export const findDefaultTemplatesWithSection = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { line_code: null, is_insert_step: false, is_active: true, is_deleted: false },
    orderBy: { step_order: "asc" },
    include: withSection,
  });

export const findInsertStepsWithSection = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { is_insert_step: true, is_active: true, is_deleted: false },
    include: withSection,
  });

export const findInsertStepsOrdered = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { is_insert_step: true, is_active: true, is_deleted: false },
    orderBy: [{ insert_after_step: "asc" }, { priority: "desc" }],
    include: withSection,
  });

export const findDefaultTemplates = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { line_code: null, is_insert_step: false, is_active: true, is_deleted: false },
    orderBy: { step_order: "asc" },
  });

export const findInsertSteps = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { is_insert_step: true, is_active: true, is_deleted: false },
  });

export const findUniqueTemplateNames = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { is_deleted: false, is_active: true },
    select: { template_name: true },
    distinct: ["template_name"],
    orderBy: { template_name: "asc" },
  });

export const findActiveAppliesToLines = () =>
  prismaDB2.mst_template_approval_authorization.findMany({
    where: { is_deleted: false, is_active: true },
    select: { applies_to_lines: true },
  });
