import { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { useDepartmentRow } from "@/hooks/useDepartmentRow";
import { referralKeys } from "@/lib/referralQueryKeys";
import {
  applyHospitalReferralListFilters,
  hospitalReferralListScopeKey,
  referralRowVisibleToHospitalViewer,
} from "@/lib/hospitalReferralListFilters";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Inbox, Flame, CheckCircle2, XCircle, ClipboardList, Award, Building2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string;
  referral_number: string | null;
  patient_name: string;
  status: string;
  urgency_level: string;
  created_at: string;
  assigned_staff_id: string | null;
  department_id: string | null;
  visible_to_all_departments: boolean;
  clinics: { name: string } | null;
}

/** Map realtime payload to dashboard row shape (joined `clinics` often missing until refetch). */
function rowFromReferralRealtime(record: Record<string, unknown>): Row | null {
  const id = record.id != null ? String(record.id) : null;
  if (!id) return null;
  return {
    id,
    referral_number: record.referral_number != null ? String(record.referral_number) : null,
    patient_name: typeof record.patient_name === "string" ? record.patient_name : "",
    status: typeof record.status === "string" ? record.status : "",
    urgency_level: typeof record.urgency_level === "string" ? record.urgency_level : "medium",
    created_at: record.created_at != null ? String(record.created_at) : new Date().toISOString(),
    assigned_staff_id: record.assigned_staff_id != null ? String(record.assigned_staff_id) : null,
    department_id: record.department_id != null ? String(record.department_id) : null,
    visible_to_all_departments: record.visible_to_all_departments === true,
    clinics: null,
  };
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

export default function HospitalDashboard() {
  const { profile, roles } = useAuth();
  const queryClient = useQueryClient();
  const isDoctorPortal =
    hasRole(roles, "doctor") && !hasRole(roles, "hospital_admin", "hospital_staff", "admin");
  const [agentDebug, setAgentDebug] = useState<Record<string, unknown> | null>(null);

  const hospitalId = profile?.hospital_id ?? null;
  const fallbackHospitalName = profile?.hospitals?.name?.trim() ?? "";
  const isHospitalStaff = hasRole(roles, "hospital_staff");
  /** Admins triage unassigned referrals; other roles use shared inbox + department queue. */
  const canTriageHospitalQueue = hasRole(roles, "admin") || hasRole(roles, "hospital_admin");
  const staffDepartmentId = profile?.department_id ?? null;
  const listScope = hospitalReferralListScopeKey(canTriageHospitalQueue, staffDepartmentId);
  const debugEnabled = useMemo(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      return p.get("debug") === "11eafa";
    } catch {
      return false;
    }
  }, []);

  const { data: deptRow } = useDepartmentRow(profile?.department_id, isHospitalStaff && !!profile?.department_id);
  const staffDepartmentName = deptRow?.status === "active" ? (deptRow?.name ?? "") : "";

  const { data: hospitalName = fallbackHospitalName } = useQuery({
    queryKey: hospitalId ? ["hospital", "name", hospitalId] : ["hospital", "name", "inactive"],
    enabled: !!hospitalId,
    initialData: fallbackHospitalName,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospitals")
        .select("name")
        .eq("id", hospitalId!)
        .maybeSingle();
      if (error) throw error;
      return data?.name?.trim() ?? fallbackHospitalName;
    },
  });

  const {
    data: rows = [],
    error: referralsError,
    isPending: referralsQueryPending,
    isFetching,
  } = useQuery({
    queryKey: hospitalId ? referralKeys.hospitalDashboard(hospitalId, listScope) : ["referrals", "hospital", "inactive", "dashboard"],
    enabled: !!hospitalId,
    queryFn: async () => {
      let query = supabase
        .from("referrals")
        .select(
          "id, referral_number, patient_name, status, urgency_level, created_at, assigned_staff_id, department_id, visible_to_all_departments, clinics(name)",
        )
        .eq("hospital_id", hospitalId!);
      query = applyHospitalReferralListFilters(query, {
        canTriageHospitalQueue,
        departmentId: staffDepartmentId,
      });
      const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
      if (error) {
        throw error;
      }
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    if (!hospitalId) return;

    const dashKey = referralKeys.hospitalDashboard(hospitalId, listScope);
    const filter = `hospital_id=eq.${hospitalId}`;
    const visibilityOpts = { canTriageHospitalQueue, departmentId: staffDepartmentId };
    const channelName = canTriageHospitalQueue ? `hospital-admin-${hospitalId}` : `hospital-staff-${hospitalId}`;

    const onInsert = (payload: { new: Record<string, unknown> }) => {
      const incoming = rowFromReferralRealtime(payload.new);
      if (!incoming) return;
      if (!referralRowVisibleToHospitalViewer(payload.new, visibilityOpts)) return;
      queryClient.setQueryData<Row[]>(dashKey, (prev) => {
        const list = prev ?? [];
        if (list.some((r) => r.id === incoming.id)) return list;
        return [incoming, ...list].slice(0, 100);
      });
      toast.success(`New referral: ${incoming.referral_number ?? "—"} — ${incoming.urgency_level}`);
    };

    const onUpdate = (payload: { new: Record<string, unknown> }) => {
      const patch = rowFromReferralRealtime(payload.new);
      if (!patch) return;
      const visible = referralRowVisibleToHospitalViewer(payload.new, visibilityOpts);
      queryClient.setQueryData<Row[]>(dashKey, (prev) => {
        const list = prev ?? [];
        const i = list.findIndex((r) => r.id === patch.id);
        if (!visible) {
          if (i === -1) return list;
          return list.filter((r) => r.id !== patch.id);
        }
        if (i === -1) return [patch, ...list].slice(0, 100);
        const merged: Row = {
          ...list[i],
          ...patch,
          clinics: list[i].clinics ?? patch.clinics,
        };
        const next = [...list];
        next[i] = merged;
        return next;
      });
    };

    const onDelete = (payload: { old: Record<string, unknown> }) => {
      const rid = payload.old?.id != null ? String(payload.old.id) : null;
      if (!rid) return;
      queryClient.setQueryData<Row[]>(dashKey, (prev) => (prev ?? []).filter((r) => r.id !== rid));
    };

    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "referrals", filter }, onInsert)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "referrals", filter }, onUpdate)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "referrals", filter }, onDelete)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [hospitalId, listScope, canTriageHospitalQueue, staffDepartmentId, queryClient]);

  const c = useMemo(
    () => ({
      new: rows.filter((r) => r.status === "new").length,
      high: rows.filter((r) => ["high", "critical"].includes(r.urgency_level) && !["completed", "rejected"].includes(r.status)).length,
      accepted: rows.filter((r) => r.status === "accepted").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      assigned: rows.filter((r) => ["assigned", "treated"].includes(r.status)).length,
      completed: rows.filter((r) => r.status === "completed").length,
    }),
    [rows],
  );

  const priority = useMemo(
    () =>
      rows
        .filter((r) => ["new", "under_review", "accepted", "assigned", "info_requested"].includes(r.status))
        .slice(0, 6),
    [rows],
  );

  const showPriorityQueueLoading = !!hospitalId && referralsQueryPending;

  const heroHighlights = useMemo(
    () => [
      "Review incoming referrals, prioritize critical cases, and monitor outcomes.",
      "Coordinate high-priority decisions with real-time operational clarity.",
      "Track referral movement from intake to completion without delays.",
    ],
    [],
  );
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % heroHighlights.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [heroHighlights.length]);

  if (isDoctorPortal) return <Navigate to="/hospital/doctor" replace />;

  const totalCases = c.new + c.high + c.accepted + c.rejected + c.assigned + c.completed;
  const statusCards = [
    { label: "New", value: c.new, icon: Inbox, tone: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30", iconTone: "text-cyan-600 dark:text-cyan-300 bg-cyan-500/15" },
    { label: "High Priority", value: c.high, icon: Flame, tone: "from-rose-500/20 to-rose-500/5 border-rose-500/30", iconTone: "text-rose-600 dark:text-rose-300 bg-rose-500/15" },
    { label: "Accepted", value: c.accepted, icon: CheckCircle2, tone: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30", iconTone: "text-emerald-600 dark:text-emerald-300 bg-emerald-500/15" },
    { label: "Rejected", value: c.rejected, icon: XCircle, tone: "from-amber-500/20 to-amber-500/5 border-amber-500/30", iconTone: "text-amber-600 dark:text-amber-300 bg-amber-500/15" },
    { label: "Assigned", value: c.assigned, icon: ClipboardList, tone: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30", iconTone: "text-indigo-600 dark:text-indigo-300 bg-indigo-500/15" },
    { label: "Completed", value: c.completed, icon: Award, tone: "from-violet-500/20 to-violet-500/5 border-violet-500/30", iconTone: "text-violet-600 dark:text-violet-300 bg-violet-500/15" },
  ] as const;

  return (
    <div className="space-y-6">
      {debugEnabled && (
        <pre
          data-agent-debug="11eafa"
          className="rounded-lg border bg-secondary/20 p-3 text-xs overflow-auto whitespace-pre-wrap"
        >
          {JSON.stringify(
            {
              agentDebug,
              queryState: {
                isPending: referralsQueryPending,
                isFetching,
                hasError: !!referralsError,
                rows: rows.length,
              },
            },
            null,
            2,
          )}
        </pre>
      )}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-cyan-500/10 p-6 shadow-card">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Smart operations view
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">Hospital Overview</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">Facility:</p>
              <p className="text-lg font-extrabold tracking-tight text-foreground">{hospitalName || "Hospital name not set"}</p>
            </div>
            {profile?.full_name && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">User: {profile.full_name}</span>
                <Badge variant="outline" className="capitalize text-xs font-normal border-primary/40 bg-primary/10 text-primary">
                  {(profile.role ?? "staff").replace("_", " ")}
                </Badge>
              </div>
            )}
            <p className="text-muted-foreground mt-2 min-h-6 transition-all duration-300">{heroHighlights[highlightIndex]}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Account ID: <span className="font-mono">{profile?.unique_id ?? "—"}</span>
            </p>
            {hasRole(roles, "hospital_staff") && (
              <p className="mt-1 text-xs text-muted-foreground">
                Staff ID: <span className="font-mono">{profile?.staff_id ?? "—"}</span>
              </p>
            )}
            {isHospitalStaff && (
              <p className="mt-1 text-xs text-muted-foreground">
                Department: <span className="font-semibold">{staffDepartmentName || "Not assigned"}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link to="/hospital/inbox">
              <Button variant="outlineBrand">Open Inbox</Button>
            </Link>
            <Link to="/hospital/assigned">
              <Button variant="outline">Assigned cases</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={`relative overflow-hidden border bg-gradient-to-br ${card.tone} shadow-card transition-transform duration-200 hover:-translate-y-0.5`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{card.label}</p>
                    <p className="font-display text-3xl font-bold mt-1 text-foreground">
                      <AnimatedCount value={card.value} />
                    </p>
                  </div>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${card.iconTone}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground/40 transition-all duration-500"
                    style={{ width: `${totalCases > 0 ? Math.max((card.value / totalCases) * 100, 8) : 8}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Priority Queue</h2>
            <Link to="/hospital/inbox" className="text-sm text-primary hover:underline">
              Open inbox →
            </Link>
          </div>
          {showPriorityQueueLoading ? (
            <p className="p-10 text-center text-muted-foreground">Loading queue…</p>
          ) : priority.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground">Nothing pending. Great work.</p>
          ) : (
            <div className="divide-y">
              {priority.map((r) => (
                <Link key={r.id} to={`/hospital/referrals/${r.id}/review`} className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-secondary/40">
                  <div className="col-span-12 md:col-span-3 font-mono text-xs text-muted-foreground">{r.referral_number}</div>
                  <div className="col-span-7 md:col-span-3 font-medium">{r.patient_name}</div>
                  <div className="col-span-5 md:col-span-2 text-sm text-muted-foreground">{r.clinics?.name}</div>
                  <div className="col-span-6 md:col-span-2">
                    <UrgencyBadge level={r.urgency_level} />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <StatusBadge status={r.status} />
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
