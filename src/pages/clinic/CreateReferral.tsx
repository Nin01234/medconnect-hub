import { useEffect, useState } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, Sparkles, AlertTriangle, Bookmark, FlaskConical, ChevronDown, ChevronUp } from "lucide-react";
import { createReferralSchema } from "@/lib/validation";
import { sanitizeFileName, sanitizeText } from "@/lib/sanitize";
import { safeClientError } from "@/lib/safeError";
import { getDepartmentRecommendations, Recommendation } from "@/lib/recommendationEngine";
import { fetchTemplatesFromDb, type TemplateItem } from "@/lib/referralTemplates";
import { LabResultsPanel } from "@/components/LabResultsPanel";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

interface Department { id: string; name: string; }

export default function CreateReferral() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [labExpanded, setLabExpanded] = useState(false);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);
  const [attachedLabIds, setAttachedLabIds] = useState<string[]>([]);
  const runGuarded = useSubmitGuard();
  const [form, setForm] = useState({
    patient_name: "", patient_age: "", patient_gender: "" as "" | "male" | "female" | "other", patient_phone: "",
    diagnosis: "", symptoms: "", urgency_level: "medium" as "low" | "medium" | "high" | "critical",
    vitals_bp: "", vitals_hr: "", vitals_temp: "", vitals_rr: "", vitals_spo2: "",
    referral_reason: "", department_id: "", notes: "",
  });

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [possibleDuplicate, setPossibleDuplicate] = useState<{
    id: string;
    referral_number: string | null;
    status: string;
    created_at: string;
    department_name?: string;
  } | null>(null);
  const [bypassDuplicate, setBypassDuplicate] = useState(false);

  // Load departments
  useEffect(() => {
    if (profile?.hospital_id) {
      supabase
        .from("departments")
        .select("id,name")
        .eq("hospital_id", profile.hospital_id)
        .eq("status", "active")
        .order("name")
        .then(({ data }) => setDepartments((data ?? []) as Department[]));
    }
  }, [profile?.hospital_id]);

  // Load templates from DB
  const { data: templates = [] } = useQuery({
    queryKey: ["referral_templates", profile?.department_id],
    queryFn: () => fetchTemplatesFromDb(profile?.department_id),
    staleTime: 5 * 60_000,
  });

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Smart Department Recommendation
  useEffect(() => {
    const combined = `${form.diagnosis} ${form.symptoms} ${form.referral_reason}`;
    const recs = getDepartmentRecommendations(combined, departments);
    setRecommendations(recs);
  }, [form.diagnosis, form.symptoms, form.referral_reason, departments]);

  // Duplicate Referral Detection
  useEffect(() => {
    if (!form.patient_name.trim() || form.patient_name.trim().length < 3) {
      setPossibleDuplicate(null);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("referrals")
        .select("id, referral_number, status, created_at, departments(name)")
        .ilike("patient_name", `%${form.patient_name.trim()}%`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const found = data[0];
        setPossibleDuplicate({
          id: found.id,
          referral_number: found.referral_number,
          status: found.status,
          created_at: found.created_at,
          department_name: (found.departments as { name?: string })?.name,
        });
      } else {
        setPossibleDuplicate(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.patient_name]);

  const applyTemplate = (tpl: TemplateItem) => {
    setForm((prev) => ({
      ...prev,
      referral_reason: tpl.referral_reason || prev.referral_reason,
      diagnosis: tpl.diagnosis || prev.diagnosis,
      notes: tpl.notes ? `${prev.notes ? prev.notes + "\n" : ""}${tpl.notes}` : prev.notes,
      urgency_level: tpl.urgency_level || prev.urgency_level,
      department_id: tpl.department_id || prev.department_id,
    }));
    toast.success(`Template "${tpl.title}" applied`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadErrors([]);
    if (!profile?.department_id) return toast.error("Your account is not linked to a department");
    if (!user?.id) return toast.error("You must be signed in to submit a referral");
    if (!form.department_id) return toast.error("Select a target department");
    const parsed = createReferralSchema.safeParse({
      ...form,
      patient_gender: form.patient_gender || "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
      return;
    }
    const v = parsed.data;
    for (const f of files) {
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`File too large (max ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB): ${f.name}`);
        return;
      }
      if (f.type && !ALLOWED_ATTACHMENT_TYPES.has(f.type)) {
        toast.error(`Unsupported file type: ${f.name}. Use PDF or common images.`);
        return;
      }
    }
    await runGuarded(async () => {
    setBusy(true);
    try {
      const patientName = sanitizeText(v.patient_name, 200);
      const patientPhone = v.patient_phone ? sanitizeText(v.patient_phone, 40) : null;
      const patientAge = v.patient_age ?? null;
      const gender: "male" | "female" | "other" | null =
        v.patient_gender === "" ? null : v.patient_gender;

      const isDepartmentLinked = !profile.clinic_id && !!profile.department_id;

      let patientId: string | null = null;
      if (isDepartmentLinked) {
        const { data, error: patientErr } = await supabase.rpc("upsert_patient_for_department", {
          p_department_id: profile.department_id,
          p_full_name: patientName,
          p_age: patientAge,
          p_gender: gender,
          p_phone: patientPhone,
        });
        if (patientErr) throw patientErr;
        patientId = (data as string | null | undefined) ?? null;
      } else {
        const { data, error: patientErr } = await supabase.rpc("upsert_patient_for_clinic", {
          p_clinic_id: profile.clinic_id,
          p_full_name: patientName,
          p_age: patientAge,
          p_gender: gender,
          p_phone: patientPhone,
        });
        if (patientErr) throw patientErr;
        patientId = (data as string | null | undefined) ?? null;
      }

      const pid = patientId ?? null;
      let priorReferralCount = 0;
      if (pid) {
        const countQuery = supabase
          .from("referrals")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", pid);
        if (isDepartmentLinked) {
          countQuery.eq("source_department_id", profile.department_id);
        } else {
          countQuery.eq("clinic_id", profile.clinic_id);
        }
        const { count, error: countErr } = await countQuery;
        if (!countErr && count != null) {
          priorReferralCount = count;
        }
      }

      const { data: ref, error } = await supabase
        .from("referrals")
        .insert({
          patient_id: patientId ?? null,
          patient_name: patientName,
          patient_age: patientAge,
          patient_gender: gender,
          patient_phone: patientPhone,
          diagnosis: sanitizeText(v.diagnosis, 12000),
          symptoms: sanitizeText(v.symptoms ?? "", 12000) || null,
          vitals_bp: sanitizeText(v.vitals_bp ?? "", 50) || null,
          vitals_hr: sanitizeText(v.vitals_hr ?? "", 50) || null,
          vitals_temp: sanitizeText(v.vitals_temp ?? "", 50) || null,
          vitals_rr: sanitizeText(v.vitals_rr ?? "", 50) || null,
          vitals_spo2: sanitizeText(v.vitals_spo2 ?? "", 50) || null,
          urgency_level: v.urgency_level,
          referral_reason: sanitizeText(v.referral_reason, 12000),
          notes: v.notes ? sanitizeText(v.notes, 12000) : null,
          hospital_id: profile.hospital_id,
          department_id: v.department_id,
          source_department_id: profile.department_id,
          clinic_id: null,
          created_by: user.id,
          status: "new",
        })
        .select("id")
        .single();
      if (error) throw error;

      // Upload files
      const uploadFailures: string[] = [];
      for (const f of files) {
        const safeName = sanitizeFileName(f.name);
        const path = `${ref.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from("referral-attachments").upload(path, f);
        if (upErr) {
          console.error(upErr);
          uploadFailures.push(`${f.name}: upload failed`);
          continue;
        }
        const { error: insertAttErr } = await supabase.from("referral_attachments").insert({
          referral_id: ref.id, file_path: path, file_name: safeName, mime_type: f.type, size_bytes: f.size, uploaded_by: user.id,
        });
        if (insertAttErr) {
          console.error(insertAttErr);
          uploadFailures.push(`${f.name}: metadata save failed`);
        }
      }

      setUploadErrors(uploadFailures);
      const historyHint =
        pid && priorReferralCount > 0
          ? ` Linked to existing patient record (${priorReferralCount} prior referral${priorReferralCount === 1 ? "" : "s"}).`
          : "";
      if (uploadFailures.length > 0) {
        toast.warning(
          `Referral submitted, but ${uploadFailures.length} attachment${uploadFailures.length > 1 ? "s" : ""} failed.${historyHint}`,
        );
      } else if (historyHint) {
        toast.success(`Referral submitted.${historyHint}`);
      } else {
        toast.success("Referral submitted.");
      }
      const isHospitalPortal = window.location.pathname.startsWith("/hospital");
      nav(isHospitalPortal ? `/hospital/referrals/${ref.id}/review` : `/clinic/referrals/${ref.id}`);
    } catch (err) {
      toast.error(safeClientError(err));
    } finally { setBusy(false); }
    });
  };

  // Resolve patient ID from name for lab panel (debounced)
  useEffect(() => {
    if (!form.patient_name.trim() || form.patient_name.trim().length < 3) {
      setCreatedPatientId(null);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select("id")
        .ilike("full_name", `%${form.patient_name.trim()}%`)
        .limit(1)
        .maybeSingle();
      setCreatedPatientId(data?.id ?? null);
    }, 600);
    return () => clearTimeout(timer);
  }, [form.patient_name]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">New Referral</h1>
          <p className="text-muted-foreground">Complete all sections — referrals are saved as structured records.</p>
        </div>

        {/* Referral Template Selector */}
        <div className="flex items-center gap-2">
          <Select onValueChange={(val) => {
            const chosen = templates.find((t) => t.id === val);
            if (chosen) applyTemplate(chosen);
          }}>
            <SelectTrigger className="w-[220px]">
              <Bookmark className="h-4 w-4 mr-2 text-primary" />
              <SelectValue placeholder="Use Referral Template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Duplicate Referral Warning Banner */}
      {possibleDuplicate && !bypassDuplicate && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-amber-600 dark:text-amber-300">
                Possible Duplicate Referral Detected
              </p>
              <p className="text-muted-foreground mt-1">
                A referral already exists for patient matching <span className="font-semibold text-foreground">"{form.patient_name}"</span>.
                Referral #{possibleDuplicate.referral_number ?? "—"} created on {new Date(possibleDuplicate.created_at).toLocaleDateString()} (Status: <span className="capitalize font-medium">{possibleDuplicate.status}</span>).
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-8">
            <Button size="sm" variant="outline" onClick={() => window.open(`/clinic/referrals/${possibleDuplicate.id}`, "_blank")}>
              Open Existing Referral
            </Button>
            <Button size="sm" variant="hero" onClick={() => setBypassDuplicate(true)}>
              Continue Anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setForm((p) => ({ ...p, patient_name: "" }))}>
              Cancel Creation
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <Section title="Patient Information">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Full Name *"><Input required value={form.patient_name} onChange={e => update("patient_name", e.target.value)} /></Field>
            <Field label="Age"><Input type="number" min={0} value={form.patient_age} onChange={e => update("patient_age", e.target.value)} /></Field>
            <Field label="Gender">
              <Select value={form.patient_gender} onValueChange={v => update("patient_gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Phone"><Input value={form.patient_phone} onChange={e => update("patient_phone", e.target.value)} /></Field>
          </div>
        </Section>

        {/* Laboratory Results Panel */}
        <Card className="shadow-card">
          <CardContent className="p-6">
            <button
              type="button"
              className="w-full flex items-center justify-between"
              onClick={() => setLabExpanded((v) => !v)}
            >
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Laboratory Results
                {attachedLabIds.length > 0 && (
                  <span className="ml-2 text-xs bg-primary/15 text-primary border border-primary/30 rounded-full px-2 py-0.5">
                    {attachedLabIds.length} attached
                  </span>
                )}
              </h2>
              {labExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {labExpanded && (
              <div className="mt-4">
                <LabResultsPanel
                  patientId={createdPatientId}
                  allowAttach={false}
                  onAttached={(ids) => setAttachedLabIds(ids)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Section title="Clinical Information">
          <Field label="Diagnosis *"><Textarea required rows={2} value={form.diagnosis} onChange={e => update("diagnosis", e.target.value)} /></Field>
          <Field label="Symptoms"><Textarea rows={3} value={form.symptoms} onChange={e => update("symptoms", e.target.value)} /></Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Blood Pressure (mmHg)"><Input placeholder="e.g. 120/80" value={form.vitals_bp} onChange={e => update("vitals_bp", e.target.value)} /></Field>
            <Field label="Heart Rate (bpm)"><Input placeholder="e.g. 88" value={form.vitals_hr} onChange={e => update("vitals_hr", e.target.value)} /></Field>
            <Field label="Temperature (°C)"><Input placeholder="e.g. 37.2" value={form.vitals_temp} onChange={e => update("vitals_temp", e.target.value)} /></Field>
            <Field label="Respiratory Rate (/min)"><Input placeholder="e.g. 20" value={form.vitals_rr} onChange={e => update("vitals_rr", e.target.value)} /></Field>
            <Field label="SpO2 (%)"><Input placeholder="e.g. 98" value={form.vitals_spo2} onChange={e => update("vitals_spo2", e.target.value)} /></Field>
          </div>
          <Field label="Referral Reason *"><Textarea required rows={2} value={form.referral_reason} onChange={e => update("referral_reason", e.target.value)} /></Field>
        </Section>

        <Section title="Routing & Urgency">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Urgency *">
              <Select value={form.urgency_level} onValueChange={v => update("urgency_level", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Target Department *">
              <Select value={form.department_id} onValueChange={v => update("department_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Smart Department Recommendation UI */}
              {recommendations.length > 0 && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                    <Sparkles className="h-3.5 w-3.5" /> Smart Recommendations
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.map((rec) => (
                      <button
                        key={rec.departmentId}
                        type="button"
                        onClick={() => update("department_id", rec.departmentId)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          form.department_id === rec.departmentId
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-secondary text-foreground border-border"
                        }`}
                      >
                        {rec.departmentName} <span className="font-mono opacity-80">({rec.confidence}%)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Field>
          </div>
        </Section>

        <Section title="Attachments & Notes">
          <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={e => update("notes", e.target.value)} /></Field>
          <Field label="Attachments">
            <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary transition-colors">
              <input type="file" multiple className="hidden" onChange={e => { setFiles(Array.from(e.target.files ?? [])); setUploadErrors([]); }} />
              <div className="text-center"><Upload className="h-6 w-6 mx-auto text-muted-foreground" /><p className="text-sm mt-2">Click to choose files</p></div>
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-sm bg-secondary rounded px-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles(fs => fs.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
            {uploadErrors.length > 0 && (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm font-medium text-destructive">Attachment errors</p>
                <ul className="mt-1 space-y-1 text-sm text-destructive">
                  {uploadErrors.map((msg, idx) => (
                    <li key={`${msg}-${idx}`}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </Field>
        </Section>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => nav(-1)}>Cancel</Button>
          <Button type="submit" variant="hero" size="lg" disabled={busy}>{busy ? "Submitting…" : "Submit Referral"}</Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <h2 className="font-display text-lg font-semibold mb-4 pb-2 border-b">{title}</h2>
        <div className="space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5 block">{label}</Label>{children}</div>;
}
