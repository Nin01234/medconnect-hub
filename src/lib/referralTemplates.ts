/**
 * referralTemplates.ts
 * Supabase-backed referral template service.
 * Department admins create templates; dept staff can read and apply them.
 * Falls back to built-in global templates if DB is unavailable.
 */

import { supabase } from "@/integrations/supabase/client";

export interface TemplateItem {
  id: string;
  title: string;
  department_id?: string | null;
  hospital_id?: string | null;
  referral_reason: string;
  diagnosis?: string;
  notes?: string;
  urgency_level: "low" | "medium" | "high" | "critical";
  required_documents?: string;
  is_global?: boolean;
  created_by?: string | null;
}

/** Built-in read-only global templates shown to all users */
export const GLOBAL_TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-1",
    title: "Cardiology – Chest Pain Protocol",
    referral_reason: "Acute onset chest pain, suspected ischemia or coronary pathology.",
    diagnosis: "Angina Pectoris / Suspected ACS",
    urgency_level: "high",
    notes: "Patient administered 300mg Aspirin. ECG attached.",
    required_documents: "12-Lead ECG, Serial Troponin, Blood Pressure Log",
    is_global: true,
  },
  {
    id: "tpl-2",
    title: "Neurology – Stroke / TIA Evaluation",
    referral_reason: "Transient weakness and numbness in upper extremity, sudden onset speech difficulty.",
    diagnosis: "Suspected TIA / Acute Stroke",
    urgency_level: "critical",
    notes: "NIHSS scale logged at intake. Fast-track imaging required.",
    required_documents: "CT Brain Report, Blood Glucose, Coagulation Profile",
    is_global: true,
  },
  {
    id: "tpl-3",
    title: "Orthopaedics – Closed Fracture Referral",
    referral_reason: "Severe localised swelling and pain following traumatic fall.",
    diagnosis: "Suspected Closed Fracture",
    urgency_level: "medium",
    notes: "Limb immobilised using posterior splint. Pain managed with analgesics.",
    required_documents: "X-Ray Views (AP & Lateral), Trauma Workup",
    is_global: true,
  },
];

/** Fetch department templates + global templates from Supabase */
export async function fetchTemplatesFromDb(
  departmentId: string | null | undefined,
): Promise<TemplateItem[]> {
  if (!departmentId) return GLOBAL_TEMPLATES;

  const { data, error } = await supabase
    .from("referral_templates")
    .select("*")
    .order("title");

  if (error) {
    console.warn("[referralTemplates] DB fetch failed, using built-in templates:", error.message);
    return GLOBAL_TEMPLATES;
  }

  const dbTemplates = (data ?? []) as TemplateItem[];
  // Merge: global built-ins first, then dept-specific DB templates
  return [...GLOBAL_TEMPLATES, ...dbTemplates];
}

/** Create a new template in Supabase (department admin only) */
export async function createDeptTemplate(
  tpl: Omit<TemplateItem, "id">,
  userId: string,
): Promise<TemplateItem> {
  const { data, error } = await supabase
    .from("referral_templates")
    .insert({ ...tpl, created_by: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as TemplateItem;
}

/** Update an existing dept template */
export async function updateDeptTemplate(
  id: string,
  updates: Partial<Omit<TemplateItem, "id" | "created_by">>,
): Promise<TemplateItem> {
  const { data, error } = await supabase
    .from("referral_templates")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as TemplateItem;
}

/** Delete a dept template */
export async function deleteDeptTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("referral_templates").delete().eq("id", id);
  if (error) throw error;
}

// ----- Legacy localStorage helpers (kept for backwards compatibility) -----
const STORAGE_KEY = "medconnect_referral_templates";

export function getReferralTemplates(): TemplateItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return GLOBAL_TEMPLATES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? [...GLOBAL_TEMPLATES, ...parsed]
      : GLOBAL_TEMPLATES;
  } catch {
    return GLOBAL_TEMPLATES;
  }
}

export function saveUserTemplate(tpl: Omit<TemplateItem, "id">): TemplateItem {
  const existing = getReferralTemplates().filter((t) => !t.is_global);
  const newTpl: TemplateItem = { ...tpl, id: `custom-tpl-${Date.now()}`, is_global: false };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, newTpl]));
  return newTpl;
}

export function deleteUserTemplate(id: string): void {
  const existing = getReferralTemplates().filter((t) => !t.is_global && t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}
