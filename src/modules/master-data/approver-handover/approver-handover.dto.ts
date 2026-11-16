
// Validasi body create/update/bulk tetap di service (validateTemplateApprovalHandoverData):
// banyak aturan bersyarat/lintas-field, pesan digabung dalam satu array `errors`, dan dipakai ulang oleh bulk.

export interface TemplateApprovalHandoverData {
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
