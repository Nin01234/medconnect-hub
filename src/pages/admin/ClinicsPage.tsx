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
  contact: string | null;
  address?: string | null;
  email?: string | null;
  gps_code?: string | null;
  ownership_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

function DetailLine({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value == null || value === "" ? "—" : value;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-3 py-2 border-b border-border/60 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{v}</span>
    </div>
  );
}

export default function ClinicsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [view, setView] = useState<Row | null>(null);

  useEffect(() => {
    supabase
      .from("clinics")
      .select("*")
      .order("name")
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Clinics</h1>
      <p className="text-muted-foreground">{rows.length} clinics. Create new ones via the Users page.</p>
      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Clinic ID</th>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Region</th>
                <th className="text-left px-5 py-3">City</th>
                <th className="text-left px-5 py-3">Contact</th>
                <th className="text-right px-5 py-3 w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.unique_id ?? "—"}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3">{r.type}</td>
                  <td className="px-5 py-3">{r.region ?? "—"}</td>
                  <td className="px-5 py-3">{r.city ?? "—"}</td>
                  <td className="px-5 py-3">{r.contact ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <Button type="button" variant="outline" size="sm" onClick={() => setView(r)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    No clinics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display pr-8">{view?.name ?? "Clinic"}</DialogTitle>
            <DialogDescription>Read-only details for this clinic record.</DialogDescription>
          </DialogHeader>
          {view && (
            <div className="pt-1">
              <DetailLine label="Display name" value={view.name} />
              <DetailLine label="Readable clinic ID" value={view.unique_id ?? undefined} />
              <DetailLine label="Internal record ID" value={view.id} />
              <DetailLine label="Type" value={view.type} />
              <DetailLine label="Ownership" value={view.ownership_type ?? undefined} />
              <DetailLine label="Region" value={view.region ?? undefined} />
              <DetailLine label="City" value={view.city ?? undefined} />
              <DetailLine label="Address" value={view.address ?? undefined} />
              <DetailLine label="GPS code" value={view.gps_code ?? undefined} />
              <DetailLine label="Contact phone" value={view.contact ?? undefined} />
              <DetailLine label="Email" value={view.email ?? undefined} />
              <DetailLine label="Created" value={view.created_at ? new Date(view.created_at).toLocaleString() : undefined} />
              <DetailLine label="Last updated" value={view.updated_at ? new Date(view.updated_at).toLocaleString() : undefined} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
