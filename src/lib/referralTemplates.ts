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
export const GLOBAL_TEMPLATES: TemplateItem[] = [];

/** Fetch department templates from Supabase (only department-specific templates created by admin) */
export async function fetchTemplatesFromDb(
  departmentId: string | null | undefined,
): Promise<TemplateItem[]> {
  if (!departmentId) return [];

  const { data, error } = await supabase
    .from("referral_templates")
    .select("*")
    .eq("department_id", departmentId)
    .order("title");

  if (error) {
    console.warn("[referralTemplates] DB fetch failed:", error.message);
    return [];
  }

  return (data ?? []) as TemplateItem[];
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
