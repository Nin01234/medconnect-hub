import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { FilePlus2, Send, Clock, CheckCircle2, XCircle, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string;
  referral_number: string | null;
  patient_name: string;
  status: string;
  urgency_level: string;
  created_at: string;
  hospital_feedback: string | null;
}

export default function ClinicDashboard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, accepted: 0, rejected: 0, completed: 0 });

  const load = async () => {
    if (!profile?.clinic_id) return;
    const { data } = await supabase.from("referrals")
      .select("id, referral_number, patient_name, status, urgency_level, created_at, hospital_feedback")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as Row[];
    setRows(list);
    setCounts({
      total: list.length,
      pending: list.filter(r => ["submitted","new","under_review","info_requested"].includes(r.status)).length,
      accepted: list.filter(r => ["accepted","assigned","treated"].includes(r.status)).length,
      rejected: list.filter(r => r.status === "rejected").length,
      completed: list.filter(r => r.status === "completed").length,
    });
  };

  useEffect(() => {
    load();
    if (!profile?.clinic_id) return;
    const ch = supabase.channel("clinic-referrals")
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals", filter: `clinic_id=eq.${profile.clinic_id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.clinic_id]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Clinic Overview</h1>
            <p className="text-muted-foreground mt-1">Track referral progress, urgency, and outcomes in real time.</p>
          </div>
          <Link to="/clinic/referrals/new"><Button variant="hero"><FilePlus2 className="h-4 w-4" /> Create Referral</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total" value={counts.total} icon={<Send className="h-5 w-5" />} accent="primary" />
        <StatCard label="Pending" value={counts.pending} icon={<Clock className="h-5 w-5" />} accent="warning" />
        <StatCard label="Accepted" value={counts.accepted} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Rejected" value={counts.rejected} icon={<XCircle className="h-5 w-5" />} accent="destructive" />
        <StatCard label="Completed" value={counts.completed} icon={<Award className="h-5 w-5" />} accent="primary" />
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="p-5 border-b">
            <h2 className="font-display text-xl font-semibold">Recent referrals</h2>
          </div>
          {rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No referrals yet. Create your first one.</div>
          ) : (
            <div className="divide-y">
              {rows.slice(0,8).map(r => (
                <Link key={r.id} to={`/clinic/referrals/${r.id}`} className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-secondary/40 transition-colors">
                  <div className="col-span-12 md:col-span-3 font-mono text-xs text-muted-foreground">{r.referral_number}</div>
                  <div className="col-span-6 md:col-span-4 font-medium">{r.patient_name}</div>
                  <div className="col-span-3 md:col-span-2"><UrgencyBadge level={r.urgency_level} /></div>
                  <div className="col-span-3 md:col-span-2 flex flex-wrap items-center gap-2 justify-end md:justify-start">
                    <StatusBadge status={r.status} />
                    {r.hospital_feedback?.trim() ? (
                      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-normal text-[10px] px-2 py-0">
                        Hospital feedback
                      </Badge>
                    ) : null}
                  </div>
                  <div className="hidden md:block md:col-span-1 text-xs text-muted-foreground text-right">{new Date(r.created_at).toLocaleDateString()}</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
