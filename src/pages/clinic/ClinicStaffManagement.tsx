import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminCreateUserSchema, adminEditUserSchema, resetPasswordSchema } from "@/lib/validation";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { sanitizePayload } from "@/lib/sanitizePayload";
import { safeClientError, safeFunctionError } from "@/lib/safeError";

type StaffStatus = "pending_approval" | "active" | "rejected" | "suspended";

interface StaffRow {
  id: string;
  full_name: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  status: string;
  staff_id: string | null;
}

export default function ClinicStaffManagement() {
  const { profile, roles } = useAuth();
  const canManage = hasRole(roles, "clinic_admin", "admin");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [busy, setBusy] = useState(false);
  const runGuarded = useSubmitGuard();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<StaffRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [edit, setEdit] = useState({
    full_name: "",
    email: "",
    username: "",
    phone: "",
    staff_id: "",
    status: "active" as StaffStatus,
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    username: "",
    phone: "",
    staff_id: "",
    password: "",
    status: "active" as StaffStatus,
  });

  const isUnauthorizedError = (error: unknown) => {
    const err = error as { message?: string; context?: { status?: number } };
    const msg = err?.message ?? "";
    return err?.context?.status === 401 || /unauthorized|invalid or expired token|401/i.test(msg);
  };

  const invokeFn = async (fnName: "admin-create-user" | "admin-manage-user", body: Record<string, unknown>) => {
    const cleanBody = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
    const sanitizedBody = sanitizePayload(cleanBody);
    const invoke = () =>
      supabase.functions.invoke(fnName, {
        body: sanitizedBody,
        headers: { "Content-Type": "application/json" },
      });
    let result = await invoke();
    if (!result.error || !isUnauthorizedError(result.error)) return result;

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) throw result.error;
    result = await invoke();
    return result;
  };

  const load = useCallback(async () => {
    if (!profile?.department_id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, username, phone, status, staff_id")
      .eq("department_id", profile.department_id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(safeClientError(error));
      return;
    }
    const profileRows = ((data ?? []) as StaffRow[]).filter((u) => u.id !== profile.id);
    const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("user_id, role").eq("role", "clinic_staff");
    if (roleError) {
      const fallback = profileRows.filter((u) => !!u.staff_id);
      setRows(fallback);
      return;
    }
    const staffUserIds = new Set((roleRows ?? []).map((r) => (r as { user_id: string }).user_id));
    setRows(profileRows.filter((u) => staffUserIds.has(u.id)));
  }, [profile?.department_id, profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!form.password) setShowCreatePassword(false);
  }, [form.password]);

  const filtered = useMemo(() => {
    const term = sanitizeText(q, 200).toLowerCase();
    if (!term) return rows;
    return rows.filter((u) => [u.full_name ?? "", u.email ?? "", u.username ?? "", u.phone ?? "", u.staff_id ?? ""].some((v) => v.toLowerCase().includes(term)));
  }, [rows, q]);

  const createStaff = async () => {
    if (!profile?.department_id) return;
    const validated = adminCreateUserSchema.safeParse({
      full_name: form.full_name,
      email: form.email,
      username: form.username,
      phone: form.phone,
      password: form.password,
      role: "clinic_staff",
      status: form.status,
      org_mode: "existing",
      clinic_id: "",
      hospital_id: profile.hospital_id ?? undefined,
      department_id: profile.department_id,
      staff_id: form.staff_id,
      new_org: undefined,
    });
    if (!validated.success) {
      toast.error(validated.error.issues[0]?.message ?? "Check your input.");
      return;
    }

    await runGuarded(async () => {
    setBusy(true);
    try {
      const v = validated.data;
      const payload: Record<string, unknown> = {
        full_name: sanitizeText(v.full_name, 200),
        username: sanitizeText(v.username, 30).toLowerCase(),
        phone: sanitizeOptionalText(v.phone || undefined, 40) ?? undefined,
        password: v.password,
        role: "clinic_staff",
        status: v.status,
        hospital_id: profile.hospital_id ?? "",
        department_id: profile.department_id,
        staff_id: sanitizeText(v.staff_id ?? "", 50),
      };
      const normalizedEmail = sanitizeOptionalText(v.email || undefined, 320)?.toLowerCase();
      if (normalizedEmail) payload.email = normalizedEmail;

      const { data, error } = await invokeFn("admin-create-user", payload);
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Department staff account created");
      setForm({ full_name: "", email: "", username: "", phone: "", staff_id: "", password: "", status: "active" });
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const setStatus = async (user: StaffRow, status: StaffStatus) => {
    await runGuarded(async () => {
    setBusy(true);
    try {
      const { data, error } = await invokeFn("admin-manage-user", {
        action: "update_user",
        user_id: user.id,
        status,
        role: "clinic_staff",
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
    });
  };

  const resetPassword = async () => {
    if (!selected) return;
    const parsed = resetPasswordSchema.safeParse({ new_password: newPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Password must be at least 6 characters.");
      return;
    }
    await runGuarded(async () => {
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
    });
  };

  const removeUser = async (u: StaffRow) => {
    if (!window.confirm(`Delete ${u.full_name ?? u.email ?? "this staff account"}? This cannot be undone.`)) return;
    await runGuarded(async () => {
    setBusy(true);
    try {
      const { data, error } = await invokeFn("admin-manage-user", { action: "delete_user", user_id: u.id });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Staff account deleted");
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const openEdit = (u: StaffRow) => {
    setSelected(u);
    setEdit({
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      username: u.username ?? "",
      phone: u.phone ?? "",
      staff_id: u.staff_id ?? "",
      status: (u.status as StaffStatus) ?? "active",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    const parsed = adminEditUserSchema.safeParse({
      full_name: edit.full_name,
      email: edit.email,
      username: edit.username,
      phone: edit.phone,
      role: "clinic_staff",
      status: edit.status,
      clinic_id: "",
      hospital_id: profile?.hospital_id ?? "",
      department_id: profile?.department_id ?? "",
      staff_id: edit.staff_id,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
      return;
    }
    await runGuarded(async () => {
    setBusy(true);
    try {
      const ed = parsed.data;
      const { data, error } = await invokeFn("admin-manage-user", {
        action: "update_user",
        user_id: selected.id,
        full_name: sanitizeText(ed.full_name, 200),
        username: sanitizeText(ed.username, 30).toLowerCase(),
        phone: sanitizeOptionalText(ed.phone || undefined, 40) ?? undefined,
        staff_id: sanitizeText(ed.staff_id ?? "", 50),
        department_id: profile?.department_id,
        hospital_id: profile?.hospital_id ?? undefined,
        email: sanitizeOptionalText(ed.email || undefined, 320)?.toLowerCase(),
        status: ed.status,
        role: "clinic_staff",
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
    });
  };

  if (!canManage) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <h1 className="font-display text-2xl font-bold">Department staff</h1>
          <p className="text-muted-foreground mt-2">Only department admins can manage department staff accounts.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Department staff</h1>
          <p className="text-muted-foreground">Create and manage staff accounts for your department.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero"><Plus className="h-4 w-4" /> Add staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create department staff account</DialogTitle>
              <DialogDescription>This account will be linked to your department automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Full name *"><Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} /></Field>
              <Field label="Email (optional)"><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
              <Field label="Username *"><Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
              <Field label="Staff ID *"><Input value={form.staff_id} onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))} /></Field>
              <Field label="Password * (min 6)">
                <div className="relative">
                  <Input type={showCreatePassword ? "text" : "password"} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={form.password ? "pr-20" : ""} />
                  {form.password && (
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground transition" onClick={() => setShowCreatePassword((v) => !v)}>
                      <span className="inline-flex items-center gap-1">{showCreatePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}{showCreatePassword ? "Hide" : "Show"}</span>
                    </button>
                  )}
                </div>
              </Field>
              <Button onClick={createStaff} variant="hero" className="w-full" disabled={busy || !form.full_name.trim() || !form.username.trim() || !form.staff_id.trim() || !form.password}>
                {busy ? "Creating..." : "Create staff"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input placeholder="Search by name, username, email, phone, or staff ID" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Staff ID</th><th className="text-left px-5 py-3">Username</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3">Phone</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b hover:bg-secondary/30">
                  <td className="px-5 py-3 font-medium">{u.full_name ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.staff_id ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.username ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
                  <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{u.status}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      {u.status === "active" ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(u, "suspended")}><Power className="h-3.5 w-3.5" /> Deactivate</Button>
                      ) : (
                        <Button size="sm" variant="outlineBrand" disabled={busy} onClick={() => setStatus(u, "active")}><Power className="h-3.5 w-3.5" /> Activate</Button>
                      )}
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setSelected(u); setResetOpen(true); }}><KeyRound className="h-3.5 w-3.5" /> Reset</Button>
                      <Button size="sm" variant="destructive" disabled={busy} onClick={() => removeUser(u)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit department staff profile</DialogTitle>
            <DialogDescription>Update account details for this department staff member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Full name *"><Input value={edit.full_name} onChange={(e) => setEdit((x) => ({ ...x, full_name: e.target.value }))} /></Field>
            <Field label="Email (optional)"><Input type="email" value={edit.email} onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} /></Field>
            <Field label="Username *"><Input value={edit.username} onChange={(e) => setEdit((x) => ({ ...x, username: e.target.value.toLowerCase() }))} /></Field>
            <Field label="Phone"><Input value={edit.phone} onChange={(e) => setEdit((x) => ({ ...x, phone: e.target.value }))} /></Field>
            <Field label="Staff ID *"><Input value={edit.staff_id} onChange={(e) => setEdit((x) => ({ ...x, staff_id: e.target.value }))} /></Field>
            <Button className="w-full" variant="hero" disabled={busy} onClick={saveEdit}>{busy ? "Saving..." : "Save changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset staff password</DialogTitle>
            <DialogDescription>Set a temporary password for this staff account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="New password (min 6)"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
            <Button className="w-full" disabled={busy || newPassword.length < 6} onClick={resetPassword}>{busy ? "Resetting..." : "Reset password"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><Label className="mb-1 block text-xs">{label}</Label>{children}</div>;
}
