/** Human-readable labels for audit_log.action values used in the app. */
const ACTION_LABELS: Record<string, string> = {
  create_user: "Created a new user account",
  approve_user: "Approved a pending user",
  update_user: "Updated a user (profile, role, or organization)",
  reset_password: "Reset a user's password",
  delete_user: "Deleted a user account",
  referral_created: "Created a referral",
  referral_status_changed: "Changed referral status",
  referral_message_sent: "Sent a referral message",
  referral_attachment_uploaded: "Uploaded a referral attachment",
  doctor_created: "Added a doctor",
  doctor_updated: "Updated a doctor",
  doctor_deleted: "Removed a doctor",
  referral_department_assigned: "Assigned referral to a department",
  referral_staff_assigned: "Assigned referral to hospital staff",
  referral_doctor_assigned: "Assigned referral to a doctor",
  referral_visibility_changed: "Changed referral visibility across departments",
};

export function auditActionTitle(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function auditActionDetail(action: string, metadata: Record<string, unknown> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  const parts: string[] = [];
  if (metadata.role != null) parts.push(`Role: ${String(metadata.role)}`);
  if (metadata.status != null) parts.push(`Status: ${String(metadata.status)}`);
  if (metadata.from_status != null || metadata.to_status != null) {
    parts.push(`Status: ${String(metadata.from_status ?? "—")} → ${String(metadata.to_status ?? "—")}`);
  }
  if (metadata.referral_number != null) parts.push(`Referral: ${String(metadata.referral_number)}`);
  if (metadata.referral_id != null) parts.push(`Referral ID: ${String(metadata.referral_id)}`);
  if (metadata.file_name != null) parts.push(`File: ${String(metadata.file_name)}`);
  if (metadata.full_name != null) parts.push(`Name: ${String(metadata.full_name)}`);
  if (metadata.clinic_id != null) parts.push(`Clinic ID: ${String(metadata.clinic_id)}`);
  if (metadata.hospital_id != null) parts.push(`Hospital ID: ${String(metadata.hospital_id)}`);
  if (metadata.staff_id != null) parts.push(`Staff ID: ${String(metadata.staff_id)}`);
  if (metadata.assigned_staff_id != null) parts.push(`Assigned Staff: ${String(metadata.assigned_staff_id)}`);
  if (metadata.department_id != null) parts.push(`Department ID: ${String(metadata.department_id)}`);
  if (metadata.assigned_doctor_id != null) parts.push(`Assigned Doctor ID: ${String(metadata.assigned_doctor_id)}`);
  if (metadata.visible_to_all_departments != null) parts.push(`Visible To All Departments: ${String(metadata.visible_to_all_departments)}`);
  const extra = Object.entries(metadata).filter(
    ([k]) =>
      ![
        "role",
        "status",
        "from_status",
        "to_status",
        "referral_number",
        "referral_id",
        "file_name",
        "full_name",
        "clinic_id",
        "hospital_id",
        "staff_id",
        "assigned_staff_id",
        "department_id",
        "assigned_doctor_id",
        "visible_to_all_departments",
      ].includes(k),
  );
  for (const [k, v] of extra) parts.push(`${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.join(" · ") || "—";
}
