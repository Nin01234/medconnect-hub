import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface Row { id: string; action: string; entity_type: string | null; entity_id: string | null; created_at: string; metadata: Record<string, unknown> | null; }

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(200).then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Audit Logs</h1>
      <Card className="shadow-card"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-5 py-3">When</th><th className="text-left px-5 py-3">Action</th><th className="text-left px-5 py-3">Entity</th><th className="text-left px-5 py-3">Details</th></tr></thead>
          <tbody>
            {rows.map(r => <tr key={r.id} className="border-b"><td className="px-5 py-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td><td className="px-5 py-3 font-medium">{r.action}</td><td className="px-5 py-3">{r.entity_type}</td><td className="px-5 py-3 text-xs text-muted-foreground font-mono">{r.metadata ? JSON.stringify(r.metadata) : "—"}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
