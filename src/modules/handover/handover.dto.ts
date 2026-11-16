import { z } from "zod";

// Validasi lama handover menulis body error-nya sendiri (pesan gabungan / format khusus),
// jadi semua cek wajib tetap di service. DTO di sini hanya mendeskripsikan bentuk input.

export const CreateHandoverDto = z.looseObject({
  doc_number: z.any().optional(),
  auth_id: z.any().optional(),
  auth_id2: z.any().optional(),
  auth_id3: z.any().optional(),
  auth_id4: z.any().optional(),
  auth_id5: z.any().optional(),
  proposed_change_id: z.any().optional(),
  authdoc_id: z.any().optional(),
  plant_id: z.any().optional(),
  department_id: z.any().optional(),
  section_department_id: z.any().optional(),
  material: z.any().optional(),
  remark: z.any().optional(),
  status: z.any().optional(),
  created_by: z.any().optional(),
});
export type CreateHandoverDto = z.infer<typeof CreateHandoverDto>;

export const UpdateHandoverDto = z.looseObject({
  auth_id: z.any().optional(),
  created_by: z.any().optional(),
  updated_by: z.any().optional(),
  status: z.any().optional(),
  material: z.any().optional(),
  remark: z.any().optional(),
  note: z.any().optional(),
});
export type UpdateHandoverDto = z.infer<typeof UpdateHandoverDto>;

export const ListHandoversQuery = z.looseObject({
  page: z.any().optional(),
  limit: z.any().optional(),
  search: z.any().optional(),
  sort: z.any().optional(),
  direction: z.any().optional(),
  status: z.any().optional(),
  plant_id: z.any().optional(),
  department_id: z.any().optional(),
  section_department_id: z.any().optional(),
  created_by: z.any().optional(),
  progress: z.any().optional(),
  auth_id: z.any().optional(),
});
export type ListHandoversQuery = z.infer<typeof ListHandoversQuery>;

export const ListApproverHandoversQuery = ListHandoversQuery.extend({
  proposed_change_id: z.any().optional(),
  doc_number: z.any().optional(),
  approval_auth_id: z.any().optional(),
  id: z.any().optional(),
  approval_status: z.any().optional(),
  employee_code: z.any().optional(),
});
export type ListApproverHandoversQuery = z.infer<typeof ListApproverHandoversQuery>;

export const UpdateHandoverApprovalDto = z.looseObject({
  handover_id: z.any().optional(),
  auth_id: z.any().optional(),
  status: z.any().optional(),
  note: z.any().optional(),
  employee_code: z.any().optional(),
});
export type UpdateHandoverApprovalDto = z.infer<typeof UpdateHandoverApprovalDto>;
