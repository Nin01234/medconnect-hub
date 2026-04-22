import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { referralKeys } from "@/lib/referralQueryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";

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

export default function HospitalInbox() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [urgency, setUrgency] = useState("all");

  const hospitalId = profile?.hospital_id ?? null;

  const { data: rows = [] } = useQuery({
    queryKey: hospitalId ? referralKeys.hospitalInbox(hospitalId) : ["referrals", "hospital", "inactive", "inbox"],
    enabled: !!hospitalId,
    queryFn: async () => {
      const query = supabase
        .from("referrals")
        .select("id, referral_number, patient_id, patient_name, status, urgency_level, created_at, clinics(name)")
        .eq("hospital_id", hospitalId!)
        .order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const [debouncedRealtime, cancelDebouncedRealtime] = useDebouncedCallback(() => {
    if (hospitalId) void queryClient.invalidateQueries({ queryKey: referralKeys.hospitalRoot(hospitalId) });
  }, 400);

  useEffect(() => {
    if (!hospitalId) return;
    const ch = supabase
      .channel("inbox")
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

  const normalizedQuery = q.trim().toLowerCase();
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
