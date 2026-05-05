/** Minimal Supabase PostgREST chain after `.from().select()…`. */
export type ReferralListQuery = {
  or: (filters: string) => ReferralListQuery;
  eq: (column: string, value: string | boolean) => ReferralListQuery;
};

/**
 * Hospital portal list views: triage roles see all rows for the hospital (RLS permitting).
 * Other hospital users see the shared inbox (visible_to_all_departments) plus their department queue.
 */
export function applyHospitalReferralListFilters<Q extends ReferralListQuery>(
  query: Q,
  opts: { canTriageHospitalQueue: boolean; departmentId: string | null },
): Q {
  if (opts.canTriageHospitalQueue) return query;
  if (opts.departmentId) {
    return query.or(`visible_to_all_departments.eq.true,department_id.eq.${opts.departmentId}`);
  }
  return query.eq("visible_to_all_departments", true);
}

/** Stable cache key segment for TanStack Query */
export function hospitalReferralListScopeKey(
  canTriageHospitalQueue: boolean,
  departmentId: string | null,
): string {
  if (canTriageHospitalQueue) return "triage";
  return `staff:${departmentId ?? "nodept"}`;
}

/** Whether a referral row should appear in non-triage hospital lists (matches list query). */
export function referralRowVisibleToHospitalViewer(
  record: {
    visible_to_all_departments?: unknown;
    department_id?: unknown;
  },
  opts: { canTriageHospitalQueue: boolean; departmentId: string | null },
): boolean {
  if (opts.canTriageHospitalQueue) return true;
  const visAll = record.visible_to_all_departments === true;
  if (visAll) return true;
  const dept = record.department_id != null ? String(record.department_id) : null;
  return !!opts.departmentId && dept === opts.departmentId;
}
