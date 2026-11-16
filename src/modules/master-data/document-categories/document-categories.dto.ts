import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

// Batas panjang & tipe status tetap dicek di service (format error lama: { errors: [...] }).
export const DocumentCategoryDto = z.looseObject({
  category: present<string>("Categories Doc"),
});
export type DocumentCategoryDto = z.infer<typeof DocumentCategoryDto>;
