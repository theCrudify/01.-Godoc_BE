import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_line — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_line.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        section_manufacture: {
          select: {
            section_name: true,
            department: {
              select: {
                department_name: true,
                plant: { select: { plant_name: true, plant_code: true } },
              },
            },
          },
        },
      },
    }),
    prismaDB2.mst_line.count({ where }),
  ]);

export const findActiveById = (id: number) =>
  prismaDB2.mst_line.findUnique({
    where: { id, is_deleted: false },
    include: { section_manufacture: true },
  });

export const findSectionById = (id: any) => prismaDB2.mst_section_department.findUnique({ where: { id } });

export const findByNameInSection = (line: any, id_section_manufacture: any) =>
  prismaDB2.mst_line.findFirst({ where: { line, id_section_manufacture } });

export const create = (data: any) => prismaDB2.mst_line.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_line.update({ where: { id }, data });
