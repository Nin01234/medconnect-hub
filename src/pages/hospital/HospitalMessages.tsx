import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

interface Conv { referral_id: string; patient_name: string; referral_number: string; last: string; }

export default function HospitalMessages() {
  const { profile } = useAuth();
  const [convs, setConvs] = useState<Conv[]>([]);
  useEffect(() => {
    if (!profile?.hospital_id) return;
    (async () => {
      const { data: refs } = await supabase.from("referrals").select("id, patient_name, referral_number").eq("hospital_id", profile.hospital_id);
      const list: Conv[] = [];
      for (const r of refs ?? []) {
        const { data: m } = await supabase.from("referral_messages").select("message").eq("referral_id", r.id).order("created_at",{ascending:false}).limit(1);
        if (m && m.length) list.push({ referral_id: r.id, patient_name: r.patient_name, referral_number: r.referral_number ?? "", last: m[0].message });
      }
      setConvs(list);
    })();
  }, [profile?.hospital_id]);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Messages</h1>
      <Card className="shadow-card">
        <CardContent className="p-0 divide-y">
          {convs.length === 0 && <p className="p-10 text-center text-muted-foreground">No conversations yet.</p>}
          {convs.map(c => (
            <Link key={c.referral_id} to={`/hospital/referrals/${c.referral_id}/review`} className="block px-5 py-3 hover:bg-secondary/40">
              <p className="font-medium">{c.patient_name} <span className="text-xs text-muted-foreground font-mono ml-2">{c.referral_number}</span></p>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{c.last}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
