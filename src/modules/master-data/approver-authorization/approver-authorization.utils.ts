// Fungsi murni untuk applies_to_lines & validasi body template approval (dipakai juga oleh approver-handover).

export function parseAppliesToLines(data: string[] | string | null | undefined): any {
    if (!data) return null;
    
    if (Array.isArray(data)) {
        return JSON.stringify(data);
    }
    
    if (typeof data === 'string') {
        try {
            // If it's already a JSON string, validate it
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                return data;
            }
            // If it's a single string, convert to array
            return JSON.stringify([data]);
        } catch {
            // If it's not JSON, treat as single string
            return JSON.stringify([data]);
        }
    }
    
    return null;
}

// Helper function untuk format applies_to_lines untuk response
export function formatAppliesToLines(data: any): string[] | null {
    if (!data) return null;
    
    try {
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        if (Array.isArray(data)) {
            return data;
        }
        return null;
    } catch {
        return null;
    }
}

// Fungsi validasi input untuk mst_template_approval_authorization
export function validateTemplateApprovalAuthData(data: any): string[] {
    const errors: string[] = [];

    // Required fields validation
    if (!data.template_name || data.template_name.trim() === "") {
        errors.push("Template name is required.");
    } else if (data.template_name.length > 255) {
        errors.push("Template name cannot exceed 255 characters.");
    }

    if (!data.actor_name || data.actor_name.trim() === "") {
        errors.push("Actor name is required.");
    } else if (data.actor_name.length > 255) {
        errors.push("Actor name cannot exceed 255 characters.");
    }

    if (!data.created_by || data.created_by.trim() === "") {
        errors.push("Created by is required.");
    } else if (data.created_by.length > 100) {
        errors.push("Created by cannot exceed 100 characters.");
    }

    if (data.step_order === undefined || data.step_order === null) {
        errors.push("Step order is required.");
    } else if (!Number.isInteger(data.step_order) || data.step_order < 0) {
        errors.push("Step order must be a non-negative integer.");
    }

    if (!data.model_type || data.model_type.trim() === "") {
        errors.push("Model type is required.");
    } else if (!["section", "department"].includes(data.model_type)) {
        errors.push("Model type must be either 'section' or 'department'.");
    }

    // Optional fields validation
    if (data.line_code && data.line_code.length > 50) {
        errors.push("Line code cannot exceed 50 characters.");
    }

    if (data.updated_by && data.updated_by.length > 100) {
        errors.push("Updated by cannot exceed 100 characters.");
    }

    if (data.section_id !== undefined && data.section_id !== null && !Number.isInteger(data.section_id)) {
        errors.push("Section ID must be an integer.");
    }

    if (data.priority !== undefined && data.priority !== null && (!Number.isInteger(data.priority) || data.priority < 0)) {
        errors.push("Priority must be a non-negative integer.");
    }

    if (data.insert_after_step !== undefined && data.insert_after_step !== null && (!Number.isInteger(data.insert_after_step) || data.insert_after_step < 0)) {
        errors.push("Insert after step must be a non-negative integer.");
    }

    // Boolean validation
    if (data.use_dynamic_section !== undefined && typeof data.use_dynamic_section !== "boolean") {
        errors.push("Use dynamic section must be a boolean.");
    }

    if (data.use_line_section !== undefined && typeof data.use_line_section !== "boolean") {
        errors.push("Use line section must be a boolean.");
    }

    if (data.is_insert_step !== undefined && typeof data.is_insert_step !== "boolean") {
        errors.push("Is insert step must be a boolean.");
    }

    if (data.is_active !== undefined && typeof data.is_active !== "boolean") {
        errors.push("Is active must be a boolean.");
    }

    // Validation for insert step logic
    if (data.is_insert_step === true) {
        if (data.insert_after_step === undefined || data.insert_after_step === null) {
            errors.push("Insert after step is required when is_insert_step is true.");
        }
        
        if (!data.applies_to_lines || (Array.isArray(data.applies_to_lines) && data.applies_to_lines.length === 0)) {
            errors.push("Applies to lines is required when is_insert_step is true.");
        }
    }

    // Validation for applies_to_lines format
    if (data.applies_to_lines) {
        if (typeof data.applies_to_lines === 'string') {
            try {
                const parsed = JSON.parse(data.applies_to_lines);
                if (!Array.isArray(parsed)) {
                    errors.push("Applies to lines must be an array of strings.");
                }
            } catch {
                // If it's not JSON, treat as single string - this is valid
            }
        } else if (!Array.isArray(data.applies_to_lines)) {
            errors.push("Applies to lines must be an array of strings or a JSON string.");
        }
    }

    return errors;
}
