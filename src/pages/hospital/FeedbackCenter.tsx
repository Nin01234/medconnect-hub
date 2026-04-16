import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

interface Row { id: string; referral_number: string | null; patient_name: string; hospital_feedback: string | null; updated_at: string; }

export default function FeedbackCenter() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!profile?.hospital_id) return;
    supabase.from("referrals")
      .select("id, referral_number, patient_name, hospital_feedback, updated_at")
      .eq("hospital_id", profile.hospital_id).not("hospital_feedback","is",null)
      .order("updated_at",{ascending:false})
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [profile?.hospital_id]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Feedback Center</h1>
      <p className="text-muted-foreground">Feedback you've sent back to clinics.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map(r => (
          <Link key={r.id} to={`/hospital/referrals/${r.id}/review`}>
            <Card className="shadow-card hover:shadow-elevated transition-shadow h-full">
              <CardContent className="p-5">
                <p className="font-mono text-xs text-muted-foreground">{r.referral_number}</p>
                <p className="font-semibold mt-1">{r.patient_name}</p>
                <p className="text-sm mt-2 line-clamp-3">{r.hospital_feedback}</p>
                <p className="text-xs text-muted-foreground mt-3">{new Date(r.updated_at).toLocaleString()}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground">No feedback sent yet.</p>}
      </div>
    </div>
  );
}
