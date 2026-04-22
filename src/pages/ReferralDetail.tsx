import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/context/AuthContext";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { MessagePanel } from "@/components/MessagePanel";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Printer, Download, Paperclip, Clock, History } from "lucide-react";
import { Label } from "@/components/ui/label";
import { sanitizeText } from "@/lib/sanitize";
import { safeClientError } from "@/lib/safeError";
import { doctorCreateSchema } from "@/lib/validation";

interface Referral {
  id: string; unique_id: string | null; referral_number: string | null; patient_id: string | null; patient_name: string; patient_age: number | null; patient_gender: string | null;
  patient_phone: string | null; diagnosis: string | null; symptoms: string | null; urgency_level: string;
  vitals_bp: string | null; vitals_hr: string | null; vitals_temp: string | null; vitals_rr: string | null; vitals_spo2: string | null;
  referral_reason: string | null; notes: string | null; status: string; rejection_reason: string | null;
  hospital_feedback: string | null; clinic_id: string | null; hospital_id: string | null; assigned_department: string | null; department_id: string | null; assigned_staff_id: string | null; staff_assignment_locked: boolean; visible_to_all_departments: boolean;
  created_at: string; updated_at: string;
  clinics: { name: string; unique_id: string | null; city: string | null; contact: string | null; region: string | null } | null;
  hospitals: { name: string; unique_id: string | null; city: string | null } | null;
  departments: { id: string; name: string } | null;
}
interface Att { id: string; file_path: string; file_name: string; mime_type: string | null; }
interface Hist { id: string; from_status: string | null; to_status: string; created_at: string; note: string | null; changed_by?: string | null; }
interface DepartmentOption { id: string; name: string }
interface DoctorOption { id: string; full_name: string; specialty: string | null; }

