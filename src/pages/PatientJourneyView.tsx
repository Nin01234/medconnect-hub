import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { ArrowLeft, ChevronRight, Activity, Calendar, Building2 } from "lucide-react";
import { toast } from "sonner";
import { safeClientError } from "@/lib/safeError";
import { ReferralTimeline } from "@/components/ReferralTimeline";

interface PatientRow {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
}

interface ReferralHistoryItem {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  note: string | null;
  changed_by?: string | null;
}

interface JourneyReferral {
  id: string;
  referral_number: string | null;
  unique_id: string | null;
  diagnosis: string | null;
  status: string;
  urgency_level: string;
  created_at: string;
  hospital_feedback: string | null;
  departments: { name: string } | null;
  hospitals: { name: string } | null;
  history?: ReferralHistoryItem[];
}

export default function PatientJourneyView({ portal }: { portal: "clinic" | "hospital" }) {
  const { patientId } = useParams();
  const nav = useNavigate();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [journey, setJourney] = useState<JourneyReferral[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJourney = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [{ data: pData, error: pErr }, { data: rData, error: rErr }] = await Promise.all([
        supabase.from("patients").select("id, full_name, age, gender, phone").eq("id", patientId).maybeSingle(),
        supabase
          .from("referrals")
          .select("id, referral_number, unique_id, diagnosis, status, urgency_level, created_at, hospital_feedback, departments!department_id(name), hospitals(name)")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: true }),
      ]);

      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const referralsList = (rData ?? []) as unknown as JourneyReferral[];

      // Fetch referral history for each referral to populate timeline
      if (referralsList.length > 0) {
        const refIds = referralsList.map((r) => r.id);
        const { data: hData } = await supabase
          .from("referral_status_history")
          .select("id, referral_id, from_status, to_status, created_at, note, changed_by")
          .in("referral_id", refIds)
          .order("created_at", { ascending: true });

        const historyMap: Record<string, ReferralHistoryItem[]> = {};
        (hData ?? []).forEach((h) => {
          const refId = (h as any).referral_id;
          if (!historyMap[refId]) historyMap[refId] = [];
          historyMap[refId].push(h);
        });

        referralsList.forEach((r) => {
          r.history = historyMap[r.id] || [];
        });
      }

      setPatient(pData as PatientRow | null);
      setJourney(referralsList);
    } catch (err) {
      toast.error(safeClientError(err));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadJourney();
  }, [loadJourney]);

  if (loading) {
    return <div className="p-12 text-center text-muted-foreground">Loading Patient Journey…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Badge variant="outline" className="font-mono text-xs">
          Patient ID: {patientId?.slice(0, 8)}…
        </Badge>
      </div>

      <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-card to-emerald-500/10 p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
            {patient?.full_name?.charAt(0) ?? "P"}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">{patient?.full_name ?? "Patient Journey"}</h1>
            <p className="text-sm text-muted-foreground">
              {patient?.age ? `${patient.age} yrs` : "Age N/A"} • {patient?.gender ?? "Gender N/A"} • {patient?.phone ?? "Phone N/A"}
            </p>
          </div>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6 space-y-8">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2 border-b pb-4">
            <Activity className="h-5 w-5 text-primary" /> Chronological Patient Care Journey & Timelines
          </h2>

          {journey.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No referrals found for this patient.</p>
          ) : (
            <div className="space-y-8">
              {journey.map((item) => {
                return (
                  <Card key={item.id} className="border border-border shadow-sm overflow-hidden">
                    <CardContent className="p-6 space-y-5">
                      {/* Referral Item Header */}
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground font-semibold">
                              {item.referral_number ?? item.unique_id}
                            </span>
                            <UrgencyBadge level={item.urgency_level} />
                          </div>
                          <h3 className="font-semibold text-lg mt-1">{item.diagnosis ?? "Diagnosis not detailed"}</h3>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      {/* Referral Department & Date Info */}
                      <div className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span>
                            Department: <strong className="text-foreground">{item.departments?.name ?? "General Triage"}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span>
                            Created Date: <strong className="text-foreground">{new Date(item.created_at).toLocaleString()}</strong>
                          </span>
                        </div>
                      </div>

                      {item.hospital_feedback && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-200">
                          <strong>Outcome Feedback:</strong> {item.hospital_feedback}
                        </div>
                      )}

                      {/* Integrated Referral Progress Timeline */}
                      <div className="pt-2">
                        <ReferralTimeline
                          currentStatus={item.status}
                          createdAt={item.created_at}
                          history={item.history ?? []}
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            nav(portal === "clinic" ? `/clinic/referrals/${item.id}` : `/hospital/referrals/${item.id}/review`)
                          }
                        >
                          View Full Record <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
