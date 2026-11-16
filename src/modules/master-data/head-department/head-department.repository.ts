import { prismaDB2 } from "../../../shared/config/database";

// Akses data mst_department_head — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number, orderBy: any) =>
  Promise.all([
    prismaDB2.mst_department_head.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        authorization: { select: { id: true, employee_code: true, employee_name: true, status: true } },
        section: {
          select: { id: true, department_id: true, section_name: true, department: { select: { department_name: true } } },
        },
      },
    }),
    prismaDB2.mst_department_head.count({ where }),
  ]);

export const findById = (id: number) => prismaDB2.mst_department_head.findUnique({ where: { id } });

export const findAuthorizationById = (id: any) => prismaDB2.mst_authorization.findUnique({ where: { id } });

export const findSectionById = (id: any) => prismaDB2.mst_section_department.findUnique({ where: { id } });

export const findByAuthorizationAndSection = (authorization_id: any, section_id: any) =>
  prismaDB2.mst_department_head.findFirst({ where: { authorization_id, section_id } });

export const findOtherActiveBySection = (section_id: any, id: number) =>
  prismaDB2.mst_department_head.findFirst({ where: { section_id, is_deleted: false, NOT: { id } } });

export const create = (data: any) =>
  prismaDB2.mst_department_head.create({
    data,
    include: {
      authorization: { select: { employee_code: true, employee_name: true, status: true } },
      section: { select: { department_id: true, section_name: true } },
    },
  });

export const update = (id: number, data: any) => prismaDB2.mst_department_head.update({ where: { id }, data });
