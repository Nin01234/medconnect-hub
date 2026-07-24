import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { MessagePanel, type ReferralChatMessage } from "@/components/MessagePanel";
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
  source_department: { id: string; name: string } | null;
}
interface Att { id: string; file_path: string; file_name: string; mime_type: string | null; }
interface Hist {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  note: string | null;
  changed_by?: string | null;
}

function referralMessageFromRealtime(record: Record<string, unknown>): ReferralChatMessage | null {
  const mid = record.id != null ? String(record.id) : null;
  const body = record.message;
  const created = record.created_at != null ? String(record.created_at) : null;
  if (!mid || typeof body !== "string" || !created) return null;
  return {
    id: mid,
    sender_id: record.sender_id != null ? String(record.sender_id) : null,
    message: body,
    created_at: created,
  };
}

function historyRowFromRealtime(record: Record<string, unknown>): Hist | null {
  const hid = record.id != null ? String(record.id) : null;
  if (!hid) return null;
  return {
    id: hid,
    from_status: record.from_status != null ? String(record.from_status) : null,
    to_status: typeof record.to_status === "string" ? record.to_status : "",
    created_at: record.created_at != null ? String(record.created_at) : new Date().toISOString(),
    note: record.note != null ? String(record.note) : null,
    changed_by: record.changed_by != null ? String(record.changed_by) : null,
  };
}

function attachmentFromRealtime(record: Record<string, unknown>): Att | null {
  const aid = record.id != null ? String(record.id) : null;
  if (!aid) return null;
  const fp = record.file_path;
  const fn = record.file_name;
  if (typeof fp !== "string" || typeof fn !== "string") return null;
  return {
    id: aid,
    file_path: fp,
    file_name: fn,
    mime_type: record.mime_type != null ? String(record.mime_type) : null,
  };
}
interface DepartmentOption { id: string; name: string }
interface DoctorOption { id: string; full_name: string; specialty: string | null; }

/** Narrow projection vs select('*') — smaller payload from PostgREST. */
const REFERRAL_DETAIL_SELECT =
  "id, unique_id, referral_number, patient_id, patient_name, patient_age, patient_gender, patient_phone, diagnosis, symptoms, urgency_level, vitals_bp, vitals_hr, vitals_temp, vitals_rr, vitals_spo2, referral_reason, notes, status, rejection_reason, hospital_feedback, clinic_id, hospital_id, assigned_department, department_id, assigned_staff_id, assigned_doctor_id, staff_assignment_locked, visible_to_all_departments, created_at, updated_at, created_by, clinics(name,unique_id,city,contact,region), hospitals(name,unique_id,city), departments!department_id(id,name), source_department:departments!source_department_id(id,name)";

