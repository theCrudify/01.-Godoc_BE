import { prismaDB1 } from "../../shared/config/database";

// Akses data mst_user / mst_employment — hanya query Prisma, tanpa logika bisnis.

export const findActiveUsers = () =>
  prismaDB1.mst_user.findMany({
    where: { is_deleted: false },
    select: { user_id: true, username: true, email: true, created_at: true },
  });

export const findActiveById = (userId: number) =>
  prismaDB1.mst_user.findFirst({
    where: { user_id: userId, is_deleted: false },
    omit: { password: true }, // jangan pernah kirim hash password ke client
  });

export const findById = (userId: number) => prismaDB1.mst_user.findUnique({ where: { user_id: userId } });

export const findDuplicate = (filter: { employee_code: any; username: any; email: any; phone_number: any }) =>
  prismaDB1.mst_user.findFirst({
    where: {
      OR: [
        { employee_code: filter.employee_code },
        { username: filter.username },
        { email: filter.email },
        { phone_number: filter.phone_number },
      ],
    },
    select: { employee_code: true, username: true, email: true, phone_number: true },
  });

export const create = (data: any) =>
  prismaDB1.mst_user.create({
    data,
    select: {
      user_id: true,
      employee_code: true,
      employee_name: true,
      username: true,
      phone_number: true,
      email: true,
      created_at: true,
    },
  });

export const findOtherWithUsernameOrEmail = (userId: number, username: any, email: any) =>
  prismaDB1.mst_user.findFirst({
    where: {
      OR: [{ username }, { email }],
      NOT: { user_id: userId },
    },
  });

export const update = (userId: number, data: { username: any; email: any }) =>
  prismaDB1.mst_user.update({ where: { user_id: userId }, data });

export const deleteById = (userId: number) => prismaDB1.mst_user.delete({ where: { user_id: userId } });

export const softDeleteActive = (userId: number) =>
  prismaDB1.mst_user.updateMany({
    where: { user_id: userId, is_deleted: false },
    data: { is_deleted: true },
  });

export const findEmployeePage = (where: any, skip: number, take: number) =>
  Promise.all([
    prismaDB1.mst_user.findMany({
      where,
      skip,
      take,
      select: {
        user_id: true,
        employee_code: true,
        employee_name: true,
        email: true,
        phone_number: true,
      },
      orderBy: { employee_name: "asc" },
    }),
    prismaDB1.mst_employment.count({ where }),
  ]);
