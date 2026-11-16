import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

// department_id (== null / typeof number) & panjang section_name tetap dicek di service.
export const SectionDepartmentDto = z.looseObject({
  section_name: present<string>("Section Name"),
});
export type SectionDepartmentDto = z.infer<typeof SectionDepartmentDto>;
