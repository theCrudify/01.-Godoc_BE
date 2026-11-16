import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_doc_type — hanya query Prisma.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_doc_type.findMany({ where, skip, take, orderBy }),
    prismaDB2.mst_doc_type.count({ where }),
  ]);

export const findActiveById = (id: number) =>
  prismaDB2.mst_doc_type.findUnique({ where: { id, is_deleted: false } });

export const create = (data: any) => prismaDB2.mst_doc_type.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_doc_type.update({ where: { id }, data });
