/**
 * laboratoryService.ts
 * Modular service for fetching and managing laboratory results.
 * Designed for future HL7/FHIR integration — all data access is centralised here.
 */

import { supabase } from "@/integrations/supabase/client";

export type LabStatus = "normal" | "high" | "low" | "critical";

export interface LabResult {
  id: string;
  patient_id: string | null;
  referral_id: string | null;
  test_name: string;
  result: string;
  normal_range: string | null;
  unit: string | null;
  status: LabStatus;
  date_performed: string;
  ordering_doctor: string | null;
  department_id: string | null;
  hospital_id: string | null;
  is_attached_to_referral: boolean;
  created_at: string;
}

export interface LabResultInsert {
  patient_id: string;
  referral_id?: string | null;
  test_name: string;
  result: string;
  normal_range?: string | null;
  unit?: string | null;
  status: LabStatus;
  date_performed: string;
  ordering_doctor?: string | null;
  department_id?: string | null;
  hospital_id: string;
}

export interface LabSummary {
  total: number;
  normal: number;
  abnormal: number;
  critical: number;
  latestDate: string | null;
}

export const DATE_RANGE_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
  { label: "Last 180 days", value: 180 },
] as const;

export type DateRangeDays = (typeof DATE_RANGE_OPTIONS)[number]["value"];

/** Colour config for each lab status */
export const LAB_STATUS_CONFIG: Record<
  LabStatus,
  { label: string; emoji: string; className: string; rowClass: string }
> = {
  normal:   { label: "Normal",   emoji: "🟢", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",  rowClass: "" },
  high:     { label: "High",     emoji: "🟡", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",          rowClass: "bg-amber-500/5" },
  low:      { label: "Low",      emoji: "🟠", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",      rowClass: "bg-orange-500/5" },
  critical: { label: "Critical", emoji: "🔴", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",              rowClass: "bg-rose-500/10" },
};

/**
 * Fetch lab results for a given patient within a date window.
 * Critical results are sorted to the top.
 */
export async function fetchLabResults(
  patientId: string,
  dateRangeDays: DateRangeDays = 30,
): Promise<LabResult[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dateRangeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

  const { data, error } = await supabase
    .from("lab_results")
    .select("*")
    .eq("patient_id", patientId)
    .gte("date_performed", cutoffStr)
    .order("date_performed", { ascending: false });

  if (error) throw error;

  // Sort: critical first, then other abnormals, then normal
  const priority: Record<LabStatus, number> = { critical: 0, high: 1, low: 2, normal: 3 };
  return ((data ?? []) as LabResult[]).sort(
    (a, b) => priority[a.status] - priority[b.status],
  );
}

/** Compute summary statistics from a list of lab results */
export function summarizeLabResults(results: LabResult[]): LabSummary {
  const total = results.length;
  const normal = results.filter((r) => r.status === "normal").length;
  const critical = results.filter((r) => r.status === "critical").length;
  const abnormal = total - normal;
  const latestDate = results[0]?.date_performed ?? null;
  return { total, normal, abnormal, critical, latestDate };
}

/** Attach selected lab result IDs to a referral record */
export async function attachLabResultsToReferral(
  referralId: string,
  labResultIds: string[],
  userId: string,
): Promise<void> {
  if (labResultIds.length === 0) return;

  const { error } = await supabase
    .from("lab_results")
    .update({
      referral_id: referralId,
      is_attached_to_referral: true,
      attached_at: new Date().toISOString(),
      attached_by: userId,
    })
    .in("id", labResultIds);

  if (error) throw error;
}

/** Detach a single lab result from a referral */
export async function detachLabResultFromReferral(
  labResultId: string,
): Promise<void> {
  const { error } = await supabase
    .from("lab_results")
    .update({
      referral_id: null,
      is_attached_to_referral: false,
      attached_at: null,
      attached_by: null,
    })
    .eq("id", labResultId);

  if (error) throw error;
}

/** Insert a new lab result record */
export async function insertLabResult(
  data: LabResultInsert,
  userId: string,
): Promise<LabResult> {
  const { data: inserted, error } = await supabase
    .from("lab_results")
    .insert({ ...data, created_by: userId })
    .select("*")
    .single();

  if (error) throw error;
  return inserted as LabResult;
}

/** Fetch lab results already attached to a specific referral */
export async function fetchReferralLabResults(
  referralId: string,
): Promise<LabResult[]> {
  const { data, error } = await supabase
    .from("lab_results")
    .select("*")
    .eq("referral_id", referralId)
    .eq("is_attached_to_referral", true)
    .order("date_performed", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LabResult[];
}
