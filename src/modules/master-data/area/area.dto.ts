import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

// Panjang area/code_area & tipe id_line tetap dicek di service. Update tidak pernah memvalidasi body.
export const CreateAreaDto = z.looseObject({
  area: present<string>("Area Name"),
  code_area: present<string>("Code Area"),
});
export type CreateAreaDto = z.infer<typeof CreateAreaDto>;
