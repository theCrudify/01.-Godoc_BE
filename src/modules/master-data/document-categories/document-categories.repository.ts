import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_document_categories — hanya query Prisma.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_document_categories.findMany({ where, skip, take, orderBy }),
    prismaDB2.mst_document_categories.count({ where }),
  ]);

export const findActiveById = (id: number) =>
  prismaDB2.mst_document_categories.findUnique({ where: { id, is_deleted: 0 } });

export const findByCategory = (category: any) =>
  prismaDB2.mst_document_categories.findFirst({ where: { category } });

export const create = (data: any) => prismaDB2.mst_document_categories.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_document_categories.update({ where: { id }, data });
