export type AppRole = "admin" | "hospital_admin" | "hospital_staff" | "clinic_admin" | "clinic_staff" | "clinic_user" | "doctor";

export function hasRole(roles: AppRole[], ...wanted: AppRole[]) {
  return roles.some((r) => wanted.includes(r));
}
