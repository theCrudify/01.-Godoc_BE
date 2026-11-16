import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

export const CreateHeadDepartmentDto = z.looseObject({
  authorization_id: present<number>("Authorization ID"),
  section_id: present<number>("Section ID"),
});
export type CreateHeadDepartmentDto = z.infer<typeof CreateHeadDepartmentDto>;
