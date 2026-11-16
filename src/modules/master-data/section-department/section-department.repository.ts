import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_section_department — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_section_department.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        department: {
          select: {
            department_name: true,
            department_code: true,
            plant: { select: { plant_name: true, id: true } },
          },
        },
      },
    }),
    prismaDB2.mst_section_department.count({ where }),
  ]);

export const findActiveById = (id: number) =>
  prismaDB2.mst_section_department.findUnique({
    where: { id, is_deleted: false },
    include: { department: true },
  });

export const findDepartmentById = (id: any) => prismaDB2.mst_department.findUnique({ where: { id } });

export const findByNameInDepartment = (section_name: any, department_id: any) =>
  prismaDB2.mst_section_department.findFirst({ where: { section_name, department_id } });

export const create = (data: any) => prismaDB2.mst_section_department.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_section_department.update({ where: { id }, data });