export default function ReferralDetail({ portal }: { portal: "clinic" | "hospital" }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { roles, profile } = useAuth();
  const [ref, setRef] = useState<Referral | null>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [busy, setBusy] = useState(false);
  const runGuarded = useSubmitGuard();
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [newDoctor, setNewDoctor] = useState({ full_name: "", specialty: "", phone: "", email: "" });
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [visibleAllDepartments, setVisibleAllDepartments] = useState(false);
  const [completedBy, setCompletedBy] = useState<{ accountId: string | null; userId: string; name: string | null } | null>(null);
  const [messages, setMessages] = useState<ReferralChatMessage[]>([]);
  const [staffOptions, setStaffOptions] = useState<{ id: string; full_name: string | null; staff_id: string | null }[]>([]);
  const [staffId, setStaffId] = useState("");
  const [assignedStaffName, setAssignedStaffName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("referrals")
      .select(REFERRAL_DETAIL_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      toast.error(safeClientError(error));
      setRef(null);
      setMessages([]);
      return;
    }
    if (!data) {
      // Most common causes: not found, or blocked by RLS (not authorized for this referral).
      toast.error("Referral not found or you don’t have access.");
      setRef(null);
      setMessages([]);
      nav(-1);
      return;
    }
    setRef(data as unknown as Referral);
    setVisibleAllDepartments(Boolean((data as { visible_to_all_departments?: boolean }).visible_to_all_departments));
    const hospitalId = (data as { hospital_id?: string | null }).hospital_id;

    const [attRes, histRes, msgRes, depRes, docRes] = await Promise.all([
      supabase
        .from("referral_attachments")
        .select("id, file_path, file_name, mime_type, created_at, size_bytes, uploaded_by")
        .eq("referral_id", id),
      supabase
        .from("referral_status_history")
        .select("id, from_status, to_status, created_at, note, changed_by, referral_id")
        .eq("referral_id", id)
        .order("created_at"),
      supabase.from("referral_messages").select("id, sender_id, message, created_at").eq("referral_id", id).order("created_at"),
      hospitalId
        ? supabase
            .from("departments")
            .select("id,name")
            .eq("hospital_id", hospitalId)
            .eq("status", "active")
            .order("name")
        : Promise.resolve({ data: null, error: null }),
      hospitalId
        ? supabase
            .from("doctors")
            .select("id,full_name,specialty")
            .eq("hospital_id", hospitalId)
            .eq("status", "active")
            .order("full_name")
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (attRes.error) {
      toast.error(`Failed to load attachments: ${safeClientError(attRes.error)}`);
    }
    if (histRes.error) {
      toast.error(`Failed to load timeline: ${safeClientError(histRes.error)}`);
    }
    if (msgRes.error) {
      toast.error(`Failed to load messages: ${safeClientError(msgRes.error)}`);
    }
    setAtts((attRes.data ?? []) as Att[]);
    const historyRows = (histRes.data ?? []) as Hist[];
    setHist(historyRows);
    setMessages((msgRes.data ?? []) as ReferralChatMessage[]);

    if (hospitalId) {
      setDepartmentOptions((depRes.data ?? []) as DepartmentOption[]);
      setDoctorOptions((docRes.data ?? []) as DoctorOption[]);
    } else {
      setDepartmentOptions([]);
      setDoctorOptions([]);
    }

    // For dept-linked users (clinic_admin / clinic_staff) the staff to assign
    // are from THEIR OWN department, not referral.department_id which is the
    // hospital's receiving dept. Use profile.department_id when available.
    const callerDeptId = profile?.department_id ?? null;
    const isClinicAdminCaller = hasRole(roles, "clinic_admin");
    // Use caller's dept for dept-linked admin; fall back to referral's dept for hospital portal
    const staffDeptId = (isClinicAdminCaller && callerDeptId) ? callerDeptId
      : ((data as { department_id?: string | null }).department_id ?? null);

    if (staffDeptId) {
      const staffRes = await supabase
        .from("profiles")
        .select("id, full_name, staff_id")
        .eq("department_id", staffDeptId)
        .neq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
      if (staffRes.data) {
        const { data: roleRows } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "clinic_staff");
        const staffUserIds = new Set((roleRows ?? []).map((r) => r.user_id));
        const options = (staffRes.data as { id: string; full_name: string | null; staff_id: string | null }[])
          .filter((p) => staffUserIds.has(p.id))
          .map((p) => ({
            id: p.id,
            full_name: p.full_name,
            staff_id: p.staff_id,
          }));
        setStaffOptions(options);
        // Resolve assigned staff name from options or fetch it
        const assignedId = (data as { assigned_staff_id?: string | null }).assigned_staff_id;
        if (assignedId) {
          const found = options.find((s) => s.id === assignedId);
          if (found) {
            setAssignedStaffName(found.full_name ?? found.staff_id ?? assignedId);
          } else {
            const { data: actorRow } = await supabase
              .from("profiles")
              .select("full_name, staff_id")
              .eq("id", assignedId)
              .maybeSingle();
            setAssignedStaffName(actorRow?.full_name ?? actorRow?.staff_id ?? assignedId);
          }
        } else {
          setAssignedStaffName(null);
        }
      } else {
        setStaffOptions([]);
        setAssignedStaffName(null);
      }
    } else {
      setStaffOptions([]);
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

  useEffect(() => {
    load();
    if (!id) return;
    const ch = supabase
      .channel(`referral-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "referral_messages", filter: `referral_id=eq.${id}` },
        (p) => {
          const row = referralMessageFromRealtime(p.new as Record<string, unknown>);
          if (!row) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "referral_status_history", filter: `referral_id=eq.${id}` },
        (p) => {
          const row = historyRowFromRealtime(p.new as Record<string, unknown>);
          if (!row) return;
          setHist((prev) =>
            [...prev, row].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "referral_attachments", filter: `referral_id=eq.${id}` },
        (p) => {
          const row = attachmentFromRealtime(p.new as Record<string, unknown>);
          if (!row) return;
          setAtts((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "referrals", filter: `id=eq.${id}` },
        (p) => {
          const raw = p.new as Record<string, unknown>;
          setRef((prev) => {
            if (!prev) return prev;
            const spread = { ...prev, ...(raw as Partial<Referral>) };
            spread.clinics = prev.clinics;
            spread.hospitals = prev.hospitals;
            spread.departments = prev.departments;
            spread.source_department = prev.source_department;
            return spread as Referral;
          });
          setVisibleAllDepartments(raw.visible_to_all_departments === true);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, load]);

  if (!ref) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  const isHospital = portal === "hospital";
  const isHospitalAdmin = isHospital && hasRole(roles, "hospital_admin", "admin");
  const isHospitalStaff = isHospital && hasRole(roles, "hospital_staff");
  const isClinicAdmin = hasRole(roles, "clinic_admin");
  const isClinicStaff = hasRole(roles, "clinic_staff");
  const isDeptAdminForThisReferral =
    !isHospital &&
    isClinicAdmin &&
    !!profile?.department_id &&
    // Can act if they are the RECEIVING dept or the SENDING dept
    (ref?.department_id === profile?.department_id ||
      (ref as unknown as { source_department_id?: string | null })?.source_department_id === profile?.department_id);
  const canStaffAct = !isHospital && isClinicStaff && ref?.assigned_staff_id === profile?.id;
  // Hospital admins can view/assign referrals, but clinical triage actions are restricted to hospital staff and department admins/staff
  const canAct = isHospitalStaff || isDeptAdminForThisReferral || canStaffAct;
  const isCompleted = ref.status === "completed";
  const canOverrideCompletedLock = (isHospital && hasRole(roles, "hospital_admin", "admin")) || isDeptAdminForThisReferral;
  const canAccept = !["accepted", "rejected", "completed"].includes(ref.status);
  const canReject = !["accepted", "rejected", "completed"].includes(ref.status);

  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    const cleaned: Record<string, unknown> = { status, ...extra };
    if (typeof cleaned.rejection_reason === "string") {
      const s = sanitizeText(cleaned.rejection_reason, 12000);
      if (!s.trim()) {
        toast.error("Enter a rejection reason.");
        return;
      }
      cleaned.rejection_reason = s;
    }
    if (typeof cleaned.hospital_feedback === "string") {
      const s = sanitizeText(cleaned.hospital_feedback, 12000);
      if (!s.trim()) {
        toast.error("Enter feedback text.");
        return;
      }
      cleaned.hospital_feedback = s;
    }
    const referralId = ref.id;
    await runGuarded(async () => {
      setBusy(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("referrals").update(cleaned as any).eq("id", referralId);
        if (error) throw error;
        toast.success("Updated");
        load();
      } catch (e) {
        toast.error(safeClientError(e));
      } finally {
        setBusy(false);
      }
    });
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

  const assignStaff = async () => {
    if (!staffId) return;
    await updateStatus("assigned", { assigned_staff_id: staffId });
  };

  const createDoctor = async () => {
    const parsed = doctorCreateSchema.safeParse(newDoctor);
    if (!parsed.success || !ref.hospital_id) {
      toast.error(parsed.success ? "Hospital link is missing." : parsed.error.issues[0]?.message ?? "Invalid doctor details.");
      return;
    }
    const values = parsed.data;
    const hospitalId = ref.hospital_id;
    await runGuarded(async () => {
      const { data, error } = await supabase
        .from("doctors")
        .insert({
          hospital_id: hospitalId,
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
    });
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
            <Section title="Sending Department">
              <Row k="Department" v={ref.source_department?.name ?? ref.clinics?.name ?? "—"} />
              {ref.clinics && (
                <>
                  <Row k="City" v={ref.clinics.city ?? "—"} />
                  <Row k="Region" v={ref.clinics.region ?? "—"} />
                  <Row k="Contact" v={ref.clinics.contact ?? "—"} />
                </>
              )}
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
              <p className="mt-1 text-sm font-medium">
                {assignedStaffName ?? ref.assigned_staff_id}
              </p>
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

      {/* Hospital Admin Department Routing & Assignment */}
      {isHospitalAdmin && (!isCompleted || canOverrideCompletedLock) && (
        <Card className="shadow-card no-print">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Hospital Admin Routing &amp; Visibility</h3>
            <p className="text-xs text-muted-foreground">
              Route this referral to a specific hospital department or manage visibility across all departments.
            </p>
            <div className="max-w-md space-y-3">
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
              </div>
              <div>
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
          </CardContent>
        </Card>
      )}

      {/* Clinical Triage & Actions */}
      {canAct && (!isCompleted || canOverrideCompletedLock) && (
        <Card className="shadow-card no-print">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">{isHospital ? "Hospital Actions" : "Triage & Actions"}</h3>
            {isCompleted && canOverrideCompletedLock && (
              <p className="text-xs text-muted-foreground">
                Completed referral lock is active for staff.
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
              {isDeptAdminForThisReferral && (
                <div>
                  <Label>Assign staff member (Department Staff)</Label>
                  <div className="flex gap-2 mt-1">
                    <Select value={staffId} onValueChange={setStaffId}>
                      <SelectTrigger><SelectValue placeholder="Choose staff member" /></SelectTrigger>
                      <SelectContent>
                        {staffOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name || "Staff Member"} (ID: {s.staff_id || "—"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="hero" disabled={!staffId || busy} onClick={() => void assignStaff()}>
                      Assign
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
                <Label>Send feedback to sending department</Label>
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
        <MessagePanel
          referralId={ref.id}
          readOnly={isCompleted && !canOverrideCompletedLock}
          messages={messages}
          setMessages={setMessages}
        />
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
