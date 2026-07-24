import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { ArrowLeft, History, CheckCircle2, Clock, AlertTriangle, ChevronRight, Activity, Calendar, Stethoscope, Building2 } from "lucide-react";
import { toast } from "sonner";
import { safeClientError } from "@/lib/safeError";

interface PatientRow {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
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
}

export default function PatientJourneyView({ portal }: { portal: "clinic" | "hospital" }) {
  const { patientId } = useParams();
  const nav = useNavigate();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [journey, setJourney] = useState<JourneyReferral[]>([]);
  const [loading, setLoading] = useState(true);

  const backHref = portal === "clinic" ? "/clinic/referrals" : "/hospital/inbox";

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

      setPatient(pData as PatientRow | null);
      setJourney((rData ?? []) as unknown as JourneyReferral[]);
    } catch (err) {
      toast.error(safeClientError(err));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadJourney();
  }, [loadJourney]);

  const getTimelineColor = (status: string, created_at: string) => {
    if (status === "completed") return "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
    if (status === "rejected") return "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-300";

    // Check SLA SLA threshold (overdue if > 48h and pending)
    const hours = (Date.now() - new Date(created_at).getTime()) / (1000 * 3600);
    if (hours > 48 && !["completed", "rejected"].includes(status)) {
      return "border-rose-600 bg-rose-600/15 text-rose-600 dark:text-rose-400";
    }

    return "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-300";
  };

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

      <div className="rounded-2xl border bg-gradient-to-r from-primary/10 via-card to-cyan-500/10 p-6 shadow-card">
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
        <CardContent className="p-6">
          <h2 className="font-display text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Chronological Patient Care Journey
          </h2>

          {journey.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No referrals found for this patient.</p>
          ) : (
            <div className="relative border-l-2 border-border ml-4 space-y-8 pl-6">
              {journey.map((item, idx) => {
                const colorClass = getTimelineColor(item.status, item.created_at);
                const isOverdue = colorClass.includes("rose-600");

                return (
                  <div key={item.id} className="relative group">
                    {/* Timeline Node Icon */}
                    <div
                      className={`absolute -left-[35px] top-1.5 h-6 w-6 rounded-full border-2 flex items-center justify-center bg-background ${colorClass}`}
                    >
                      {item.status === "completed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isOverdue ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-elevated transition-shadow">
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground font-semibold">
                              {item.referral_number ?? item.unique_id}
                            </span>
                            <UrgencyBadge level={item.urgency_level} />
                            {isOverdue && (
                              <Badge className="bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40 text-[10px]">
                                SLA Overdue (&gt;48h)
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-lg mt-1">{item.diagnosis ?? "Diagnosis not detailed"}</h3>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span>Department: <strong className="text-foreground">{item.departments?.name ?? "General Triage"}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span>Date: <strong className="text-foreground">{new Date(item.created_at).toLocaleString()}</strong></span>
                        </div>
                      </div>

                      {item.hospital_feedback && (
                        <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-200">
                          <strong>Outcome Feedback:</strong> {item.hospital_feedback}
                        </div>
                      )}

                      <div className="mt-4 flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            nav(portal === "clinic" ? `/clinic/referrals/${item.id}` : `/hospital/referrals/${item.id}/review`)
                          }
                        >
                          View Details <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
