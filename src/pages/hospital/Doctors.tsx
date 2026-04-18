import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { doctorCreateSchema } from "@/lib/validation";
import { sanitizeText } from "@/lib/sanitize";
import { safeClientError } from "@/lib/safeError";

interface Doctor { id: string; unique_id: string | null; full_name: string; specialty: string | null; phone: string | null; email: string | null; status: string; }

export default function Doctors() {
  const { profile, roles } = useAuth();
  const canManage = hasRole(roles, "hospital_admin", "admin");
  const [list, setList] = useState<Doctor[]>([]);
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ full_name: "", specialty: "", phone: "", email: "" });

  const hospitalId = profile?.hospital_id ?? null;

  const load = useCallback(async () => {
    if (!hospitalId) return;
    const { data } = await supabase.from("doctors").select("*").eq("hospital_id", hospitalId).order("created_at",{ascending:false});
    setList((data ?? []) as Doctor[]);
    // Workload counts
    const { data: refs } = await supabase.from("referrals").select("assigned_doctor_id").eq("hospital_id", hospitalId).in("status",["assigned","treated"]);
    const c: Record<string, number> = {};
    (refs ?? []).forEach(r => { if (r.assigned_doctor_id) c[r.assigned_doctor_id] = (c[r.assigned_doctor_id] ?? 0) + 1; });
    setCounts(c);
  }, [hospitalId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!profile?.hospital_id) return;
    const parsed = doctorCreateSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
      return;
    }
    const d = parsed.data;
    try {
      const { error } = await supabase.from("doctors").insert({
        full_name: sanitizeText(d.full_name, 200),
        specialty: d.specialty ? sanitizeText(d.specialty, 200) : null,
        phone: d.phone ? sanitizeText(d.phone, 40) : null,
        email: d.email ? sanitizeText(d.email, 320) : null,
        hospital_id: profile.hospital_id,
      });
      if (error) throw error;
      toast.success("Doctor added");
      setForm({ full_name: "", specialty: "", phone: "", email: "" });
      setOpen(false); load();
    } catch (e) {
      toast.error(safeClientError(e));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Doctors</h1>
          <p className="text-muted-foreground">Hospital doctor roster & workload.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="hero"><Plus className="h-4 w-4" /> Add doctor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New doctor</DialogTitle>
                <DialogDescription>Add a doctor to the hospital roster.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
                <div><Label>Specialty</Label><Input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <Button onClick={create} variant="hero" className="w-full" disabled={!form.full_name}>Add</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(d => (
          <Card key={d.id} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-semibold">{d.full_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">Doctor ID: {d.unique_id ?? "—"}</p>
                  <p className="text-sm text-muted-foreground">{d.specialty ?? "General"}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{counts[d.id] ?? 0} active</span>
              </div>
              <div className="text-xs text-muted-foreground mt-3 space-y-0.5">
                {d.email && <p>{d.email}</p>}
                {d.phone && <p>{d.phone}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && <p className="text-muted-foreground">No doctors yet.</p>}
      </div>
    </div>
  );
}
