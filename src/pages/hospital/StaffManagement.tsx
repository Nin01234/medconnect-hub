import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { resetPasswordSchema } from "@/lib/validation";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { safeClientError, safeFunctionError } from "@/lib/safeError";

type StaffStatus = "pending_approval" | "active" | "rejected" | "suspended";

interface StaffRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  unique_id: string | null;
  user_roles: { role: string }[];
}

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function StaffManagement() {
  const { profile, roles } = useAuth();
  const canManage = hasRole(roles, "hospital_admin", "admin");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [edit, setEdit] = useState({
    full_name: "",
    email: "",
    phone: "",
    status: "active" as StaffStatus,
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    status: "active" as StaffStatus,
  });

  const isUnauthorizedError = (error: unknown) => {
    const err = error as { message?: string; context?: { status?: number } };
    const msg = err?.message ?? "";
    return err?.context?.status === 401 || /unauthorized|invalid or expired token|401/i.test(msg);
  };

  const invokeFn = async (fnName: "admin-create-user" | "admin-manage-user", body: Record<string, unknown>) => {
    const invoke = () => supabase.functions.invoke(fnName, { body });
    let result = await invoke();
    if (!result.error || !isUnauthorizedError(result.error)) return result;

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) throw result.error;
    result = await invoke();
    return result;
  };

  const load = async () => {
    if (!profile?.hospital_id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, status, unique_id, user_roles!user_roles_user_id_fkey(role)")
      .eq("hospital_id", profile.hospital_id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(safeClientError(error));
      return;
    }
    const staffOnly = ((data ?? []) as unknown as StaffRow[]).filter((u) => u.user_roles.some((r) => r.role === "hospital_staff"));
    setRows(staffOnly);
  };

  useEffect(() => {
    void load();
  }, [profile?.hospital_id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((u) =>
      [u.full_name ?? "", u.email ?? "", u.phone ?? "", u.unique_id ?? ""].some((v) => v.toLowerCase().includes(term)),
    );
  }, [rows, q]);

  const createStaff = async () => {
    if (!profile?.hospital_id) return;
    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      toast.error("Full name, email, and password are required.");
      return;
    }
    if (!VALID_EMAIL.test(form.email.trim().toLowerCase())) {
      toast.error("Please provide a valid email.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        full_name: sanitizeText(form.full_name, 200),
        email: sanitizeText(form.email, 320).toLowerCase(),
        phone: sanitizeOptionalText(form.phone || undefined, 40) ?? undefined,
        password: form.password,
        role: "hospital_staff",
        status: form.status,
        hospital_id: profile.hospital_id,
      };
      const { data, error } = await invokeFn("admin-create-user", payload);
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Hospital staff account created");
      setForm({ full_name: "", email: "", phone: "", password: "", status: "active" });
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (user: StaffRow, status: StaffStatus) => {
    setBusy(true);
    try {
      const { data, error } = await invokeFn("admin-manage-user", {
        action: "update_user",
        user_id: user.id,
        status,
        role: "hospital_staff",
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success(status === "active" ? "Staff account activated" : "Staff account deactivated");
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!selected) return;
    const parsed = resetPasswordSchema.safeParse({ new_password: newPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await invokeFn("admin-manage-user", {
        action: "reset_password",
        user_id: selected.id,
        new_password: parsed.data.new_password,
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Password reset");
      setResetOpen(false);
      setSelected(null);
      setNewPassword("");
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u: StaffRow) => {
    if (!window.confirm(`Delete ${u.full_name ?? u.email ?? "this staff account"}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { data, error } = await invokeFn("admin-manage-user", {
        action: "delete_user",
        user_id: u.id,
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Staff account deleted");
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (u: StaffRow) => {
    setSelected(u);
    setEdit({
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      status: (u.status as StaffStatus) ?? "active",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!edit.full_name.trim() || !edit.email.trim()) {
      toast.error("Full name and email are required.");
      return;
    }
    if (!VALID_EMAIL.test(edit.email.trim().toLowerCase())) {
      toast.error("Please provide a valid email.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await invokeFn("admin-manage-user", {
        action: "update_user",
        user_id: selected.id,
        full_name: sanitizeText(edit.full_name, 200),
        email: sanitizeText(edit.email, 320).toLowerCase(),
        phone: sanitizeOptionalText(edit.phone || undefined, 40) ?? undefined,
        status: edit.status,
        role: "hospital_staff",
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Staff profile updated");
      setEditOpen(false);
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!canManage) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <h1 className="font-display text-2xl font-bold">Hospital staff</h1>
          <p className="text-muted-foreground mt-2">Only hospital admins can manage staff accounts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Hospital staff</h1>
          <p className="text-muted-foreground">Create and manage staff accounts for your hospital.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="h-4 w-4" /> Add staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create hospital staff account</DialogTitle>
              <DialogDescription>This account will be linked to your hospital automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Full name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Password * (min 6)</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as StaffStatus }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending_approval">Pending approval</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createStaff} variant="hero" className="w-full" disabled={busy}>
                {busy ? "Creating..." : "Create staff"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search by name, email, phone, or account ID"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Account ID</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Phone</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-medium">{u.full_name ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.unique_id ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {u.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm(`Deactivate ${u.full_name ?? u.email ?? "this staff account"}?`)) return;
                            void setStatus(u, "suspended");
                          }}
                        >
                          <Power className="h-3.5 w-3.5" /> Deactivate
                        </Button>
                      ) : (
                        <Button size="sm" variant="outlineBrand" disabled={busy} onClick={() => void setStatus(u, "active")}>
                          <Power className="h-3.5 w-3.5" /> Activate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => openEdit(u)}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setSelected(u);
                          setResetOpen(true);
                        }}
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Reset
                      </Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => void removeUser(u)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-muted-foreground">
                    No hospital staff found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset staff password</DialogTitle>
            <DialogDescription>Set a temporary password for this staff account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New password (min 6)</Label>
              <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy || newPassword.length < 6} onClick={resetPassword}>
              {busy ? "Resetting..." : "Reset password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit staff profile</DialogTitle>
            <DialogDescription>Update account details for this hospital staff member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name *</Label>
              <Input value={edit.full_name} onChange={(e) => setEdit((x) => ({ ...x, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={edit.email} onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={edit.phone} onChange={(e) => setEdit((x) => ({ ...x, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={edit.status} onValueChange={(v) => setEdit((x) => ({ ...x, status: v as StaffStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_approval">Pending approval</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" variant="hero" disabled={busy} onClick={saveEdit}>
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
