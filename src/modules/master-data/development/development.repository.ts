import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_development — hanya query Prisma.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_development.findMany({ where, skip, take, orderBy }),
    prismaDB2.mst_development.count({ where }),
  ]);

export const findActiveById = (id: number) =>
  prismaDB2.mst_development.findUnique({ where: { id, is_deleted: false } });

export const create = (data: any) => prismaDB2.mst_development.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_development.update({ where: { id }, data });
