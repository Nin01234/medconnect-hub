import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { MessagePanel } from "@/components/MessagePanel";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Printer, Download, Paperclip, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Referral {
  id: string; referral_number: string | null; patient_name: string; patient_age: number | null; patient_gender: string | null;
  patient_phone: string | null; diagnosis: string | null; symptoms: string | null; urgency_level: string;
  referral_reason: string | null; notes: string | null; status: string; rejection_reason: string | null;
  hospital_feedback: string | null; clinic_id: string | null; hospital_id: string | null; assigned_doctor_id: string | null;
  created_at: string; updated_at: string;
  clinics: { name: string; city: string | null; contact: string | null; region: string | null } | null;
  hospitals: { name: string; city: string | null } | null;
  doctors: { full_name: string; specialty: string | null } | null;
}
interface Att { id: string; file_path: string; file_name: string; mime_type: string | null; }
interface Hist { id: string; from_status: string | null; to_status: string; created_at: string; note: string | null; }
interface Doctor { id: string; full_name: string; specialty: string | null; }

export default function ReferralDetail({ portal }: { portal: "clinic" | "hospital" }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { roles, profile } = useAuth();
  const [ref, setRef] = useState<Referral | null>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [hist, setHist] = useState<Hist[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [doctorId, setDoctorId] = useState("");

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("referrals")
      .select("*, clinics(name,city,contact,region), hospitals(name,city), doctors(full_name,specialty)")
      .eq("id", id).maybeSingle();
    setRef(data as unknown as Referral);
    const [{ data: a }, { data: h }] = await Promise.all([
      supabase.from("referral_attachments").select("*").eq("referral_id", id),
      supabase.from("referral_status_history").select("*").eq("referral_id", id).order("created_at"),
    ]);
    setAtts((a ?? []) as Att[]);
    setHist((h ?? []) as Hist[]);
    if (portal === "hospital" && profile?.hospital_id) {
      const { data: d } = await supabase.from("doctors").select("id,full_name,specialty").eq("hospital_id", profile.hospital_id).eq("status","active");
      setDoctors((d ?? []) as Doctor[]);
    }
  };

  useEffect(() => {
    load();
    if (!id) return;
    const ch = supabase.channel(`ref-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!ref) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  const isHospital = portal === "hospital";
  const canHospitalAct = isHospital && hasRole(roles, "hospital_admin", "hospital_staff", "admin");

  const updateStatus = async (status: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const { error } = await supabase.from("referrals").update({ status, ...extra }).eq("id", ref.id);
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const downloadFile = async (att: Att) => {
    const { data, error } = await supabase.storage.from("referral-attachments").createSignedUrl(att.file_path, 60);
    if (error || !data) return toast.error("Could not generate link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between no-print flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
      </div>

      <Card className="shadow-elevated">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-5 mb-5 flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Medical Referral</p>
              <h1 className="font-display text-3xl font-bold mt-1">{ref.patient_name}</h1>
              <p className="font-mono text-sm text-muted-foreground mt-1">{ref.referral_number}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={ref.status} />
              <UrgencyBadge level={ref.urgency_level} />
              <p className="text-xs text-muted-foreground">{new Date(ref.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Sections */}
          <div className="grid md:grid-cols-2 gap-6">
            <Section title="Patient Information">
              <Row k="Full Name" v={ref.patient_name} />
              <Row k="Age" v={ref.patient_age?.toString() ?? "—"} />
              <Row k="Gender" v={ref.patient_gender ?? "—"} />
              <Row k="Phone" v={ref.patient_phone ?? "—"} />
            </Section>
            <Section title="Clinic Information">
              <Row k="Clinic" v={ref.clinics?.name ?? "—"} />
              <Row k="City" v={ref.clinics?.city ?? "—"} />
              <Row k="Region" v={ref.clinics?.region ?? "—"} />
              <Row k="Contact" v={ref.clinics?.contact ?? "—"} />
            </Section>
          </div>

          <div className="mt-6 space-y-5">
            <Section title="Diagnosis"><p className="text-sm leading-relaxed whitespace-pre-wrap">{ref.diagnosis ?? "—"}</p></Section>
            <Section title="Symptoms"><p className="text-sm leading-relaxed whitespace-pre-wrap">{ref.symptoms ?? "—"}</p></Section>
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

          {ref.hospital_feedback && (
            <div className="mt-6 bg-success/10 border border-success/30 rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-success tracking-wider">Hospital Feedback</p>
              <p className="mt-1 text-sm">{ref.hospital_feedback}</p>
            </div>
          )}
          {ref.rejection_reason && (
            <div className="mt-6 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-destructive tracking-wider">Rejection Reason</p>
              <p className="mt-1 text-sm">{ref.rejection_reason}</p>
            </div>
          )}
          {ref.doctors && (
            <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-xs uppercase font-semibold text-primary tracking-wider">Assigned Doctor</p>
              <p className="mt-1 font-medium">{ref.doctors.full_name}{ref.doctors.specialty ? ` · ${ref.doctors.specialty}` : ""}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hospital actions */}
      {canHospitalAct && (
        <Card className="shadow-card no-print">
          <CardContent className="p-6 space-y-4">
            <h3 className="font-display text-lg font-semibold">Hospital Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus("under_review")}>Mark Under Review</Button>
              <Button variant="hero" size="sm" disabled={busy} onClick={() => updateStatus("accepted")}>Accept</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus("info_requested")}>Request Info</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus("treated")}>Mark Treated</Button>
              <Button variant="gold" size="sm" disabled={busy} onClick={() => updateStatus("completed")}>Complete</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label>Assign to doctor</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={doctorId} onValueChange={setDoctorId}>
                    <SelectTrigger><SelectValue placeholder="Choose doctor" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` · ${d.specialty}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="hero" disabled={!doctorId || busy} onClick={() => updateStatus("assigned", { assigned_doctor_id: doctorId })}>Assign</Button>
                </div>
              </div>
              <div>
                <Label>Reject with reason</Label>
                <div className="flex gap-2 mt-1">
                  <Textarea rows={1} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason…" />
                  <Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => updateStatus("rejected", { rejection_reason: reason })}>Reject</Button>
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
        <MessagePanel referralId={ref.id} />
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
