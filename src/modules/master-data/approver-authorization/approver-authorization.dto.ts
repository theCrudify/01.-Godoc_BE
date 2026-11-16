import { z } from "zod";
import { present } from "../../../shared/middleware/validate";

// Validasi body create/update/bulk tetap di service (validateTemplateApprovalAuthData):
// banyak aturan bersyarat/lintas-field, pesan digabung dalam satu array `errors`, dan dipakai ulang oleh bulk.

export interface TemplateApprovalAuthData {
  template_name: string;
  line_code?: string;
  step_order: number;
  actor_name: string;
  model_type: string;
  section_id?: number;
  use_dynamic_section?: boolean;
  use_line_section?: boolean;
  is_insert_step?: boolean;
  insert_after_step?: number;
  applies_to_lines?: string[] | string;
  is_active?: boolean;
  priority?: number;
  description?: string;
  created_by: string;
  updated_by?: string;
}

export const ValidateApprovalFlowDto = z.looseObject({
  line_code: present<string>("Line code"),
});
export type ValidateApprovalFlowDto = z.infer<typeof ValidateApprovalFlowDto>;
