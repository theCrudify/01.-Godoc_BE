import { prismaDB1, prismaDB2 } from "../../shared/config/database";

// Akses data login — hanya query Prisma, tanpa logika bisnis.

const userSelect = { user_id: true, username: true, email: true, password: true, employee_code: true, employee_name: true } as const;

export const findUserByCodeOrUsername = (empCode?: string, uname?: string) =>
  prismaDB1.mst_user.findFirst({
    where: {
      // Cari berdasarkan employee_code jika ada, ATAU username jika ada
      OR: [
        empCode ? { employee_code: empCode } : {},
        uname ? { username: uname } : {},
      ].filter((c) => Object.keys(c).length > 0),
      is_deleted: false,
    },
    select: userSelect,
  });

export const findUserByEmployeeCode = (employeeCode: string) =>
  prismaDB1.mst_user.findFirst({
    where: { employee_code: employeeCode, is_deleted: false },
    select: userSelect,
  });

export const findAuthorization = (employeeCode: string, employeeName: string | null) =>
  prismaDB2.mst_authorization.findFirst({
    where: { employee_code: employeeCode, employee_name: employeeName },
    include: {
      department: true,
      plant: true,
      role: true,
      section: true,
    },
  });