export default function ReferralDetail({ portal }: { portal: "clinic" | "hospital" }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { roles, profile } = useAuth();
  const [ref, setRef] = useState<Referral | null>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [newDoctor, setNewDoctor] = useState({ full_name: "", specialty: "", phone: "", email: "" });
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [visibleAllDepartments, setVisibleAllDepartments] = useState(false);
  const [completedBy, setCompletedBy] = useState<{ accountId: string | null; userId: string; name: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from("referrals")
      .select("*, clinics(name,unique_id,city,contact,region), hospitals(name,unique_id,city), departments(id,name)")
      .eq("id", id).maybeSingle();
    if (error) {
      toast.error(safeClientError(error));
      setRef(null);
      return;
    }
    if (!data) {
      // Most common causes: not found, or blocked by RLS (not authorized for this referral).
      toast.error("Referral not found or you don’t have access.");
      setRef(null);
      nav(-1);
      return;
    }
    setRef(data as unknown as Referral);
    setVisibleAllDepartments(Boolean((data as { visible_to_all_departments?: boolean }).visible_to_all_departments));
    const [{ data: a, error: attachmentsErr }, { data: h, error: historyErr }] = await Promise.all([
      supabase.from("referral_attachments").select("*").eq("referral_id", id),
      supabase.from("referral_status_history").select("*").eq("referral_id", id).order("created_at"),
    ]);
    if (attachmentsErr) {
      toast.error(`Failed to load attachments: ${safeClientError(attachmentsErr)}`);
    }
    if (historyErr) {
      toast.error(`Failed to load timeline: ${safeClientError(historyErr)}`);
    }
    setAtts((a ?? []) as Att[]);
    const historyRows = (h ?? []) as Hist[];
    setHist(historyRows);
    if ((data as { hospital_id?: string | null })?.hospital_id) {
      const hospitalId = (data as { hospital_id: string }).hospital_id;
      const { data: deps } = await supabase
        .from("departments")
        .select("id,name")
        .eq("hospital_id", hospitalId)
        .eq("status", "active")
        .order("name");
      setDepartmentOptions((deps ?? []) as DepartmentOption[]);
      const { data: doctors } = await supabase
        .from("doctors")
        .select("id,full_name,specialty")
        .eq("hospital_id", hospitalId)
        .eq("status", "active")
        .order("full_name");
      setDoctorOptions((doctors ?? []) as DoctorOption[]);
    } else {
      setDepartmentOptions([]);
      setDoctorOptions([]);
    }

    const canSeeCompletionActor = portal === "hospital" && hasRole(roles, "hospital_admin", "admin");
    if (!canSeeCompletionActor) {
      setCompletedBy(null);
      return;
    }

    const completionEvents = historyRows.filter((row) => row.to_status === "completed");
    const latestCompletion = completionEvents[completionEvents.length - 1] as (Hist & { changed_by?: string | null }) | undefined;
    const changedBy = latestCompletion?.changed_by ?? null;
    if (!changedBy) {
      setCompletedBy(null);
      return;
    }

    const { data: actor } = await supabase
      .from("profiles")
      .select("id, unique_id, full_name")
      .eq("id", changedBy)
      .maybeSingle();
    setCompletedBy({
      accountId: actor?.unique_id ?? null,
      userId: changedBy,
      name: actor?.full_name ?? null,
    });
  }, [id, nav, portal, roles]);

  const [debouncedRealtime, cancelDebouncedRealtime] = useDebouncedCallback(() => {
    void load();
  }, 400);

  useEffect(() => {
    load();
    if (!id) return;
    const ch = supabase.channel(`ref-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals", filter: `id=eq.${id}` }, debouncedRealtime)
      .subscribe();
    return () => {
      cancelDebouncedRealtime();
      supabase.removeChannel(ch);
    };
  }, [id, load, debouncedRealtime, cancelDebouncedRealtime]);

  if (!ref) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  const isHospital = portal === "hospital";
  const isHospitalAdmin = isHospital && hasRole(roles, "hospital_admin", "admin");
  const isHospitalStaff = isHospital && hasRole(roles, "hospital_staff");
  const canHospitalAct = isHospital && hasRole(roles, "hospital_admin", "hospital_staff", "admin");
  const isCompleted = ref.status === "completed";
  const canOverrideCompletedLock = isHospital && hasRole(roles, "hospital_admin", "admin");
  const canAccept = !["accepted", "rejected", "completed"].includes(ref.status);
  const canReject = !["accepted", "rejected", "completed"].includes(ref.status);

  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const cleaned: Record<string, unknown> = { status, ...extra };
    if (typeof cleaned.rejection_reason === "string") {
      const s = sanitizeText(cleaned.rejection_reason, 12000);
      if (!s.trim()) {
        setBusy(false);
        toast.error("Enter a rejection reason.");
        return;
      }
      cleaned.rejection_reason = s;
    }
    if (typeof cleaned.hospital_feedback === "string") {
      const s = sanitizeText(cleaned.hospital_feedback, 12000);
      if (!s.trim()) {
        setBusy(false);
        toast.error("Enter feedback text.");
        return;
      }
      cleaned.hospital_feedback = s;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("referrals").update(cleaned as any).eq("id", ref.id);
      if (error) throw error;
      toast.success("Updated");
      load();
    } catch (e) {
      toast.error(safeClientError(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (att: Att) => {
    const { data, error } = await supabase.storage.from("referral-attachments").createSignedUrl(att.file_path, 60);
    if (error || !data) return toast.error("Could not generate link");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const assignDoctor = async () => {
    if (!doctorId) return;
    await updateStatus(ref.status, { assigned_doctor_id: doctorId });
  };

  const createDoctor = async () => {
    const parsed = doctorCreateSchema.safeParse(newDoctor);
    if (!parsed.success || !ref.hospital_id) {
      toast.error(parsed.success ? "Hospital link is missing." : parsed.error.issues[0]?.message ?? "Invalid doctor details.");
      return;
    }
    const values = parsed.data;
    const { data, error } = await supabase
      .from("doctors")
      .insert({
        hospital_id: ref.hospital_id,
        full_name: sanitizeText(values.full_name, 200),
        specialty: sanitizeText(values.specialty ?? "", 200) || null,
        phone: sanitizeText(values.phone ?? "", 40) || null,
        email: sanitizeText(values.email ?? "", 320) || null,
      })
      .select("id,full_name,specialty")
      .single();
    if (error) {
      toast.error(safeClientError(error));
      return;
    }
    setDoctorOptions((prev) => [...prev, data as DoctorOption]);
    setNewDoctor({ full_name: "", specialty: "", phone: "", email: "" });
    toast.success("Doctor created");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between no-print flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <div className="flex items-center gap-2 flex-wrap">
          {ref.patient_id ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={isHospital ? `/hospital/patients/${ref.patient_id}` : `/clinic/patients/${ref.patient_id}`}>
                <History className="h-4 w-4" /> Patient referral history
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      <Card className="shadow-elevated">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-5 mb-5 flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Medical Referral</p>
              <h1 className="font-display text-3xl font-bold mt-1">{ref.patient_name}</h1>
              <div className="mt-2 space-y-0.5">
                {ref.referral_number ? (
                  <p className="font-mono text-lg font-semibold tracking-tight text-foreground">{ref.referral_number}</p>
                ) : null}
                <p className="font-mono text-xs text-muted-foreground">
                  {ref.referral_number ? "Short ID: " : "Referral ID: "}
                  {ref.unique_id ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={ref.status} />
              <UrgencyBadge level={ref.urgency_level} />
              <p className="text-xs text-muted-foreground">{new Date(ref.created_at).toLocaleString()}</p>
            </div>
          </div>

          {ref.hospital_feedback && (
            <div className="mb-6 bg-success/10 border border-success/30 rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-success tracking-wider">Hospital feedback</p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{ref.hospital_feedback}</p>
            </div>
          )}

          {/* Sections */}
          <div className="grid md:grid-cols-2 gap-6">
            <Section title="Patient Information">
              <Row k="Full Name" v={ref.patient_name} />
              <Row k="Age" v={ref.patient_age?.toString() ?? "—"} />
              <Row k="Gender" v={ref.patient_gender ?? "—"} />
              <Row k="Phone" v={ref.patient_phone ?? "—"} />
            </Section>
            <Section title="Clinic Information">
              <Row k="Clinic ID" v={ref.clinics?.unique_id ?? "—"} />
              <Row k="Clinic" v={ref.clinics?.name ?? "—"} />
              <Row k="City" v={ref.clinics?.city ?? "—"} />
              <Row k="Region" v={ref.clinics?.region ?? "—"} />
              <Row k="Contact" v={ref.clinics?.contact ?? "—"} />
            </Section>
          </div>

          <div className="mt-6 space-y-5">
            <Section title="Diagnosis"><p className="text-sm leading-relaxed whitespace-pre-wrap">{ref.diagnosis ?? "—"}</p></Section>
            <Section title="Symptoms"><p className="text-sm leading-relaxed whitespace-pre-wrap">{ref.symptoms ?? "—"}</p></Section>
            <Section title="Vitals">
              <div className="grid md:grid-cols-2 gap-x-6">
                <Row k="Blood Pressure" v={ref.vitals_bp ?? "—"} />
                <Row k="Heart Rate" v={ref.vitals_hr ?? "—"} />
                <Row k="Temperature" v={ref.vitals_temp ?? "—"} />
                <Row k="Respiratory Rate" v={ref.vitals_rr ?? "—"} />
                <Row k="SpO2" v={ref.vitals_spo2 ?? "—"} />
              </div>
            </Section>
            <Section title="Reason for Referral"><p className="text-sm leading-relaxed whitespace-pre-wrap">{ref.referral_reason ?? "—"}</p></Section>
            {ref.notes && <Section title="Notes"><p className="text-sm leading-relaxed whitespace-pre-wrap">{ref.notes}</p></Section>}
          </div>

          {atts.length > 0 && (
            <div className="mt-6">
              <h3 className="font-display text-lg font-semibold mb-3">Attachments</h3>
              <ul className="space-y-2">
                {atts.map(a => (
                  <li key={a.id} className="flex items-center justify-between bg-secondary rounded px-3 py-2 text-sm">
                    <span className="flex items-center gap-2"><Paperclip className="h-4 w-4" />{a.file_name}</span>
                    <Button variant="ghost" size="sm" onClick={() => downloadFile(a)}><Download className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ref.rejection_reason && (
            <div className="mt-6 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-destructive tracking-wider">Rejection Reason</p>
              <p className="mt-1 text-sm">{ref.rejection_reason}</p>
            </div>
          )}
          {(ref.departments?.name || ref.assigned_department) && (
            <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-primary tracking-wider">Assigned Department</p>
              <p className="mt-1 font-medium">{ref.departments?.name ?? ref.assigned_department}</p>
            </div>
          )}
          {ref.visible_to_all_departments && (
            <div className="mt-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <p className="text-xs uppercase font-semibold tracking-wider text-cyan-700 dark:text-cyan-300">Visibility</p>
              <p className="mt-1 text-sm">Visible to all hospital departments</p>
            </div>
          )}
          {ref.assigned_staff_id && (
            <div className="mt-3 bg-secondary border border-border rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Assigned Staff</p>
              <p className="mt-1 font-mono text-xs">{ref.assigned_staff_id}</p>
            </div>
          )}
          {isHospitalStaff && (
            <div className="mt-3 bg-secondary border border-border rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Printed By Staff ID</p>
              <p className="mt-1 font-mono text-xs">{profile?.staff_id ?? "—"}</p>
            </div>
          )}
          {isHospital && hasRole(roles, "hospital_admin", "admin") && ref.status === "completed" && completedBy && (
            <div className="mt-6 bg-secondary border border-border rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Completed By</p>
              <p className="mt-1 text-sm">
                {completedBy.name ?? "Hospital staff"} - Account ID:{" "}
                <span className="font-mono">{completedBy.accountId ?? completedBy.userId}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hospital actions */}
      {canHospitalAct && (!isCompleted || canOverrideCompletedLock) && (
        <Card className="shadow-card no-print">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Hospital Actions</h3>
            {isCompleted && canOverrideCompletedLock && (
              <p className="text-xs text-muted-foreground">
                Completed referral lock is active for staff. You can still make final corrections as a hospital admin.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus("under_review")}>Mark Under Review</Button>
              <Button variant="hero" size="sm" disabled={busy || !canAccept} onClick={() => updateStatus("accepted")}>Accept</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus("info_requested")}>Request Info</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus("treated")}>Mark Treated</Button>
              <Button variant="gold" size="sm" disabled={busy} onClick={() => updateStatus("completed")}>Complete</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
              {isHospitalAdmin && (
                <div>
                  <Label>Assign to department (Admin)</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="hero"
                      disabled={!departmentId || busy}
                      onClick={() => {
                        const chosen = departmentOptions.find((d) => d.id === departmentId);
                        void updateStatus("assigned", {
                          department_id: departmentId,
                          assigned_department: chosen?.name ?? null,
                          assigned_doctor_id: null,
                          visible_to_all_departments: false,
                        });
                      }}
                    >
                      Assign
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={visibleAllDepartments ? "hero" : "outline"}
                      disabled={busy}
                      onClick={() =>
                        void updateStatus(ref.status, {
                          visible_to_all_departments: !visibleAllDepartments,
                        })
                      }
                    >
                      {visibleAllDepartments ? "Visible to all departments" : "Make visible to all departments"}
                    </Button>
                  </div>
                </div>
              )}
              {isHospitalStaff && (
                <div>
                  <Label>Forward to another department</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={departmentId} onValueChange={setDepartmentId}>
                      <SelectTrigger><SelectValue placeholder="Choose department" /></SelectTrigger>
                      <SelectContent>
                        {departmentOptions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={!departmentId || busy}
                      onClick={() => {
                        const chosen = departmentOptions.find((d) => d.id === departmentId);
                        void updateStatus("assigned", {
                          department_id: departmentId,
                          assigned_department: chosen?.name ?? null,
                          visible_to_all_departments: false,
                        });
                      }}
                    >
                      Forward
                    </Button>
                  </div>
                </div>
              )}
              {isHospitalStaff && (
                <div>
                  <Label>Assign doctor (Hospital Staff)</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={doctorId} onValueChange={setDoctorId}>
                      <SelectTrigger><SelectValue placeholder="Choose doctor" /></SelectTrigger>
                      <SelectContent>
                        {doctorOptions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.full_name}{d.specialty ? ` · ${d.specialty}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="hero" disabled={!doctorId || busy} onClick={() => void assignDoctor()}>
                      Assign
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 mt-2">
                    <Input placeholder="New doctor full name" value={newDoctor.full_name} onChange={(e) => setNewDoctor((p) => ({ ...p, full_name: e.target.value }))} />
                    <Input placeholder="Specialty" value={newDoctor.specialty} onChange={(e) => setNewDoctor((p) => ({ ...p, specialty: e.target.value }))} />
                    <Button variant="outline" onClick={() => void createDoctor()} disabled={busy || !newDoctor.full_name.trim()}>
                      Create doctor
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <Label>Reject with reason</Label>
                <div className="flex gap-2 mt-1">
                  <Textarea rows={1} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason…" />
                  <Button variant="destructive" disabled={!reason.trim() || busy || !canReject} onClick={() => updateStatus("rejected", { rejection_reason: reason })}>Reject</Button>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Send feedback to clinic</Label>
                <div className="flex gap-2 mt-1">
                  <Textarea rows={2} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Outcome / treatment summary…" />
                  <Button variant="hero" disabled={!feedback.trim() || busy} onClick={() => updateStatus(ref.status, { hospital_feedback: feedback })}>Send</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5 no-print">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Timeline</h3>
            <ol className="space-y-3 relative border-l-2 border-border ml-2 pl-5">
              {hist.map(h => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-card" />
                  <p className="text-sm font-medium">{h.from_status ? `${h.from_status} → ` : "Created as "}<span className="capitalize">{h.to_status.replace(/_/g," ")}</span></p>
                  <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <MessagePanel referralId={ref.id} readOnly={isCompleted && !canOverrideCompletedLock} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{title}</p>
      <div>{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
