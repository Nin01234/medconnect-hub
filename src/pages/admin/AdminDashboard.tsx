import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Building2, Hospital, FileText } from "lucide-react";

export default function AdminDashboard() {
  const [c, setC] = useState({ users: 0, clinics: 0, hospitals: 0, referrals: 0 });
  useEffect(() => {
    (async () => {
      const [u, cl, h, r] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("clinics").select("id", { count: "exact", head: true }),
        supabase.from("hospitals").select("id", { count: "exact", head: true }),
        supabase.from("referrals").select("id", { count: "exact", head: true }),
      ]);
      setC({ users: u.count ?? 0, clinics: cl.count ?? 0, hospitals: h.count ?? 0, referrals: r.count ?? 0 });
    })();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">System Overview</h1>
        <p className="text-muted-foreground">MedReferral platform health.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Users" value={c.users} icon={<Users className="h-5 w-5" />} accent="primary" />
        <StatCard label="Clinics" value={c.clinics} icon={<Building2 className="h-5 w-5" />} accent="info" />
        <StatCard label="Hospitals" value={c.hospitals} icon={<Hospital className="h-5 w-5" />} accent="success" />
        <StatCard label="Referrals" value={c.referrals} icon={<FileText className="h-5 w-5" />} accent="gold" />
      </div>
      <Card className="shadow-card"><CardContent className="p-6">
        <h2 className="font-display text-xl font-semibold mb-2">Welcome, Administrator</h2>
        <p className="text-muted-foreground text-sm">Use the sidebar to manage users, clinics, hospitals, and view audit logs. Create new users via the Users page — they'll be auto-linked to the right organization.</p>
      </CardContent></Card>
    </div>
  );
}
