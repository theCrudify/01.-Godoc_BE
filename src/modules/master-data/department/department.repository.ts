import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_department — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_department.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { plant: { select: { plant_code: true } } },
    }),
    prismaDB2.mst_department.count({ where }),
  ]);

export const findActiveById = (id: number) =>
  prismaDB2.mst_department.findUnique({ where: { id, is_deleted: false } });

export const findById = (id: number) => prismaDB2.mst_department.findUnique({ where: { id } });

export const findPlantById = (id: any) => prismaDB2.mst_plant.findUnique({ where: { id } });

export const findByCode = (department_code: any) =>
  prismaDB2.mst_department.findFirst({ where: { department_code } });

export const create = (data: any) => prismaDB2.mst_department.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_department.update({ where: { id }, data });
