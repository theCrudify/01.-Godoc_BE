import { z } from "zod";

// Cek wajib/enum di sini punya body error khusus (mis. { error, required: [...] }) dan sebagian
// bergantung pada role, jadi tetap di service. DTO hanya mendeskripsikan input tanpa menolak apa pun.

const any = z.any().optional();

export const ChangeRequestListQuery = z.looseObject({
  page: any,
  limit: any,
  status: any,
  priority: any,
  search: any,
});
export type ChangeRequestListQuery = z.infer<typeof ChangeRequestListQuery>;

export const RequestApproverChangeDto = z.looseObject({
  authorization_doc_id: any,
  approval_id: any,
  current_auth_id: any,
  new_auth_id: any,
  reason: any,
  urgent: any,
});
export type RequestApproverChangeDto = z.infer<typeof RequestApproverChangeDto>;

export const ProcessChangeRequestDto = z.looseObject({
  status: any,
  admin_decision: any,
});
export type ProcessChangeRequestDto = z.infer<typeof ProcessChangeRequestDto>;

export const BypassDto = z.looseObject({
  authorization_doc_id: any,
  target_status: any,
  reason: any,
  bypass_type: any,
});
export type BypassDto = z.infer<typeof BypassDto>;
