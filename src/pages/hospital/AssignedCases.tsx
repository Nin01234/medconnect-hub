import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { referralKeys } from "@/lib/referralQueryKeys";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { toast } from "sonner";
import { safeClientError } from "@/lib/safeError";

interface Row {
  id: string;
  referral_number: string | null;
  patient_id: string | null;
  patient_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  department_id: string | null;
  assigned_department: string | null;
  assigned_staff_id: string | null;
  urgency_level: string;
  rejection_reason: string | null;
  hospital_feedback: string | null;
  clinics: { name: string } | null;
  departments: { name: string } | null;
}

const assignedWorkflowStatuses = ["accepted", "assigned", "rejected", "treated", "completed", "info_requested"] as const;

const statusCardTone: Record<string, string> = {
  accepted: "text-emerald-600",
  assigned: "text-indigo-600",
  rejected: "text-destructive",
  treated: "text-teal-600",
  completed: "text-primary",
  info_requested: "text-amber-600",
};

export default function AssignedCases() {
  const { profile, roles } = useAuth();
  const queryClient = useQueryClient();
  const hospitalId = profile?.hospital_id ?? null;
  const canSeeCompletionActor = hasRole(roles, "hospital_admin", "admin");
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [completedByAccountId, setCompletedByAccountId] = useState<Record<string, string>>({});

  const { data: rows = [] } = useQuery({
    queryKey: hospitalId ? referralKeys.hospitalAssigned(hospitalId) : ["referrals", "hospital", "inactive", "assigned"],
    enabled: !!hospitalId,
    queryFn: async () => {
      const isAssignedWorkflowStatus = (value: string) =>
        assignedWorkflowStatuses.includes(value as (typeof assignedWorkflowStatuses)[number]);
      const query = supabase
        .from("referrals")
        .select(
          "id, referral_number, patient_id, patient_name, status, created_at, updated_at, department_id, assigned_department, assigned_staff_id, urgency_level, rejection_reason, hospital_feedback, clinics(name)",
        )
        .eq("hospital_id", hospitalId!)
        .order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      const rows = ((data ?? []) as unknown as Omit<Row, "departments">[]).map((r) => ({
        ...r,
        departments: null,
      }));
      const filteredRows = rows.filter((r) => !!r.department_id || !!r.assigned_department || isAssignedWorkflowStatus(r.status));
      // If workflow flags are inconsistent in backend data, prefer showing hospital cases
      // instead of an empty assigned page.
      return filteredRows.length > 0 ? filteredRows : rows;
    },
  });

  const [debouncedRealtime, cancelDebouncedRealtime] = useDebouncedCallback(() => {
    if (hospitalId) void queryClient.invalidateQueries({ queryKey: referralKeys.hospitalRoot(hospitalId) });
  }, 400);

  useEffect(() => {
    if (!hospitalId) return;
    const ch = supabase
      .channel("assigned-cases")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "referrals", filter: `hospital_id=eq.${hospitalId}` },
        debouncedRealtime,
      )
      .subscribe();
    return () => {
      cancelDebouncedRealtime();
      supabase.removeChannel(ch);
    };
  }, [hospitalId, debouncedRealtime, cancelDebouncedRealtime]);

  useEffect(() => {
    const loadCompletionActors = async () => {
      if (!canSeeCompletionActor) {
        setCompletedByAccountId({});
        return;
      }

      const completedIds = rows.filter((r) => r.status === "completed").map((r) => r.id);
      if (completedIds.length === 0) {
        setCompletedByAccountId({});
        return;
      }

      const { data: historyRows, error: historyErr } = await supabase
        .from("referral_status_history")
        .select("referral_id, changed_by, created_at, to_status")
        .in("referral_id", completedIds)
        .eq("to_status", "completed")
        .order("created_at", { ascending: false });
      if (historyErr) {
        toast.error(safeClientError(historyErr));
        return;
      }

      const latestByReferral = new Map<string, string>();
      for (const row of historyRows ?? []) {
        const item = row as { referral_id: string; changed_by: string | null };
        if (!latestByReferral.has(item.referral_id) && item.changed_by) {
          latestByReferral.set(item.referral_id, item.changed_by);
        }
      }

      const actorIds = Array.from(new Set(Array.from(latestByReferral.values())));
      if (actorIds.length === 0) {
        setCompletedByAccountId({});
        return;
      }

      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("id, unique_id")
        .in("id", actorIds);
      if (profileErr) {
        toast.error(safeClientError(profileErr));
        return;
      }

      const idToAccountId = new Map(
        (profiles ?? []).map((p) => {
          const row = p as { id: string; unique_id: string | null };
          return [row.id, row.unique_id ?? row.id] as const;
        }),
      );

      const mapping: Record<string, string> = {};
      for (const [referralId, actorId] of latestByReferral.entries()) {
        mapping[referralId] = idToAccountId.get(actorId) ?? actorId;
      }
      setCompletedByAccountId(mapping);
    };

    void loadCompletionActors();
  }, [rows, canSeeCompletionActor]);

  const departmentOptions = useMemo(() => {
    const set = new Set(
      rows
        .map((r) => r.departments?.name ?? r.assigned_department)
        .filter(Boolean) as string[],
    );
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const departmentName = r.departments?.name ?? r.assigned_department ?? "";
      const departmentOk = department === "all" || departmentName === department;
      const statusOk = status === "all" || r.status === status;
      const matchesSearch =
        term === "" ||
        r.patient_name.toLowerCase().includes(term) ||
        (r.referral_number ?? "").toLowerCase().includes(term) ||
        departmentName.toLowerCase().includes(term) ||
        (r.clinics?.name ?? "").toLowerCase().includes(term);
      return departmentOk && statusOk && matchesSearch;
    });
  }, [rows, q, department, status]);

  const counts = useMemo(
    () =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      }, {}),
    [rows],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Assigned Cases</h1>
        <p className="text-muted-foreground">Track referrals assigned to hospital departments.</p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {assignedWorkflowStatuses.map((statusKey) => (
          <Card key={statusKey}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{statusKey.replace(/_/g, " ")}</p>
              <p className={`text-2xl font-semibold ${statusCardTone[statusKey] ?? ""}`}>{counts[statusKey] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search patient, ref #, clinic, or department"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm"
        />
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departmentOptions.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["new", "under_review", ...assignedWorkflowStatuses].map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Ref #</th>
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">From Clinic</th>
                <th className="text-left px-5 py-3">Patient history</th>
                <th className="text-left px-5 py-3">Department</th>
                <th className="text-left px-5 py-3">Status</th>
                {canSeeCompletionActor ? <th className="text-left px-5 py-3">Completed by (Account ID)</th> : null}
                <th className="text-left px-5 py-3">Status details</th>
                <th className="text-left px-5 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link to={`/hospital/referrals/${r.id}/review`} className="text-primary hover:underline">
                      {r.referral_number ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium">{r.patient_name}</td>
                  <td className="px-5 py-3">{r.clinics?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-xs">
                    {r.patient_id ? (
                      <Link to={`/hospital/patients/${r.patient_id}`} className="text-primary hover:underline">
                        View history
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">{r.departments?.name ?? r.assigned_department ?? "—"}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  {canSeeCompletionActor ? (
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {r.status === "completed" ? (completedByAccountId[r.id] ?? "—") : "—"}
                    </td>
                  ) : null}
                  <td className="px-5 py-3 text-xs max-w-[22rem]">
                    {r.rejection_reason ? (
                      <span className="text-destructive line-clamp-2">{r.rejection_reason}</span>
                    ) : r.hospital_feedback ? (
                      <span className="text-muted-foreground line-clamp-2">{r.hospital_feedback}</span>
                    ) : (
                      <span className="text-muted-foreground">No details yet</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canSeeCompletionActor ? 9 : 8} className="text-center py-10 text-muted-foreground">No assigned cases found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
