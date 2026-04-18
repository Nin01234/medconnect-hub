import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface Row { user_id: string; role: string; profiles: { full_name: string | null; email: string | null; unique_id: string | null; status: string } | null; }

export default function RolesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase
      .from("user_roles")
      .select("user_id, role, profiles!user_roles_user_id_fkey(full_name,email,unique_id,status)")
      .order("role")
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
          return;
        }
        setRows((data ?? []) as unknown as Row[]);
      });
  }, []);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Role Assignments</h1>
      <Card className="shadow-card"><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-5 py-3">User</th><th className="text-left px-5 py-3">Account ID</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3">Role</th><th className="text-left px-5 py-3">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={`${r.user_id}-${r.role}`} className="border-b"><td className="px-5 py-3 font-medium">{r.profiles?.full_name ?? "—"}</td><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.profiles?.unique_id ?? "—"}</td><td className="px-5 py-3 text-muted-foreground">{r.profiles?.email}</td><td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{r.role.replace(/_/g," ")}</span></td><td className="px-5 py-3 text-muted-foreground">{r.profiles?.status ?? "—"}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No role assignments found.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>
    </div>
  );
}
