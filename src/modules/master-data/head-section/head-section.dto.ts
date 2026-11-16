import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

export const CreateHeadSectionDto = z.looseObject({
  authorization_id: present<number>("Authorization ID"),
  section_id: present<number>("Section ID"),
});
export type CreateHeadSectionDto = z.infer<typeof CreateHeadSectionDto>;
