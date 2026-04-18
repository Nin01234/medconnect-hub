import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PendingUser {
  id: string;
  unique_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  clinics: { name: string; region: string | null; city: string | null } | null;
  hospitals: { name: string; region: string | null; city: string | null } | null;
  user_roles: { role: string }[];
}

export default function PendingApprovalsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PendingUser[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isUnauthorizedError = (error: unknown) => {
    const err = error as { message?: string; context?: { status?: number; statusText?: string } };
    const msg = err?.message ?? "";
    return err?.context?.status === 401 || /unauthorized|invalid or expired token|401/i.test(msg);
  };

  const getActionErrorMessage = async (error: unknown) => {
    const err = error as { message?: string; context?: { status?: number; statusText?: string; clone?: () => Response } };
    const status = err?.context?.status;
    const statusText = err?.context?.statusText;
    const defaultMsg = err?.message?.trim() || "Request failed";

    if (err?.context?.clone) {
      try {
        const responseClone = err.context.clone();
        const payload = await responseClone.json();
        const detailed = typeof payload?.error === "string" ? payload.error : typeof payload?.message === "string" ? payload.message : "";
        if (detailed) {
          return status ? `Request failed (${status}${statusText ? ` ${statusText}` : ""}): ${detailed}` : detailed;
        }
      } catch {
        // Ignore JSON parse failure and fallback below.
      }

      try {
        const responseClone = err.context.clone();
        const text = (await responseClone.text()).trim();
        if (text) {
          return status ? `Request failed (${status}${statusText ? ` ${statusText}` : ""}): ${text}` : text;
        }
      } catch {
        // Ignore text parse failure and fallback below.
      }
    }

    return status ? `Request failed (${status}${statusText ? ` ${statusText}` : ""}): ${defaultMsg}` : defaultMsg;
  };

  const invokeAdminFunction = async (body: Record<string, unknown>) => {
    const invoke = () => supabase.functions.invoke("admin-manage-user", { body });
    let result = await invoke();

    if (!result.error || !isUnauthorizedError(result.error)) {
      return result;
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      throw result.error;
    }

    result = await invoke();
    if (!result.error || !isUnauthorizedError(result.error)) {
      return result;
    }

    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
    throw result.error;
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, unique_id, full_name, email, phone, created_at, clinics(name,region,city), hospitals(name,region,city), user_roles!user_roles_user_id_fkey(role)")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as unknown as PendingUser[]);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      (r.full_name ?? "").toLowerCase().includes(term) ||
      (r.email ?? "").toLowerCase().includes(term) ||
      (r.unique_id ?? "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  const runAction = async (body: Record<string, unknown>) => {
    const { data, error } = await invokeAdminFunction(body);
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  };

  const approve = async (userId: string) => {
    setBusyId(userId);
    try {
      await runAction({ action: "approve_user", user_id: userId });
      toast.success("User approved");
      await load();
    } catch (e) {
      toast.error(await getActionErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (userId: string, name: string) => {
    if (!window.confirm(`Reject ${name}?`)) return;
    setBusyId(userId);
    try {
      await runAction({ action: "update_user", user_id: userId, status: "rejected" });
      toast.success("User rejected");
      await load();
    } catch (e) {
      toast.error(await getActionErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Pending Approvals</h1>
          <p className="text-muted-foreground">Review and approve or reject new self-registered accounts.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
          <Input
            className="max-w-sm"
            placeholder="Search by name, email, or account ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">{filtered.length} pending account(s)</p>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Account ID</th>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Role</th>
                <th className="text-left px-5 py-3">Organization</th>
                <th className="text-left px-5 py-3">Requested</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const role = u.user_roles[0]?.role?.replace(/_/g, " ") ?? "—";
                const org = u.clinics?.name ?? u.hospitals?.name ?? "—";
                return (
                  <tr key={u.id} className="border-b hover:bg-secondary/30">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.unique_id ?? "—"}</td>
                    <td className="px-5 py-3 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-5 py-3 capitalize">{role}</td>
                    <td className="px-5 py-3">{org}</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outlineBrand" disabled={busyId === u.id} onClick={() => approve(u.id)}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busyId === u.id} onClick={() => reject(u.id, u.full_name ?? u.email ?? "this user")}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-muted-foreground">
                    {loading ? "Loading pending users..." : "No pending approvals."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
