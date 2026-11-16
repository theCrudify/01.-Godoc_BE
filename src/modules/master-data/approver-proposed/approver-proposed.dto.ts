// Validasi body create/update/bulk tetap di service (validateTemplateApprovalData):
// pesannya digabung dalam satu array `errors` dan dipakai ulang oleh bulk create.

export interface TemplateApprovalData {
  template_name: string;
  line_code?: string;
  need_engineering_approval?: boolean;
  need_production_approval?: boolean;
  step_order: number;
  actor_name: string;
  model_type: string;
  section_id?: number;
  use_dynamic_section?: boolean;
  use_line_section?: boolean;
  is_active?: boolean;
  priority?: number;
  description?: string;
  created_by: string;
  updated_by?: string;
}
