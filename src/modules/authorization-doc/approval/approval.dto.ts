import { z } from "zod";

// Cek wajib & enum status punya body error khusus ({ error: "Bad Request", message }), jadi tetap di service.
// DTO hanya mendeskripsikan input tanpa menolak apa pun.

const any = z.any().optional();

export const OngoingAuthDocQuery = z.looseObject({
  page: any,
  limit: any,
  search: any,
  sort: any,
  direction: any,
  proposed_change_id: any,
  doc_number: any,
  status: any,
  progress: any,
  plant_id: any,
  auth_id: any,
  department_id: any,
  section_department_id: any,
  created_by: any,
  approval_auth_id: any,
  id: any,
  approval_status: any,
  employee_code: any,
});
export type OngoingAuthDocQuery = z.infer<typeof OngoingAuthDocQuery>;

export const UpdateApprovalStatusDto = z.looseObject({
  authdoc_id: any,
  auth_id: any,
  status: any,
  note: any,
  employee_code: any,
});
export type UpdateApprovalStatusDto = z.infer<typeof UpdateApprovalStatusDto>;
