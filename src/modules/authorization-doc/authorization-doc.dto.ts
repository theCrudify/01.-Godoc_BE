import { z } from "zod";

// Semua cek wajib/format di modul ini punya body error khusus (mis. "Missing fields: a, b",
// "ID must be a valid number"), jadi tetap di service. DTO di sini hanya mendeskripsikan input
// tanpa menolak apa pun, supaya respons tidak berubah.

const any = z.any().optional();

export const ListAuthDocQuery = z.looseObject({
  page: any,
  limit: any,
  search: any,
  sort: any,
  direction: any,
  status: any,
  plant_id: any,
  department_id: any,
  section_department_id: any,
  created_by: any,
  progress: any,
  change_type: any,
  need_engineering_approval: any,
  need_production_approval: any,
  auth_id: any,
});
export type ListAuthDocQuery = z.infer<typeof ListAuthDocQuery>;

export const IdParams = z.looseObject({ id: z.string() });

export const CreateAuthDocDto = z.looseObject({
  proposed_change_id: any,
  doc_number: any,
  implementation_date: any,
  evaluation: any,
  description: any,
  conclution: any,
  concept: any,
  standart: any,
  method: any,
  status: any,
  created_by: any,
  auth_id: any,
  plant_id: any,
  department_id: any,
  section_department_id: any,
  members: any,
});
export type CreateAuthDocDto = z.infer<typeof CreateAuthDocDto>;

export const UpdateAuthDocDto = z.looseObject({
  ...CreateAuthDocDto.shape,
  progress: any,
  note: any,
  deleted_member_ids: any,
});
export type UpdateAuthDocDto = z.infer<typeof UpdateAuthDocDto>;
