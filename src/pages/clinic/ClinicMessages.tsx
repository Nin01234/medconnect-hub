import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Conv {
  referral_id: string;
  patient_name: string;
  referral_number: string;
  preview: string;
  hasFeedback: boolean;
  hasMessages: boolean;
  sortAt: string;
}

function truncate(s: string, max: number) {
  const t = s.trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export default function ClinicMessages() {
  const { profile } = useAuth();
  const [convs, setConvs] = useState<Conv[]>([]);

  useEffect(() => {
    if (!profile?.clinic_id) return;
    (async () => {
      const { data: refs } = await supabase
        .from("referrals")
        .select("id, patient_name, referral_number, hospital_feedback, updated_at")
        .eq("clinic_id", profile.clinic_id)
        .order("updated_at", { ascending: false });

      const ids = (refs ?? []).map((r) => r.id);
      const latestByRef: Record<string, { message: string; created_at: string }> = {};
      if (ids.length) {
        const { data: msgs } = await supabase
          .from("referral_messages")
          .select("referral_id, message, created_at")
          .in("referral_id", ids)
          .order("created_at", { ascending: false });
        for (const m of msgs ?? []) {
          if (!latestByRef[m.referral_id]) {
            latestByRef[m.referral_id] = { message: m.message, created_at: m.created_at };
          }
        }
      }

      const list: Conv[] = [];
      for (const r of refs ?? []) {
        const fb = (r.hospital_feedback ?? "").trim();
        const hasFeedback = fb.length > 0;
        const lm = latestByRef[r.id];
        const hasMessages = !!lm;
        if (!hasFeedback && !hasMessages) continue;

        const parts: string[] = [];
        if (hasFeedback) parts.push(truncate(fb, 160));
        if (lm) parts.push(hasFeedback ? `Message: ${truncate(lm.message, 120)}` : truncate(lm.message, 180));

        const sortAt =
          hasMessages && lm && new Date(lm.created_at) > new Date(r.updated_at ?? 0)
            ? lm.created_at
            : (r.updated_at as string);

        list.push({
          referral_id: r.id,
          patient_name: r.patient_name,
          referral_number: r.referral_number ?? "",
          preview: parts.join(" · "),
          hasFeedback,
          hasMessages,
          sortAt,
        });
      }
      list.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
      setConvs(list);
    })();
  }, [profile?.clinic_id]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Messages & hospital feedback</h1>
        <p className="text-muted-foreground mt-1">
          Written feedback from the hospital and chat messages on your referrals. Open a row for the full referral.
        </p>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-0 divide-y">
          {convs.length === 0 && (
            <p className="p-10 text-center text-muted-foreground">
              No hospital messages or feedback yet. When a hospital sends feedback or a message, it will appear here.
            </p>
          )}
          {convs.map((c) => (
            <Link
              key={c.referral_id}
              to={`/clinic/referrals/${c.referral_id}`}
              className="block px-5 py-3 hover:bg-secondary/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {c.patient_name}{" "}
                  <span className="text-xs text-muted-foreground font-mono ml-2">{c.referral_number}</span>
                </p>
                {c.hasFeedback && (
                  <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-normal">
                    Hospital feedback
                  </Badge>
                )}
                {c.hasMessages && (
                  <Badge variant="outline" className="font-normal">
                    Messages
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.preview}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
