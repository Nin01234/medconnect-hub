import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { sanitizeText } from "@/lib/sanitize";
import { hasRole } from "@/context/authRoles";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  referral_number: string | null;
  patient_id: string | null;
  patient_name: string;
  status: string;
  urgency_level: string;
  created_at: string;
  hospital_feedback: string | null;
  hospitals: { name: string } | null;
  departments: { name: string } | null;
  department_id: string | null;
  source_department_id: string | null;
  assigned_staff_id: string | null;
  created_by: string | null;
}

export default function MyReferrals() {
  const { profile, roles } = useAuth();
  const queryClient = useQueryClient();
  const isHospitalPortal = window.location.pathname.startsWith("/hospital");
  const departmentId = profile?.department_id ?? null;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [activeTab, setActiveTab] = useState<"sent" | "incoming">("sent");

  const isClinicAdmin = hasRole(roles, "clinic_admin");
  const isClinicStaff = hasRole(roles, "clinic_staff");

  const queryKey = useMemo(() => ["referrals", "department", departmentId ?? "none"], [departmentId]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    enabled: !!departmentId,
    queryFn: async () => {
      if (!departmentId) return [];
      let query = supabase
        .from("referrals")
        .select(`
          id,
          referral_number,
          patient_id,
          patient_name,
          status,
          urgency_level,
          created_at,
          hospital_feedback,
          hospitals(name),
          departments!department_id(name),
          department_id,
          source_department_id,
          assigned_staff_id,
          created_by
        `);
      
      if (isClinicAdmin) {
        query = query.or(`department_id.eq.${departmentId},source_department_id.eq.${departmentId}`);
      } else {
        query = query.or(`created_by.eq.${profile?.id},assigned_staff_id.eq.${profile?.id}`);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    if (!departmentId) return;
    const ch = supabase
      .channel(`my-refs-dept-${departmentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "referrals" }, () => {
        void queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [departmentId, queryKey, queryClient]);

  const normalizedQuery = sanitizeText(q, 200).toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Search matching
      const matchesSearch =
        normalizedQuery === "" ||
        r.patient_name.toLowerCase().includes(normalizedQuery) ||
        r.referral_number?.toLowerCase().includes(normalizedQuery);
      
      // Status matching
      const matchesStatus = status === "all" || r.status === status;
      
      // Tab matching
      let matchesTab = false;
      if (activeTab === "sent") {
        matchesTab = isClinicAdmin
          ? r.source_department_id === departmentId
          : r.created_by === profile?.id;
      } else {
        matchesTab = isClinicAdmin
          ? r.department_id === departmentId
          : r.assigned_staff_id === profile?.id;
      }
      
      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [rows, status, normalizedQuery, activeTab, isClinicAdmin, departmentId, profile?.id]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Referrals</h1>
        <p className="text-muted-foreground">{filtered.length} visible</p>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("sent")}
          className={cn(
            "px-4 py-2 border-b-2 font-medium text-sm transition-colors",
            activeTab === "sent"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {isClinicAdmin ? "Sent Referrals" : "My Sent Referrals"}
        </button>
        <button
          onClick={() => setActiveTab("incoming")}
          className={cn(
            "px-4 py-2 border-b-2 font-medium text-sm transition-colors",
            activeTab === "incoming"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {isClinicAdmin ? "Incoming Referrals" : "Assigned Incoming Referrals"}
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input placeholder="Search patient or referral #" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
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
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="text-left px-5 py-3">Ref #</th>
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">Department</th>
                <th className="text-left px-5 py-3">Urgency</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Feedback</th>
                <th className="text-left px-5 py-3">Patient history</th>
                <th className="text-left px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link to={isHospitalPortal ? `/hospital/referrals/${r.id}/review` : `/clinic/referrals/${r.id}`} className="text-primary hover:underline">
                      {r.referral_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium">{r.patient_name}</td>
                  <td className="px-5 py-3">{r.departments?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <UrgencyBadge level={r.urgency_level} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3">
                    {r.hospital_feedback?.trim() ? (
                      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-normal whitespace-nowrap">
                        Feedback
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {r.patient_id ? (
                      <Link to={isHospitalPortal ? `/hospital/patients/${r.patient_id}` : `/clinic/patients/${r.patient_id}`} className="text-primary hover:underline">
                        View history
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
                    {isLoading ? "Loading..." : "No referrals match."}
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