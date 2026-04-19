import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { referralKeys } from "@/lib/referralQueryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { FilePlus2, Send, Clock, CheckCircle2, XCircle, Award, Building2, Sparkles } from "lucide-react";
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

function AnimatedCount({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const start = displayValue;
    const end = value;
    if (start === end) return;

    const durationMs = 450;
    const startTs = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min((now - startTs) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + (end - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, displayValue]);

  return <span>{displayValue}</span>;
}

export default function ClinicDashboard() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const clinicId = profile?.clinic_id ?? null;
  const fallbackClinicName = profile?.clinics?.name?.trim() ?? "";

  const { data: clinicName = fallbackClinicName } = useQuery({
    queryKey: clinicId ? ["clinic", "name", clinicId] : ["clinic", "name", "inactive"],
    enabled: !!clinicId,
    initialData: fallbackClinicName,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("name")
        .eq("id", clinicId!)
        .maybeSingle();
      if (error) throw error;
      return data?.name?.trim() ?? fallbackClinicName;
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: clinicId ? referralKeys.clinicDashboard(clinicId) : ["referrals", "clinic", "inactive", "dashboard"],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, referral_number, patient_name, status, urgency_level, created_at, hospital_feedback")
        .eq("clinic_id", clinicId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const counts = useMemo(() => {
    const list = rows;
    return {
      total: list.length,
      pending: list.filter((r) => ["submitted", "new", "under_review", "info_requested"].includes(r.status)).length,
      accepted: list.filter((r) => ["accepted", "assigned", "treated"].includes(r.status)).length,
      rejected: list.filter((r) => r.status === "rejected").length,
      completed: list.filter((r) => r.status === "completed").length,
    };
  }, [rows]);

  const liveHighlights = useMemo(
    () => [
      "Track referral progress, urgency, and outcomes in real time.",
      "Monitor every referral stage from submission to completion.",
      "Stay ahead with instant visibility into urgent cases.",
    ],
    [],
  );
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % liveHighlights.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [liveHighlights.length]);

  const statusCards = [
    { label: "Total", value: counts.total, icon: Send, tone: "from-primary/20 to-primary/5 border-primary/30", iconTone: "text-primary bg-primary/15" },
    { label: "Pending", value: counts.pending, icon: Clock, tone: "from-amber-500/20 to-amber-500/5 border-amber-500/30", iconTone: "text-amber-600 dark:text-amber-300 bg-amber-500/15" },
    { label: "Accepted", value: counts.accepted, icon: CheckCircle2, tone: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30", iconTone: "text-emerald-600 dark:text-emerald-300 bg-emerald-500/15" },
    { label: "Rejected", value: counts.rejected, icon: XCircle, tone: "from-rose-500/20 to-rose-500/5 border-rose-500/30", iconTone: "text-rose-600 dark:text-rose-300 bg-rose-500/15" },
    { label: "Completed", value: counts.completed, icon: Award, tone: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30", iconTone: "text-indigo-600 dark:text-indigo-300 bg-indigo-500/15" },
  ] as const;

  const [debouncedRealtime, cancelDebouncedRealtime] = useDebouncedCallback(() => {
    if (clinicId) void queryClient.invalidateQueries({ queryKey: referralKeys.clinicRoot(clinicId) });
  }, 400);

  useEffect(() => {
    if (!clinicId) return;
    const ch = supabase
      .channel("clinic-referrals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "referrals", filter: `clinic_id=eq.${clinicId}` },
        debouncedRealtime,
      )
      .subscribe();
    return () => {
      cancelDebouncedRealtime();
      supabase.removeChannel(ch);
    };
  }, [clinicId, debouncedRealtime, cancelDebouncedRealtime]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 p-6 shadow-card">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Live dashboard
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Clinic Overview</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">Facility:</p>
              <p className="text-lg font-extrabold tracking-tight text-foreground">{clinicName || "Clinic name not set"}</p>
            </div>
            <p className="text-muted-foreground mt-2 min-h-6 transition-all duration-300">
              {liveHighlights[highlightIndex]}
            </p>
          </div>
          <Link to="/clinic/referrals/new">
            <Button variant="hero">
              <FilePlus2 className="h-4 w-4" /> Create Referral
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={`relative overflow-hidden border bg-gradient-to-br ${card.tone} shadow-card transition-transform duration-200 hover:-translate-y-0.5`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{card.label}</p>
                    <p className="font-display text-4xl font-bold mt-1 text-foreground">
                      <AnimatedCount value={card.value} />
                    </p>
                  </div>
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${card.iconTone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/40 transition-all duration-500"
                    style={{ width: `${counts.total > 0 ? Math.max((card.value / counts.total) * 100, 8) : 8}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
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
              {rows.slice(0, 8).map((r) => (
                <Link
                  key={r.id}
                  to={`/clinic/referrals/${r.id}`}
                  className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-secondary/40 transition-colors"
                >
                  <div className="col-span-12 md:col-span-3 font-mono text-xs text-muted-foreground">{r.referral_number}</div>
                  <div className="col-span-6 md:col-span-4 font-medium">{r.patient_name}</div>
                  <div className="col-span-3 md:col-span-2">
                    <UrgencyBadge level={r.urgency_level} />
                  </div>
                  <div className="col-span-3 md:col-span-2 flex flex-wrap items-center gap-2 justify-end md:justify-start">
                    <StatusBadge status={r.status} />
                    {r.hospital_feedback?.trim() ? (
                      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-normal text-[10px] px-2 py-0">
                        Hospital feedback
                      </Badge>
                    ) : null}
                  </div>
                  <div className="hidden md:block md:col-span-1 text-xs text-muted-foreground text-right">
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
