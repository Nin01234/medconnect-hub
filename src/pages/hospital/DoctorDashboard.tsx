import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { referralKeys } from "@/lib/referralQueryKeys";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

interface Row {
  id: string;
  referral_number: string | null;
  patient_name: string;
  status: string;
  urgency_level: string;
  created_at: string;
  clinics: { name: string } | null;
}

function doctorDashRowFromRealtime(record: Record<string, unknown>): Row | null {
  const id = record.id != null ? String(record.id) : null;
  if (!id) return null;
  return {
    id,
    referral_number: record.referral_number != null ? String(record.referral_number) : null,
    patient_name: typeof record.patient_name === "string" ? record.patient_name : "",
    status: typeof record.status === "string" ? record.status : "",
    urgency_level: typeof record.urgency_level === "string" ? record.urgency_level : "medium",
    created_at: record.created_at != null ? String(record.created_at) : new Date().toISOString(),
    clinics: null,
  };
}

export default function DoctorDashboard() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const hospitalId = profile?.hospital_id ?? null;

  const { data: doctorRow, isPending: doctorLookupPending } = useQuery({
    queryKey: user?.id ? ["doctors", "by-user", user.id] : ["doctors", "inactive"],
    enabled: !!user?.id && !!hospitalId,
    queryFn: async () => {
      const { data, error } = await supabase.from("doctors").select("id").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
  });

  const doctorId = doctorRow?.id ?? null;

  const { data: rows = [] } = useQuery({
    queryKey: doctorId ? referralKeys.doctorDashboard(doctorId) : ["referrals", "doctor", "inactive"],
    enabled: !!doctorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, referral_number, patient_name, status, urgency_level, created_at, clinics(name)")
        .eq("assigned_doctor_id", doctorId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  useEffect(() => {
    if (!doctorId) return;
    const dashKey = referralKeys.doctorDashboard(doctorId);
    const filter = `assigned_doctor_id=eq.${doctorId}`;

    const onInsert = (payload: { new: Record<string, unknown> }) => {
      const incoming = doctorDashRowFromRealtime(payload.new);
      if (!incoming) return;
      queryClient.setQueryData<Row[]>(dashKey, (prev) => {
        const list = prev ?? [];
        if (list.some((r) => r.id === incoming.id)) return list;
        return [incoming, ...list].slice(0, 100);
      });
      toast.success(`New referral assigned: ${incoming.referral_number ?? "—"}`);
    };

    const onUpdate = (payload: { new: Record<string, unknown> }) => {
      const patch = doctorDashRowFromRealtime(payload.new);
      if (!patch) return;
      queryClient.setQueryData<Row[]>(dashKey, (prev) => {
        const list = prev ?? [];
        const stillMine =
          payload.new &&
          payload.new["assigned_doctor_id"] != null &&
          String(payload.new["assigned_doctor_id"]) === doctorId;
        if (!stillMine) return list.filter((r) => r.id !== patch.id);
        return list.map((r) =>
          r.id === patch.id ? { ...patch, clinics: r.clinics ?? patch.clinics } : r,
        );
      });
    };

    const ch = supabase
      .channel(`doctor-dashboard-${doctorId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "referrals", filter }, onInsert)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "referrals", filter }, onUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [doctorId, queryClient]);

  if (!hospitalId) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Your profile is not linked to a hospital yet.
      </div>
    );
  }

  if (doctorLookupPending) {
    return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  }

  if (!doctorRow) {
    return (
      <div className="p-10 text-center text-muted-foreground max-w-lg mx-auto space-y-2">
        <p className="font-medium text-foreground">No doctor profile linked to your account</p>
        <p className="text-sm">
          Ask hospital staff to create or link a doctor record with your login (<span className="font-mono">user_id</span> on{" "}
          <span className="font-mono">doctors</span>) so referrals can be assigned to you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">My referrals</h1>
        <p className="text-muted-foreground">Cases assigned to you by hospital staff.</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Ref #</th>
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">Clinic</th>
                <th className="text-left px-5 py-3">Urgency</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link to={`/hospital/referrals/${r.id}/review`} className="text-primary hover:underline">
                      {r.referral_number ?? "—"}
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
                  <td className="px-5 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground">
                    {doctorId ? "No referrals assigned yet." : "Loading…"}
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
