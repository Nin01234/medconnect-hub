export interface TemplateItem {
  id: string;
  title: string;
  department_id?: string;
  referral_reason: string;
  diagnosis?: string;
  notes?: string;
  urgency_level: "low" | "medium" | "high" | "critical";
  required_documents?: string;
  is_global?: boolean;
}

const STORAGE_KEY = "medconnect_referral_templates";

const DEFAULT_TEMPLATES: TemplateItem[] = [
  {
    id: "tpl-1",
    title: "Cardiology Chest Pain Protocol",
    referral_reason: "Acute onset chest pain, suspected ischemia or coronary pathology.",
    diagnosis: "Angina Pectoris / Suspected ACS",
    urgency_level: "high",
    notes: "Patient administered 300mg Aspirin. ECG attached.",
    required_documents: "12-Lead ECG, Serial Troponin, Blood Pressure Log",
    is_global: true,
  },
  {
    id: "tpl-2",
    title: "Neurology Stroke / TIA Evaluation",
    referral_reason: "Transient weakness and numbness in upper extremity, sudden onset speech difficulty.",
    diagnosis: "Suspected TIA / Acute Stroke",
    urgency_level: "critical",
    notes: "NIHSS scale logged at intake. Fast-track imaging required.",
    required_documents: "CT Brain Report, Blood Glucose, Coagulation Profile",
    is_global: true,
  },
  {
    id: "tpl-3",
    title: "Orthopedic Closed Fracture Referral",
    referral_reason: "Severe localized swelling and pain following traumatic fall.",
    diagnosis: "Suspected Closed Fracture",
    urgency_level: "medium",
    notes: "Limb immobilized using posterior splint. Pain managed with analgesics.",
    required_documents: "X-Ray Views (AP & Lateral), Trauma Workup",
    is_global: true,
  },
];

export function getReferralTemplates(): TemplateItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? [...DEFAULT_TEMPLATES, ...parsed] : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveUserTemplate(tpl: Omit<TemplateItem, "id">): TemplateItem {
  const existing = getReferralTemplates().filter((t) => !t.is_global);
  const newTpl: TemplateItem = {
    ...tpl,
    id: `custom-tpl-${Date.now()}`,
    is_global: false,
  };
  const updated = [...existing, newTpl];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newTpl;
}

export function deleteUserTemplate(id: string): void {
  const existing = getReferralTemplates().filter((t) => !t.is_global && t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}
