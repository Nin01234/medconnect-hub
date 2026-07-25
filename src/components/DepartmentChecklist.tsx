import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

export interface ChecklistItem {
  key: string;
  label: string;
  mandatory: boolean;
}

const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {
  cardiology: [
    { key: "notes", label: "Clinical Notes", mandatory: true },
    { key: "bp", label: "Blood Pressure Log", mandatory: true },
    { key: "ecg", label: "ECG / EKG Trace", mandatory: true },
    { key: "troponin", label: "Troponin Lab Result", mandatory: false },
  ],
  neurology: [
    { key: "notes", label: "Neurological Clinical Notes", mandatory: true },
    { key: "nihss", label: "NIHSS Stroke Score / Exam", mandatory: false },
    { key: "ct", label: "Brain CT / MRI Report", mandatory: true },
    { key: "glucose", label: "Blood Glucose Level", mandatory: true },
  ],
  orthopaedics: [
    { key: "notes", label: "Trauma Examination Notes", mandatory: true },
    { key: "xray", label: "X-Ray Views (AP & Lateral)", mandatory: true },
    { key: "vitals", label: "Full Vital Signs", mandatory: true },
  ],
  general: [
    { key: "notes", label: "Clinical History & Summary", mandatory: true },
    { key: "vitals", label: "Recent Vital Signs", mandatory: true },
    { key: "diagnosis", label: "Provisional Diagnosis", mandatory: true },
  ],
};

interface DepartmentChecklistProps {
  departmentName?: string;
  departmentId?: string;
  formData: {
    diagnosis: string;
    vitals_bp: string;
    vitals_hr: string;
    hasLabResults: boolean;
    hasImaging: boolean;
    hpi: string;
  };
  onChecklistStatusChange?: (isComplete: boolean, missingMandatory: string[]) => void;
}

export function DepartmentChecklist({
  departmentName,
  departmentId,
  formData,
  onChecklistStatusChange,
}: DepartmentChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    let activeItems: ChecklistItem[] = [];
    const normalized = (departmentName || "").toLowerCase();

    if (normalized.includes("cardio")) activeItems = DEFAULT_CHECKLISTS.cardiology;
    else if (normalized.includes("neuro")) activeItems = DEFAULT_CHECKLISTS.neurology;
    else if (normalized.includes("ortho")) activeItems = DEFAULT_CHECKLISTS.orthopaedics;
    else activeItems = DEFAULT_CHECKLISTS.general;

    setItems(activeItems);

    if (departmentId) {
      supabase
        .from("department_checklists")
        .select("item_key, item_label, is_mandatory")
        .eq("department_id", departmentId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setItems(
              data.map((d) => ({
                key: d.item_key,
                label: d.item_label,
                mandatory: d.is_mandatory,
              }))
            );
          }
        });
    }
  }, [departmentName, departmentId]);

  const evaluateItem = (key: string): boolean => {
    switch (key) {
      case "notes":
      case "diagnosis":
        return Boolean(formData.diagnosis.trim() || formData.hpi.trim());
      case "bp":
      case "vitals":
        return Boolean(formData.vitals_bp.trim() || formData.vitals_hr.trim());
      case "ecg":
      case "xray":
      case "ct":
        return formData.hasImaging;
      case "troponin":
      case "glucose":
        return formData.hasLabResults;
      default:
        return Boolean(formData.diagnosis.trim());
    }
  };

  const missingMandatory: string[] = [];
  const statusMap = items.map((item) => {
    const isDone = evaluateItem(item.key);
    if (!isDone && item.mandatory) missingMandatory.push(item.label);
    return { ...item, isDone };
  });

  useEffect(() => {
    if (onChecklistStatusChange) {
      onChecklistStatusChange(missingMandatory.length === 0, missingMandatory);
    }
  }, [missingMandatory.length, onChecklistStatusChange]);

  if (!departmentName) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase font-bold tracking-wider text-primary flex items-center gap-1.5">
          {departmentName} Department Referral Checklist
        </h3>
        {missingMandatory.length > 0 && (
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> {missingMandatory.length} missing requirement(s)
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {statusMap.map((item) => (
          <div
            key={item.key}
            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
              item.isDone
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : item.mandatory
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                : "bg-background border-border text-muted-foreground"
            }`}
          >
            {item.isDone ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="font-medium truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
