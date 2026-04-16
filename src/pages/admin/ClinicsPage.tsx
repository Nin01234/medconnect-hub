import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface Row { id: string; name: string; type: string; region: string | null; city: string | null; contact: string | null; }

export default function ClinicsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("clinics").select("*").order("name").then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Clinics</h1>
      <p className="text-muted-foreground">{rows.length} clinics. Create new ones via the Users page.</p>
      <Card className="shadow-card"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Type</th><th className="text-left px-5 py-3">Region</th><th className="text-left px-5 py-3">City</th><th className="text-left px-5 py-3">Contact</th></tr></thead>
          <tbody>
            {rows.map(r => <tr key={r.id} className="border-b hover:bg-secondary/30"><td className="px-5 py-3 font-medium">{r.name}</td><td className="px-5 py-3">{r.type}</td><td className="px-5 py-3">{r.region ?? "—"}</td><td className="px-5 py-3">{r.city ?? "—"}</td><td className="px-5 py-3">{r.contact ?? "—"}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No clinics yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
