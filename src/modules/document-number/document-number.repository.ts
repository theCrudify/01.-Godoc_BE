import { prismaDB2 } from "../../shared/config/database";

// Akses data tr_document_number — hanya query Prisma, tanpa logika bisnis.

export const findPage = (where: any, skip: number, take: number) =>
  prismaDB2.$transaction([
    prismaDB2.tr_document_number.findMany({
      where,
      skip,
      take,
      orderBy: { created_date: "desc" },
      include: {
        category: true,
        plant: true,
        area: { include: { line: true } },
        section: true,
        authorization: true,
      },
    }),
    prismaDB2.tr_document_number.count({ where }),
  ]);

export const findByIdWithRelations = (id: number) =>
  prismaDB2.tr_document_number.findUnique({
    where: { id },
    include: {
      plant: true,
      area: { include: { line: true } },
      category: true,
    },
  });

export const findById = (id: number) => prismaDB2.tr_document_number.findUnique({ where: { id } });

export const findLastRunningNumber = () =>
  prismaDB2.tr_document_number.findFirst({
    orderBy: { running_number: "desc" },
    select: { running_number: true },
  });

export const findLastRunningNumberInSection = (filter: { line_code: any; section_code: any; plant_id: any; area_id: any }) =>
  prismaDB2.tr_document_number.findFirst({
    where: filter,
    orderBy: { running_number: "desc" },
    select: { running_number: true },
  });

export const create = (data: any) => prismaDB2.tr_document_number.create({ data });

export const deleteById = (id: number) => prismaDB2.tr_document_number.delete({ where: { id } });
