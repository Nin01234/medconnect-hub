import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye } from "lucide-react";

interface Row {
  id: string;
  unique_id?: string | null;
  name: string;
  type: string;
  region: string | null;
  city: string | null;
  departments: string[] | null;
  contact: string | null;
  address?: string | null;
  email?: string | null;
  gps_code?: string | null;
  created_at?: string;
  updated_at?: string;
}

function DetailLine({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value == null || value === "" ? "—" : value;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-3 py-2 border-b border-border/60 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{v}</span>
    </div>
  );
}

export default function HospitalsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [view, setView] = useState<Row | null>(null);

  useEffect(() => {
    supabase
      .from("hospitals")
      .select("*")
      .order("name")
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Hospitals</h1>
      <p className="text-muted-foreground">{rows.length} hospitals. Create new ones via the Users page.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((r) => (
          <Card key={r.id} className="shadow-card">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold leading-tight">{r.name}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{r.type}</span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-1">Hospital ID: {r.unique_id ?? "—"}</p>
              <p className="text-sm text-muted-foreground mt-1">{[r.city, r.region].filter(Boolean).join(", ") || "—"}</p>
              {r.departments && r.departments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {r.departments.map((d) => (
                    <span key={d} className="text-xs px-2 py-0.5 rounded bg-secondary">
                      {d}
                    </span>
                  ))}
                </div>
              )}
              {r.contact && <p className="text-xs text-muted-foreground mt-2">{r.contact}</p>}
              <div className="mt-auto pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setView(r)}>
                  <Eye className="h-4 w-4 mr-1" />
                  View details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-muted-foreground">No hospitals yet.</p>}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display pr-8">{view?.name ?? "Hospital"}</DialogTitle>
            <DialogDescription>Read-only details for this hospital record.</DialogDescription>
          </DialogHeader>
          {view && (
            <div className="pt-1">
              <DetailLine label="Display name" value={view.name} />
              <DetailLine label="Readable hospital ID" value={view.unique_id ?? undefined} />
              <DetailLine label="Internal record ID" value={view.id} />
              <DetailLine label="Type" value={view.type} />
              <DetailLine label="Region" value={view.region ?? undefined} />
              <DetailLine label="City" value={view.city ?? undefined} />
              <DetailLine label="Address" value={view.address ?? undefined} />
              <DetailLine label="GPS code" value={view.gps_code ?? undefined} />
              <DetailLine label="Contact phone" value={view.contact ?? undefined} />
              <DetailLine label="Email" value={view.email ?? undefined} />
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-1 sm:gap-3 py-2 border-b border-border/60 text-sm last:border-0">
                <span className="text-muted-foreground">Departments</span>
                <span className="font-medium">
                  {view.departments && view.departments.length > 0 ? view.departments.join(", ") : "—"}
                </span>
              </div>
              <DetailLine label="Created" value={view.created_at ? new Date(view.created_at).toLocaleString() : undefined} />
              <DetailLine label="Last updated" value={view.updated_at ? new Date(view.updated_at).toLocaleString() : undefined} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
