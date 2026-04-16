import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface Row { id: string; name: string; type: string; region: string | null; city: string | null; departments: string[]; contact: string | null; }

export default function HospitalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("hospitals").select("*").order("name").then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Hospitals</h1>
      <p className="text-muted-foreground">{rows.length} hospitals. Create new ones via the Users page.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map(r => (
          <Card key={r.id} className="shadow-card"><CardContent className="p-5">
            <div className="flex items-start justify-between"><p className="font-display text-lg font-semibold">{r.name}</p><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.type}</span></div>
            <p className="text-sm text-muted-foreground mt-1">{[r.city, r.region].filter(Boolean).join(", ") || "—"}</p>
            {r.departments?.length > 0 && <div className="flex flex-wrap gap-1 mt-3">{r.departments.map(d => <span key={d} className="text-xs px-2 py-0.5 rounded bg-secondary">{d}</span>)}</div>}
            {r.contact && <p className="text-xs text-muted-foreground mt-2">{r.contact}</p>}
          </CardContent></Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground">No hospitals yet.</p>}
      </div>
    </div>
  );
}
