import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Inbox, Flame, CheckCircle2, XCircle, ClipboardList, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Row { id: string; referral_number: string | null; patient_name: string; status: string; urgency_level: string; created_at: string; clinics: { name: string } | null; }

export default function HospitalDashboard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const hospitalId = profile?.hospital_id ?? null;

  const load = useCallback(async () => {
    if (!hospitalId) return;
    const { data } = await supabase.from("referrals")
      .select("id, referral_number, patient_name, status, urgency_level, created_at, clinics(name)")
      .eq("hospital_id", hospitalId)
      .order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as unknown as Row[]);
  }, [hospitalId]);

  useEffect(() => {
    load();
    if (!hospitalId) return;
    const ch = supabase.channel("hosp-refs")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals", filter: `hospital_id=eq.${hospitalId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hospitalId, load]);

  const c = {
    new: rows.filter(r => r.status === "new").length,
    high: rows.filter(r => ["high","critical"].includes(r.urgency_level) && !["completed","rejected"].includes(r.status)).length,
    accepted: rows.filter(r => r.status === "accepted").length,
    rejected: rows.filter(r => r.status === "rejected").length,
    assigned: rows.filter(r => ["assigned","treated"].includes(r.status)).length,
    completed: rows.filter(r => r.status === "completed").length,
  };

  const priority = rows.filter(r => ["new","under_review"].includes(r.status)).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold">Hospital Overview</h1>
            <p className="text-muted-foreground mt-1">Review incoming referrals, prioritize critical cases, and monitor outcomes.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/hospital/inbox"><Button variant="outlineBrand">Open Inbox</Button></Link>
            <Link to="/hospital/assigned"><Button variant="outline">Assigned cases</Button></Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="New" value={c.new} icon={<Inbox className="h-5 w-5" />} accent="info" />
        <StatCard label="High Priority" value={c.high} icon={<Flame className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Accepted" value={c.accepted} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Rejected" value={c.rejected} icon={<XCircle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Assigned" value={c.assigned} icon={<ClipboardList className="h-5 w-5" />} accent="primary" />
        <StatCard label="Completed" value={c.completed} icon={<Award className="h-5 w-5" />} accent="gold" />
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Priority Queue</h2>
            <Link to="/hospital/inbox" className="text-sm text-primary hover:underline">Open inbox →</Link>
          </div>
          {priority.length === 0 ? <p className="p-10 text-center text-muted-foreground">Nothing pending. Great work.</p> :
            <div className="divide-y">
              {priority.map(r => (
                <Link key={r.id} to={`/hospital/referrals/${r.id}/review`} className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-secondary/40">
                  <div className="col-span-12 md:col-span-3 font-mono text-xs text-muted-foreground">{r.referral_number}</div>
                  <div className="col-span-7 md:col-span-3 font-medium">{r.patient_name}</div>
                  <div className="col-span-5 md:col-span-2 text-sm text-muted-foreground">{r.clinics?.name}</div>
                  <div className="col-span-6 md:col-span-2"><UrgencyBadge level={r.urgency_level} /></div>
                  <div className="col-span-6 md:col-span-2"><StatusBadge status={r.status} /></div>
                </Link>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
