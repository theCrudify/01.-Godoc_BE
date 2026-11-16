import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

export const CreateDepartmentDto = z.looseObject({
  department_name: present<string>("Department Name"),
});
export type CreateDepartmentDto = z.infer<typeof CreateDepartmentDto>;

export const UpdateDepartmentDto = CreateDepartmentDto;
export type UpdateDepartmentDto = z.infer<typeof UpdateDepartmentDto>;
