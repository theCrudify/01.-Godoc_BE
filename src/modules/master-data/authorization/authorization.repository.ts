import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_authorization & mst_role — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_authorization.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        department: { select: { department_name: true } },
        section: { select: { section_name: true } },
        plant: { select: { plant_code: true } },
        role: { select: { role_name: true } },
      },
    }),
    prismaDB2.mst_authorization.count({ where }),
  ]);

export const findActiveByIdWithRelations = (id: number) =>
  prismaDB2.mst_authorization.findFirst({
    where: { id, is_deleted: false },
    include: { department: true, section: true, plant: true, role: true },
  });

export const findActiveById = (id: number) => prismaDB2.mst_authorization.findFirst({ where: { id, is_deleted: false } });

export const findActiveByEmployeeCode = (employee_code: any) =>
  prismaDB2.mst_authorization.findFirst({ where: { employee_code, is_deleted: false } });

export const create = (data: any) => prismaDB2.mst_authorization.create({ data });

export const update = (id: number, data: any) => prismaDB2.mst_authorization.update({ where: { id }, data });

export const findRolePage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_role.findMany({ where, skip, take, orderBy }),
    prismaDB2.mst_role.count({ where }),
  ]);
