import { z } from "zod";
import { present, zId } from "../../shared/middleware/validate";

export const ListDocumentNumbersQuery = z.looseObject({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  auth_id: zId.optional(),
});
export type ListDocumentNumbersQuery = z.infer<typeof ListDocumentNumbersQuery>;

export const DocumentNumberIdParams = z.object({ id: zId });

export const CreateDocumentNumberDto = z.looseObject({
  klasifikasi_document: present<string>("Klasifikasi Document"),
  line_code: present<string>("Line Code"),
  section_code: present<string>("Section Code"),
  department_code: present<string>("Department Code"),
  development_code: present<string>("Development Code"),
  plant_id: present<number>("Plant ID"),
  area_id: present<number>("Area ID"),
  category_id: present<number>("Category ID"),
  section_id: present<number>("Section ID"),
  auth_id: present<number>("Auth ID"),
  created_by: present<string>("Created By"),
  created_date: present<string | number>("Created Date"),
  id_proposed_header: z.any().optional(),
  sub_document: z.any().optional(),
  is_internal_memo: z.any().optional(),
  is_surat_ketentuan: z.any().optional(),
});
export type CreateDocumentNumberDto = z.infer<typeof CreateDocumentNumberDto>;
