import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import {
  applyHospitalReferralListFilters,
  hospitalReferralListScopeKey,
  referralRowVisibleToHospitalViewer,
} from "@/lib/hospitalReferralListFilters";
import { referralKeys } from "@/lib/referralQueryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { sanitizeText } from "@/lib/sanitize";
import { toast } from "sonner";

interface Row {
  id: string;
  referral_number: string | null;
  patient_id: string | null;
  patient_name: string;
  status: string;
  urgency_level: string;
  created_at: string;
  clinics: { name: string } | null;
}

function inboxRowFromRealtime(record: Record<string, unknown>): Row | null {
  const id = record.id != null ? String(record.id) : null;
  if (!id) return null;
  return {
    id,
    referral_number: record.referral_number != null ? String(record.referral_number) : null,
    patient_id: record.patient_id != null ? String(record.patient_id) : null,
    patient_name: typeof record.patient_name === "string" ? record.patient_name : "",
    status: typeof record.status === "string" ? record.status : "",
    urgency_level: typeof record.urgency_level === "string" ? record.urgency_level : "medium",
    created_at: record.created_at != null ? String(record.created_at) : new Date().toISOString(),
    clinics: null,
  };
}

export default function HospitalInbox() {
  const { profile, roles } = useAuth();
  const isDoctorPortal =
    hasRole(roles, "doctor") && !hasRole(roles, "hospital_admin", "hospital_staff", "admin");
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [agentDebug, setAgentDebug] = useState<Record<string, unknown> | null>(null);

  const hospitalId = profile?.hospital_id ?? null;
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

  const {
    data: rows = [],
    error: referralsError,
    isFetching,
    isPending,
  } = useQuery({
    queryKey: hospitalId ? referralKeys.hospitalInbox(hospitalId, listScope) : ["referrals", "hospital", "inactive", "inbox"],
    enabled: !!hospitalId,
    queryFn: async () => {
      let query = supabase
        .from("referrals")
        .select("id, referral_number, patient_id, patient_name, status, urgency_level, created_at, clinics(name)")
        .eq("hospital_id", hospitalId!);
      query = applyHospitalReferralListFilters(query, {
        canTriageHospitalQueue,
        departmentId: staffDepartmentId,
      });
      const { data, error } = await query.order("created_at", { ascending: false }).limit(400);
      if (error) {
        // #region agent log (debug-mode)
        fetch("http://127.0.0.1:7930/ingest/ffa8cccd-d5ba-44b3-8be7-88ecdf51e175", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "11eafa" },
          body: JSON.stringify({
            sessionId: "11eafa",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "src/pages/hospital/HospitalInbox.tsx:queryFn",
            message: "HospitalInbox referrals query error",
            data: {
              hasHospitalId: !!hospitalId,
              canTriageHospitalQueue,
              hasStaffDepartmentId: !!staffDepartmentId,
              listScope,
              supabaseErrorCode: (error as { code?: unknown })?.code ?? null,
              supabaseErrorMessage: (error as { message?: unknown })?.message ?? null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log (debug-mode)
        throw error;
      }
      // #region agent log (debug-mode)
      fetch("http://127.0.0.1:7930/ingest/ffa8cccd-d5ba-44b3-8be7-88ecdf51e175", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "11eafa" },
        body: JSON.stringify({
          sessionId: "11eafa",
          runId: "pre-fix",
          hypothesisId: "H2",
          location: "src/pages/hospital/HospitalInbox.tsx:queryFn",
          message: "HospitalInbox referrals query ok",
          data: {
            hasHospitalId: !!hospitalId,
            canTriageHospitalQueue,
            hasStaffDepartmentId: !!staffDepartmentId,
            listScope,
            rowCount: Array.isArray(data) ? data.length : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log (debug-mode)
      return (data ?? []) as unknown as Row[];
    },
    onSuccess: (data) => {
      if (!debugEnabled) return;
      setAgentDebug({
        page: "HospitalInbox",
        hasHospitalId: !!hospitalId,
        canTriageHospitalQueue,
        hasStaffDepartmentId: !!staffDepartmentId,
        listScope,
        rowCount: Array.isArray(data) ? data.length : null,
      });
    },
    onError: (err) => {
      if (!debugEnabled) return;
      const e = err as { code?: unknown; message?: unknown };
      setAgentDebug({
        page: "HospitalInbox",
        hasHospitalId: !!hospitalId,
        canTriageHospitalQueue,
        hasStaffDepartmentId: !!staffDepartmentId,
        listScope,
        supabaseErrorCode: e?.code ?? null,
        supabaseErrorMessage: e?.message ?? null,
      });
    },
  });

  useEffect(() => {
    if (!hospitalId) return;
    // #region agent log (debug-mode)
    fetch("http://127.0.0.1:7930/ingest/ffa8cccd-d5ba-44b3-8be7-88ecdf51e175", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "11eafa" },
      body: JSON.stringify({
        sessionId: "11eafa",
        runId: "pre-fix",
        hypothesisId: "H0",
        location: "src/pages/hospital/HospitalInbox.tsx:useEffect",
        message: "HospitalInbox effect mounted",
        data: {
          hasHospitalId: !!hospitalId,
          canTriageHospitalQueue,
          hasStaffDepartmentId: !!staffDepartmentId,
          listScope,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log (debug-mode)

    const inboxKey = referralKeys.hospitalInbox(hospitalId, listScope);
    const filter = `hospital_id=eq.${hospitalId}`;
    const visibilityOpts = { canTriageHospitalQueue, departmentId: staffDepartmentId };
    const channelName = canTriageHospitalQueue ? `hospital-admin-${hospitalId}-inbox` : `hospital-staff-${hospitalId}-inbox`;

    const onInsert = (payload: { new: Record<string, unknown> }) => {
      const incoming = inboxRowFromRealtime(payload.new);
      if (!incoming) return;
      if (!referralRowVisibleToHospitalViewer(payload.new, visibilityOpts)) return;
      queryClient.setQueryData<Row[]>(inboxKey, (prev) => {
        const list = prev ?? [];
        if (list.some((r) => r.id === incoming.id)) return list;
        return [incoming, ...list].slice(0, 400);
      });
      toast.success(`New referral: ${incoming.referral_number ?? "—"}`);
    };

    const onUpdate = (payload: { new: Record<string, unknown> }) => {
      const patch = inboxRowFromRealtime(payload.new);
      if (!patch) return;
      const visible = referralRowVisibleToHospitalViewer(payload.new, visibilityOpts);
      queryClient.setQueryData<Row[]>(inboxKey, (prev) => {
        const list = prev ?? [];
        const i = list.findIndex((r) => r.id === patch.id);
        if (!visible) {
          if (i === -1) return list;
          return list.filter((r) => r.id !== patch.id);
        }
        if (i === -1) return [patch, ...list].slice(0, 400);
        const merged: Row = { ...list[i], ...patch, clinics: list[i].clinics ?? patch.clinics };
        const next = [...list];
        next[i] = merged;
        return next;
      });
    };

    const onDelete = (payload: { old: Record<string, unknown> }) => {
      const rid = payload.old?.id != null ? String(payload.old.id) : null;
      if (!rid) return;
      queryClient.setQueryData<Row[]>(inboxKey, (prev) => (prev ?? []).filter((r) => r.id !== rid));
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

  if (isDoctorPortal) return <Navigate to="/hospital/doctor" replace />;

  const normalizedQuery = sanitizeText(q, 200).toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (urgency === "all" || r.urgency_level === urgency) &&
      (normalizedQuery === "" ||
        r.patient_name.toLowerCase().includes(normalizedQuery) ||
        r.referral_number?.toLowerCase().includes(normalizedQuery) ||
        r.clinics?.name?.toLowerCase().includes(normalizedQuery)),
  );

  return (
    <div className="space-y-5">
      {debugEnabled && (
        <pre
          data-agent-debug="11eafa"
          className="rounded-lg border bg-secondary/20 p-3 text-xs overflow-auto whitespace-pre-wrap"
        >
          {JSON.stringify(
            {
              agentDebug,
              queryState: { isPending, isFetching, hasError: !!referralsError, rows: rows.length },
            },
            null,
            2,
          )}
        </pre>
      )}
      <div>
        <h1 className="font-display text-3xl font-bold">Referral Inbox</h1>
        <p className="text-muted-foreground">
          {filtered.length} of {rows.length} referrals
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search patient, ref #, clinic" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["new", "under_review", "accepted", "assigned", "treated", "completed", "rejected", "info_requested"].map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={urgency} onValueChange={setUrgency}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All urgency</SelectItem>
            {["low", "medium", "high", "critical"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
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
                <th className="text-left px-5 py-3">Patient history</th>
                <th className="text-left px-5 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link to={`/hospital/referrals/${r.id}/review`} className="text-primary hover:underline">
                      {r.referral_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium">{r.patient_name}</td>
                  <td className="px-5 py-3">{r.clinics?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <UrgencyBadge level={r.urgency_level} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {r.patient_id ? (
                      <Link to={`/hospital/patients/${r.patient_id}`} className="text-primary hover:underline">
                        View history
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No referrals match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
