import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

interface Hospital { id: string; name: string; city: string | null; type: string; }

export default function CreateReferral() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    patient_name: "", patient_age: "", patient_gender: "" as "" | "male" | "female" | "other", patient_phone: "",
    diagnosis: "", symptoms: "", urgency_level: "medium" as "low" | "medium" | "high" | "critical",
    referral_reason: "", hospital_id: "", notes: "",
  });

  useEffect(() => {
    supabase.from("hospitals").select("id,name,city,type").order("name").then(({ data }) => setHospitals((data ?? []) as Hospital[]));
  }, []);

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.clinic_id) return toast.error("Your account is not linked to a clinic");
    if (!form.hospital_id) return toast.error("Select a preferred hospital");
    setBusy(true);
    try {
      const { data: ref, error } = await supabase.from("referrals").insert({
        patient_name: form.patient_name,
        patient_age: form.patient_age ? Number(form.patient_age) : null,
        patient_gender: form.patient_gender || null,
        patient_phone: form.patient_phone || null,
        diagnosis: form.diagnosis,
        symptoms: form.symptoms,
        urgency_level: form.urgency_level,
        referral_reason: form.referral_reason,
        notes: form.notes,
        hospital_id: form.hospital_id,
        clinic_id: profile.clinic_id,
        created_by: user!.id,
        status: "new",
      }).select("id").single();
      if (error) throw error;

      // Upload files
      for (const f of files) {
        const path = `${ref.id}/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("referral-attachments").upload(path, f);
        if (upErr) { console.error(upErr); continue; }
        await supabase.from("referral_attachments").insert({
          referral_id: ref.id, file_path: path, file_name: f.name, mime_type: f.type, size_bytes: f.size, uploaded_by: user!.id,
        });
      }

      toast.success("Referral submitted");
      nav(`/clinic/referrals/${ref.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">New Referral</h1>
        <p className="text-muted-foreground">Complete all sections — referrals are saved as structured records.</p>
      </div>

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

        <Section title="Clinical Information">
          <Field label="Diagnosis *"><Textarea required rows={2} value={form.diagnosis} onChange={e => update("diagnosis", e.target.value)} /></Field>
          <Field label="Symptoms"><Textarea rows={3} value={form.symptoms} onChange={e => update("symptoms", e.target.value)} /></Field>
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
            <Field label="Preferred Hospital *">
              <Select value={form.hospital_id} onValueChange={v => update("hospital_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select hospital" /></SelectTrigger>
                <SelectContent>
                  {hospitals.map(h => <SelectItem key={h.id} value={h.id}>{h.name}{h.city ? ` — ${h.city}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Attachments & Notes">
          <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={e => update("notes", e.target.value)} /></Field>
          <Field label="Attachments">
            <label className="flex items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary transition-colors">
              <input type="file" multiple className="hidden" onChange={e => setFiles(Array.from(e.target.files ?? []))} />
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
