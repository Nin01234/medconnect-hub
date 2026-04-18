import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";

interface Row { id: string; referral_number: string | null; patient_name: string; status: string; urgency_level: string; created_at: string; clinics: { name: string } | null; }

export default function HospitalInbox() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [urgency, setUrgency] = useState("all");

  const load = async () => {
    if (!profile?.hospital_id) return;
    const { data } = await supabase.from("referrals")
      .select("id, referral_number, patient_name, status, urgency_level, created_at, clinics(name)")
      .eq("hospital_id", profile.hospital_id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as Row[]);
  };
  useEffect(() => {
    load();
    if (!profile?.hospital_id) return;
    const ch = supabase.channel("inbox").on("postgres_changes", { event: "*", schema: "public", table: "referrals", filter: `hospital_id=eq.${profile.hospital_id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.hospital_id]);

  const normalizedQuery = q.trim().toLowerCase();
  const filtered = rows.filter(r =>
    (status === "all" || r.status === status) &&
    (urgency === "all" || r.urgency_level === urgency) &&
    (
      normalizedQuery === "" ||
      r.patient_name.toLowerCase().includes(normalizedQuery) ||
      r.referral_number?.toLowerCase().includes(normalizedQuery) ||
      r.clinics?.name?.toLowerCase().includes(normalizedQuery)
    )
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Referral Inbox</h1>
        <p className="text-muted-foreground">{filtered.length} of {rows.length} referrals</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search patient, ref #, clinic" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["new","under_review","accepted","assigned","treated","completed","rejected","info_requested"].map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All urgency</SelectItem>
            {["low","medium","high","critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="text-left px-5 py-3">Ref #</th>
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">From Clinic</th>
                <th className="text-left px-5 py-3">Urgency</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-mono text-xs"><Link to={`/hospital/referrals/${r.id}/review`} className="text-primary hover:underline">{r.referral_number}</Link></td>
                  <td className="px-5 py-3 font-medium">{r.patient_name}</td>
                  <td className="px-5 py-3">{r.clinics?.name ?? "—"}</td>
                  <td className="px-5 py-3"><UrgencyBadge level={r.urgency_level} /></td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No referrals match.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
