import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import { ArrowLeft, History } from "lucide-react";
import { toast } from "sonner";
import { safeClientError } from "@/lib/safeError";

interface PatientRow {
  id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
}

interface ReferralRow {
  id: string;
  referral_number: string | null;
  unique_id: string | null;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  patient_phone: string | null;
  status: string;
  urgency_level: string;
  created_at: string;
  assigned_doctor_id: string | null;
  doctors: DoctorRow | null;
  hospitals: { name: string } | null;
  clinics: { name: string } | null;
}

interface DoctorRow {
  id: string;
  full_name: string;
  specialty: string | null;
  phone: string | null;
  email: string | null;
}

export default function PatientReferralHistory({ portal }: { portal: "clinic" | "hospital" }) {
  const { patientId } = useParams();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  const backHref = portal === "clinic" ? "/clinic/referrals" : "/hospital/inbox";
  const referralHref = (id: string) =>
    portal === "clinic" ? `/clinic/referrals/${id}` : `/hospital/referrals/${id}/review`;

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    const { data: refs, error: rErr } = await supabase
      .from("referrals")
      .select(
        "id, referral_number, unique_id, patient_name, patient_age, patient_gender, patient_phone, status, urgency_level, created_at, assigned_doctor_id, hospitals(name), clinics(name)",
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (rErr) {
      toast.error(safeClientError(rErr));
      setPatient(null);
      setReferrals([]);
      setLoading(false);
      return;
    }

    const normalizedRefs = ((refs ?? []) as unknown as Omit<ReferralRow, "doctors">[]).map((row) => ({
      ...row,
      doctors: null,
    }));

    const doctorIds = Array.from(
      new Set(normalizedRefs.map((row) => row.assigned_doctor_id).filter((id): id is string => !!id)),
    );
    if (doctorIds.length > 0) {
      const { data: doctorsData, error: doctorsErr } = await supabase
        .from("doctors")
        .select("id, full_name, specialty, phone, email")
        .in("id", doctorIds);
      if (doctorsErr) {
        toast.error(safeClientError(doctorsErr));
      } else {
        const doctorById = new Map((doctorsData as DoctorRow[] | null | undefined)?.map((d) => [d.id, d]) ?? []);
        for (const row of normalizedRefs) {
          row.doctors = row.assigned_doctor_id ? doctorById.get(row.assigned_doctor_id) ?? null : null;
        }
      }
    }

    setReferrals(normalizedRefs);

    const latest = normalizedRefs[0] ?? null;
    const fallbackPatient: PatientRow | null = latest
      ? {
          id: patientId,
          full_name: latest.patient_name,
          age: latest.patient_age,
          gender: latest.patient_gender,
          phone: latest.patient_phone,
        }
      : null;

    const { data: p, error: pErr } = await supabase
      .from("patients")
      .select("id, full_name, age, gender, phone")
      .eq("id", patientId)
      .maybeSingle();

    if (pErr) {
      // Patient table can be stricter than referrals under RLS; preserve page usability.
      if (fallbackPatient) {
        setPatient(fallbackPatient);
      } else {
        toast.error(safeClientError(pErr));
        setPatient(null);
      }
      setLoading(false);
      return;
    }

    if (!p) {
      if (fallbackPatient) {
        setPatient(fallbackPatient);
      } else {
        toast.error("Patient not found or you don't have access.");
        setPatient(null);
      }
      setLoading(false);
      return;
    }

    setPatient(p as unknown as PatientRow);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  }
  if (!patient) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to={backHref}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <History className="h-5 w-5 text-muted-foreground shrink-0 mt-1" aria-hidden />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold">Referral history</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {portal === "hospital"
                  ? "Referrals at this hospital for the same clinic patient record. Cases sent to other hospitals do not appear here."
                  : "Referrals from your clinic tied to this patient record. New referrals reuse this record when name and phone match."}
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Patient on file</p>
              <p className="font-medium text-lg mt-0.5">{patient.full_name}</p>
            </div>
            <div className="space-y-1">
              <p>
                <span className="text-muted-foreground">Age: </span>
                {patient.age ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Gender: </span>
                {patient.gender ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Phone: </span>
                {patient.phone ?? "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
              <tr>
                <th className="text-left px-5 py-3">Ref #</th>
                {portal === "hospital" ? <th className="text-left px-5 py-3">Clinic</th> : null}
                {portal === "clinic" ? <th className="text-left px-5 py-3">Hospital</th> : null}
                <th className="text-left px-5 py-3">Urgency</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Assigned doctor</th>
                <th className="text-left px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-mono text-xs">
                    <Link to={referralHref(r.id)} className="text-primary hover:underline">
                      {r.referral_number ?? r.unique_id ?? r.id.slice(0, 8)}
                    </Link>
                  </td>
                  {portal === "hospital" ? (
                    <td className="px-5 py-3">{r.clinics?.name ?? "—"}</td>
                  ) : null}
                  {portal === "clinic" ? (
                    <td className="px-5 py-3">{r.hospitals?.name ?? "—"}</td>
                  ) : null}
                  <td className="px-5 py-3">
                    <UrgencyBadge level={r.urgency_level} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {r.doctors ? (
                      <div className="space-y-0.5">
                        <p className="font-medium text-foreground">{r.doctors.full_name}</p>
                        <p>{r.doctors.specialty ?? "General"}</p>
                        <p>{r.doctors.phone ?? r.doctors.email ?? "—"}</p>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {referrals.length === 0 && (
                <tr>
                  <td
                    colSpan={portal === "clinic" ? 6 : 6}
                    className="text-center py-10 text-muted-foreground"
                  >
                    No referrals are linked to this patient record yet.
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
