import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_area — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_area.findMany({ where, skip, take, orderBy, include: { line: true } }),
    prismaDB2.mst_area.count({ where }),
  ]);

export const findByIdWithLine = (id: number) => prismaDB2.mst_area.findUnique({ where: { id }, include: { line: true } });

export const findById = (id: number) => prismaDB2.mst_area.findUnique({ where: { id } });

export const findLineById = (id: any) => prismaDB2.mst_line.findUnique({ where: { id } });

export const create = (data: any) => prismaDB2.mst_area.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_area.update({ where: { id }, data });
