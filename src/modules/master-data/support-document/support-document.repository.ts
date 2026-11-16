import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_support_document — hanya query Prisma.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_support_document.findMany({ where, skip, take, orderBy }),
    prismaDB2.mst_support_document.count({ where }),
  ]);

export const findAllActive = () => prismaDB2.mst_support_document.findMany({ where: { is_deleted: 0 } });

export const findActiveById = (id: number) =>
  prismaDB2.mst_support_document.findUnique({ where: { id, is_deleted: 0 } });

export const findByDocumentType = (document_type: any) =>
  prismaDB2.mst_support_document.findFirst({ where: { document_type } });

export const create = (data: any) => prismaDB2.mst_support_document.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_support_document.update({ where: { id }, data });
