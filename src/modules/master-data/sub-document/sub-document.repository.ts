import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_sub_document — hanya query Prisma.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_sub_document.findMany({ where, skip, take, orderBy }),
    prismaDB2.mst_sub_document.count({ where }),
  ]);

export const findById = (id: number) => prismaDB2.mst_sub_document.findUnique({ where: { id } });

export const create = (data: any) => prismaDB2.mst_sub_document.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_sub_document.update({ where: { id }, data });

export const deleteById = (id: number) => prismaDB2.mst_sub_document.delete({ where: { id } });
