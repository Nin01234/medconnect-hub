import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auditActionDetail, auditActionTitle } from "@/lib/auditLogLabels";

interface AuditRow {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

type ProfileMini = {
  id: string;
  full_name: string | null;
  email: string | null;
  unique_id: string | null;
  phone: string | null;
};

function profileLabel(p: ProfileMini | undefined): string {
  if (!p) return "";
  return [p.full_name, p.email, p.unique_id, p.phone].filter(Boolean).join(" ");
}

function ActorBlock({ userId, profile }: { userId: string | null; profile: ProfileMini | undefined }) {
  if (!userId) {
    return <span className="text-muted-foreground text-xs">System / unknown</span>;
  }
  return (
    <div className="space-y-0.5">
      <p className="font-medium text-sm leading-tight">{profile?.full_name ?? profile?.email ?? "User not found (may be deleted)"}</p>
      <p className="text-xs text-muted-foreground">
        User ID: <span className="font-mono">{profile?.unique_id ?? "—"}</span>
          {profile?.email ? (
            <>
              {" · "}
              <span className="break-all">{profile.email}</span>
            </>
          ) : null}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground break-all" title="Authentication user id (same as profiles.id)">
        Auth user: {userId}
      </p>
    </div>
  );
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profileById, setProfileById] = useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [showLogs, setShowLogs] = useState(true);
  const [showDetails, setShowDetails] = useState(true);

  const loadProfilesForRows = useCallback(async (auditRows: AuditRow[]) => {
    const ids = new Set<string>();
    for (const r of auditRows) {
      if (r.actor_id) ids.add(r.actor_id);
      if (r.entity_type === "user" && r.entity_id) ids.add(r.entity_id);
    }
    const list = [...ids];
    if (list.length === 0) {
      setProfileById({});
      return;
    }
    const chunk = 120;
    const map: Record<string, ProfileMini> = {};
    for (let i = 0; i < list.length; i += chunk) {
      const slice = list.slice(i, i + chunk);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, unique_id, phone")
        .in("id", slice);
      if (error) {
        toast.error(error.message);
        return;
      }
      for (const p of (data ?? []) as ProfileMini[]) {
        map[p.id] = p;
      }
    }
    setProfileById(map);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const next = (data ?? []) as AuditRow[];
    setRows(next);
    await loadProfilesForRows(next);
  }, [loadProfilesForRows]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedQuery = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (entity !== "all" && (r.entity_type ?? "unknown") !== entity) return false;
      if (!normalizedQuery) return true;

      const actorP = r.actor_id ? profileById[r.actor_id] : undefined;
      const targetP = r.entity_type === "user" && r.entity_id ? profileById[r.entity_id] : undefined;
      const details = r.metadata ? JSON.stringify(r.metadata).toLowerCase() : "";
      const hay = [
        r.action,
        r.actor_id,
        r.entity_type,
        r.entity_id,
        auditActionTitle(r.action),
        auditActionDetail(r.action, r.metadata),
        profileLabel(actorP),
        profileLabel(targetP),
        details,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }, [rows, action, entity, normalizedQuery, profileById]);

  const actions = Array.from(new Set(rows.map((r) => r.action).filter(Boolean))).sort();
  const entities = Array.from(new Set(rows.map((r) => r.entity_type ?? "unknown"))).sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground text-sm">
            Who did what: actors are resolved from profiles (name, email, readable user ID, and auth user UUID).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLogs((prev) => !prev)}>
            {showLogs ? "Hide audit logs" : "Show audit logs"}
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>
      <Card className="shadow-card">
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action, actor, target, details…"
            className="md:col-span-2"
          />
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {entities.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setShowDetails((prev) => !prev)}>
              {showDetails ? "Hide details" : "Show details"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLogs ? (
        <Card className="shadow-card">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3 whitespace-nowrap">When</th>
                  <th className="text-left px-5 py-3">What happened</th>
                  <th className="text-left px-5 py-3 w-[220px]">Actor (who did it)</th>
                  <th className="text-left px-5 py-3 w-[220px]">Target</th>
                  {showDetails && <th className="text-left px-5 py-3">Extra details</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const actorP = r.actor_id ? profileById[r.actor_id] : undefined;
                  const targetP = r.entity_type === "user" && r.entity_id ? profileById[r.entity_id] : undefined;
                  return (
                    <tr key={r.id} className="border-b align-top">
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium leading-snug">{auditActionTitle(r.action)}</p>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{r.action}</p>
                      </td>
                      <td className="px-5 py-3">
                        <ActorBlock userId={r.actor_id} profile={actorP} />
                      </td>
                      <td className="px-5 py-3">
                        {r.entity_type === "user" && r.entity_id ? (
                          <ActorBlock userId={r.entity_id} profile={targetP} />
                        ) : (
                          <div className="text-xs space-y-1">
                            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">{r.entity_type ?? "—"}</span>
                            {r.entity_id ? (
                              <p className="font-mono text-[10px] text-muted-foreground break-all mt-1" title="Entity id">
                                {r.entity_id}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      {showDetails && (
                        <td className="px-5 py-3 text-xs text-muted-foreground align-top">
                          <p className="mb-2 leading-snug">{auditActionDetail(r.action, r.metadata)}</p>
                          <pre className="whitespace-pre-wrap break-words font-mono text-[10px] bg-muted/50 p-2 rounded-md max-h-40 overflow-auto">
                            {r.metadata ? JSON.stringify(r.metadata, null, 2) : "—"}
                          </pre>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showDetails ? 5 : 4} className="text-center py-10 text-muted-foreground">
                      No audit entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-10 text-center text-muted-foreground">
            Audit log table is hidden. Click &quot;Show audit logs&quot; to display it.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
