import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

// Batas panjang & tipe status tetap dicek di service (format error lama: { errors: [...] }).
export const SupportDocumentDto = z.looseObject({
  document_type: present<string>("Document type"),
});
export type SupportDocumentDto = z.infer<typeof SupportDocumentDto>;
