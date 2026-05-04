import { useCallback, useEffect, useMemo, useState } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil, Trash2, Power, Check, X } from "lucide-react";
import { toast } from "sonner";
import { sanitizeText } from "@/lib/sanitize";
import { safeClientError } from "@/lib/safeError";

interface DepartmentRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export default function Departments() {
  const { profile, roles } = useAuth();
  const canManage = hasRole(roles, "hospital_admin", "admin");
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [hospitalName, setHospitalName] = useState<string>("");
  const [newDepartment, setNewDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const runGuarded = useSubmitGuard();

  const load = useCallback(async () => {
    if (!profile?.hospital_id) return;
    const [{ data: hospitalData, error: hospitalError }, { data, error }] = await Promise.all([
      supabase.from("hospitals").select("name").eq("id", profile.hospital_id).maybeSingle(),
      supabase
        .from("departments")
        .select("id,name,status,created_at")
        .eq("hospital_id", profile.hospital_id)
        .order("name"),
    ]);
    if (hospitalError) {
      toast.error(safeClientError(hospitalError));
      return;
    }
    if (error) {
      toast.error(safeClientError(error));
      return;
    }
    setHospitalName(hospitalData?.name ?? "");
    setDepartments((data ?? []) as DepartmentRow[]);
  }, [profile?.hospital_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDepartment = async () => {
    if (!canManage) return;
    if (!profile?.hospital_id) {
      toast.error("Your account is not linked to a hospital. Contact super admin.");
      return;
    }
    const cleaned = sanitizeText(newDepartment, 80);
    if (!cleaned) {
      toast.error("Enter a department name.");
      return;
    }
    if (departments.some((d) => d.name.toLowerCase() === cleaned.toLowerCase())) {
      toast.error("Department already exists.");
      return;
    }

    await runGuarded(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").insert({
        hospital_id: profile.hospital_id,
        name: cleaned,
        status: "active",
      });
      if (error) throw error;
      setNewDepartment("");
      toast.success("Department created");
      await load();
    } catch (e) {
      toast.error(safeClientError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const openEdit = (row: DepartmentRow) => {
    setEditingDepartmentId(row.id);
    setEditingName(row.name);
  };

  const cancelEdit = () => {
    setEditingDepartmentId(null);
    setEditingName("");
  };

  const saveEdit = async (id: string) => {
    if (!canManage) return;
    const cleaned = sanitizeText(editingName, 80);
    if (!cleaned) {
      toast.error("Enter a valid department name.");
      return;
    }
    if (departments.some((d) => d.id !== id && d.name.toLowerCase() === cleaned.toLowerCase())) {
      toast.error("Department name already exists.");
      return;
    }

    await runGuarded(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").update({ name: cleaned }).eq("id", id);
      if (error) throw error;
      cancelEdit();
      toast.success("Department updated");
      await load();
    } catch (e) {
      toast.error(safeClientError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const toggleStatus = async (row: DepartmentRow) => {
    if (!canManage) return;
    const next = row.status === "active" ? "inactive" : "active";
    if (next === "inactive") {
      const confirmed = window.confirm(
        `Deactivate ${row.name}? This will deactivate all staff under this department.`,
      );
      if (!confirmed) return;
    }

    await runGuarded(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").update({ status: next }).eq("id", row.id);
      if (error) throw error;
      toast.success(next === "active" ? "Department activated" : "Department deactivated");
      await load();
    } catch (e) {
      toast.error(safeClientError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const removeDepartment = async (row: DepartmentRow) => {
    if (!canManage) return;
    const confirmed = window.confirm(
      `Delete ${row.name}? This removes referrals under this department and deactivates affected staff.`,
    );
    if (!confirmed) return;

    await runGuarded(async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Department deleted");
      await load();
    } catch (e) {
      toast.error(safeClientError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const filtered = useMemo(() => {
    const term = sanitizeText(search, 200).toLowerCase();
    return departments.filter((d) => {
      const byStatus = statusFilter === "all" || d.status === statusFilter;
      const bySearch = term === "" || d.name.toLowerCase().includes(term);
      return byStatus && bySearch;
    });
  }, [departments, search, statusFilter]);

  const stats = useMemo(() => {
    const active = departments.filter((d) => d.status === "active").length;
    const inactive = departments.filter((d) => d.status !== "active").length;
    return { total: departments.length, active, inactive };
  }, [departments]);

  if (!canManage) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <h1 className="font-display text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground mt-2">Only Hospital Admin can manage departments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-cyan-500/10 p-5 shadow-card">
        <h1 className="font-display text-3xl font-bold">Department Administration</h1>
        <p className="text-muted-foreground">
          Create, edit, activate, deactivate, and delete departments from one control panel.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Hospital: {hospitalName || "Not linked"} {profile?.hospital_id ? "" : "• Contact super admin to link your account."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total departments</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Active</p>
            <p className="text-2xl font-semibold text-emerald-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Inactive</p>
            <p className="text-2xl font-semibold text-amber-600">{stats.inactive}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card border-primary/15">
        <CardContent className="p-5">
          <p className="font-semibold">Create department</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              placeholder="Enter department name"
              className="max-w-md"
            />
            <Button
              variant="hero"
              onClick={() => void createDepartment()}
              disabled={busy || !newDepartment.trim() || !profile?.hospital_id}
            >
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search departments"
                className="pl-9 w-[280px]"
              />
            </div>
            <Button size="sm" variant={statusFilter === "all" ? "hero" : "outline"} onClick={() => setStatusFilter("all")}>
              All
            </Button>
            <Button size="sm" variant={statusFilter === "active" ? "hero" : "outline"} onClick={() => setStatusFilter("active")}>
              Active
            </Button>
            <Button size="sm" variant={statusFilter === "inactive" ? "hero" : "outline"} onClick={() => setStatusFilter("inactive")}>
              Inactive
            </Button>
          </div>

          <div className="space-y-2">
            {filtered.map((row) => (
              <div key={row.id} className="rounded-xl border bg-card/70 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {editingDepartmentId === row.id ? (
                    <div className="flex gap-2 flex-1 min-w-[240px]">
                      <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                      <Button size="sm" disabled={busy || !editingName.trim()} onClick={() => void saveEdit(row.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{row.name}</p>
                      <Badge variant={row.status === "active" ? "default" : "secondary"}>{row.status}</Badge>
                    </div>
                  )}

                  {editingDepartmentId !== row.id && (
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggleStatus(row)}>
                        <Power className="h-3.5 w-3.5" /> {row.status === "active" ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => void removeDepartment(row)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No departments found for the current filter.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
