import bcrypt from "bcryptjs";
import { HttpError } from "../../shared/utils/http-error";
import * as repo from "./users.repository";

export async function list() {
  const users = await repo.findActiveUsers();
  if (users.length === 0) throw new HttpError(404, { error: "No users found" });
  return users;
}

export async function getById(userId: number) {
  const user = await repo.findActiveById(userId);
  if (!user) throw new HttpError(404, { error: "User not found or has been deleted" });
  return user;
}

export async function create(body: any) {
  const { employee_code, employee_name, username, phone_number, email, password } = body;

  const missingFields = [];
  if (!employee_code) missingFields.push("employee_code");
  if (!employee_name) missingFields.push("employee_name");
  if (!username) missingFields.push("username");
  if (!email) missingFields.push("email");
  if (!password) missingFields.push("password");
  if (!phone_number) missingFields.push("phone_number");

  if (missingFields.length > 0) {
    throw new HttpError(400, { error: "The following fields are required", missingFields });
  }

  if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, { error: "Password must be at least 8 characters long, with at least one uppercase letter and one number" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const existingUser = await repo.findDuplicate({ employee_code, username, email, phone_number });
  if (existingUser) {
    const errors: Record<string, string> = {};
    if (existingUser.employee_code === employee_code) errors.employee_code = "Employee code already exists";
    if (existingUser.username === username) errors.username = "Username already exists";
    if (existingUser.email === email) errors.email = "Email already exists";
    if (existingUser.phone_number === phone_number) errors.phone_number = "Phone number already exists";
    throw new HttpError(400, { error: "Duplicate data found", errors });
  }

  return repo.create({
    employee_code,
    employee_name,
    username,
    phone_number,
    email,
    password: hashedPassword,
  });
}

export async function update(userId: number, body: any) {
  const { username, email } = body;

  if (!(await repo.findById(userId))) throw new HttpError(404, { error: "User not found" });

  const userWithSameData = await repo.findOtherWithUsernameOrEmail(userId, username, email);
  if (userWithSameData) {
    if (userWithSameData.username === username && userWithSameData.email === email) {
      throw new HttpError(400, { error: "Username and email already exist" });
    } else if (userWithSameData.username === username) {
      throw new HttpError(400, { error: "Username already exists" });
    } else if (userWithSameData.email === email) {
      throw new HttpError(400, { error: "Email already exists" });
    }
  }

  return repo.update(userId, { username, email });
}

export async function remove(userId: number) {
  if (!(await repo.findById(userId))) throw new HttpError(404, { error: "User not found" });
  await repo.deleteById(userId);
}

export async function softDelete(userId: number) {
  const updatedUser = await repo.softDeleteActive(userId);
  if (updatedUser.count === 0) throw new HttpError(404, { error: "User not found or already deleted" });
}

export async function listEmployees(query: any) {
  const page = Number(query.page) || 1;
  const limit = 10;
  const searchTerm = (query.search as string) || "";
  const code = (query.code as string) || "";
  const name = (query.name as string) || "";

  const whereCondition: any = { AND: [] };

  if (searchTerm) {
    whereCondition.OR = [
      { employee_code: { contains: searchTerm } },
      { employee_name: { contains: searchTerm } },
    ];
  }
  if (code) whereCondition.AND.push({ employee_code: { equals: code } });
  if (name) whereCondition.AND.push({ employee_name: { contains: name } });

  const [employees, totalCount] = await repo.findEmployeePage(whereCondition, (page - 1) * limit, limit);

  const totalPages = Math.ceil(totalCount / limit);
  return {
    data: employees,
    pagination: {
      totalCount,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
