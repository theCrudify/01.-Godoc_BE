import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

// id_section_manufacture (== null / typeof number) & panjang line tetap dicek di service.
export const LineDto = z.looseObject({
  line: present<string>("Line Name"),
});
export type LineDto = z.infer<typeof LineDto>;
