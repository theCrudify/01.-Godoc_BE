import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_plant — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number) =>
  Promise.all([
    prismaDB2.mst_plant.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      select: {
        id: true, plant_name: true, plant_code: true, address: true,
        created_at: true, created_by: true, updated_at: true, updated_by: true,
      },
    }),
    prismaDB2.mst_plant.count({ where }),
  ]);

export const findById = (id: number) =>
  prismaDB2.mst_plant.findUnique({
    where: { id },
    select: {
      id: true, plant_code: true, plant_name: true, address: true,
      created_at: true, created_by: true, updated_at: true, updated_by: true,
      authorizations: { select: { id: true, role_id: true, plant_id: true } },
      departments: { select: { id: true, department_code: true, department_name: true } },
    },
  });
