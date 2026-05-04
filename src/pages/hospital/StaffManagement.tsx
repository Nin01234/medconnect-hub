import { useCallback, useEffect, useMemo, useState } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  department_id: string | null;
  departments: { name: string } | null;
  user_roles?: { role: string }[];
}

interface DepartmentOption {
  id: string;
  name: string;
}

export default function StaffManagement() {
  const { profile, roles } = useAuth();
  const canManage = hasRole(roles, "hospital_admin", "admin");
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
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
    department_id: "",
    status: "active" as StaffStatus,
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    username: "",
    phone: "",
    staff_id: "",
    department_id: "",
    password: "",
    status: "active" as StaffStatus,
  });

  const isUnauthorizedError = (error: unknown) => {
    const err = error as { message?: string; context?: { status?: number } };
    const msg = err?.message ?? "";
    return err?.context?.status === 401 || /unauthorized|invalid or expired token|401/i.test(msg);
  };

  const invokeFn = async (fnName: "admin-create-user" | "admin-manage-user", body: Record<string, unknown>) => {
    const cleanBody = Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined),
    );
    const sanitizedBody = sanitizePayload(cleanBody);
    const invoke = () =>
      supabase.functions.invoke(fnName, {
        body: sanitizedBody,
        headers: {
          "Content-Type": "application/json",
        },
      });
    let result = await invoke();
    if (!result.error || !isUnauthorizedError(result.error)) return result;

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) throw result.error;
    result = await invoke();
    return result;
  };

  const load = useCallback(async () => {
    if (!profile?.hospital_id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, username, phone, status, staff_id, department_id, departments(name)")
      .eq("hospital_id", profile.hospital_id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(safeClientError(error));
      return;
    }
    const profileRows = ((data ?? []) as unknown as StaffRow[]).filter((u) => u.id !== profile.id);
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "hospital_staff");
    if (roleError) {
      // Fall back to profile attributes if role join/policy is unavailable.
      const fallback = profileRows.filter((u) => !!u.staff_id || !!u.department_id);
      setRows(fallback);
    } else {
      const staffUserIds = new Set((roleRows ?? []).map((r) => (r as { user_id: string }).user_id));
      const staffOnly = profileRows.filter((u) => staffUserIds.has(u.id));
      setRows(staffOnly);
    }
    const { data: depData, error: depError } = await supabase
      .from("departments")
      .select("id,name")
      .eq("hospital_id", profile.hospital_id)
      .eq("status", "active")
      .order("name");
    if (depError) {
      toast.error(safeClientError(depError));
      return;
    }
    setDepartments((depData ?? []) as DepartmentOption[]);
  }, [profile?.hospital_id, profile?.id]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!form.password) setShowCreatePassword(false);
  }, [form.password]);

  const filtered = useMemo(() => {
    const term = sanitizeText(q, 200).toLowerCase();
    if (!term) return rows;
    return rows.filter((u) =>
      [u.full_name ?? "", u.email ?? "", u.username ?? "", u.phone ?? "", u.staff_id ?? "", u.departments?.name ?? ""].some((v) =>
        v.toLowerCase().includes(term),
      ),
    );
  }, [rows, q]);

  const canSubmitCreate =
    !!form.full_name.trim() &&
    !!form.username.trim() &&
    !!form.password &&
    !!form.staff_id.trim() &&
    !!form.department_id;

  const createStaff = async () => {
    if (!profile?.hospital_id) return;
    const selectedDepartment = departments.find((d) => d.id === form.department_id);
    if (!selectedDepartment) {
      toast.error("Please select a valid department for this hospital.");
      return;
    }
    const validated = adminCreateUserSchema.safeParse({
      full_name: form.full_name,
      email: form.email,
      username: form.username,
      phone: form.phone,
      password: form.password,
      role: "hospital_staff",
      status: form.status,
      org_mode: "existing",
      clinic_id: "",
      hospital_id: profile.hospital_id,
        department_id: form.department_id,
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
        role: "hospital_staff",
        status: v.status,
        hospital_id: profile.hospital_id,
        department_id: form.department_id,
        staff_id: sanitizeText(v.staff_id ?? "", 50),
      };
      const normalizedEmail = sanitizeOptionalText(v.email || undefined, 320)?.toLowerCase();
      const normalizedUsername = payload.username;
      if (normalizedEmail) payload.email = normalizedEmail;

      // Pre-check common uniqueness conflicts so admins get instant feedback
      // before we invoke the Edge Function.
      const orFilters = [`username.eq.${normalizedUsername}`];
      if (normalizedEmail) orFilters.push(`email.eq.${normalizedEmail}`);
      const { data: existing, error: existingError } = await supabase
        .from("profiles")
        .select("id, username, email")
        .or(orFilters.join(","))
        .limit(1);
      if (existingError) throw existingError;
      const match = (existing ?? [])[0] as { username?: string | null; email?: string | null } | undefined;
      if (match) {
        if ((match.username ?? "").toLowerCase() === normalizedUsername) {
          throw new Error("Username is already in use. Try a different one.");
        }
        if (normalizedEmail && (match.email ?? "").toLowerCase() === normalizedEmail) {
          throw new Error("A user with this email already exists.");
        }
      }

      const { data, error } = await invokeFn("admin-create-user", payload);
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Hospital staff account created");
      setForm({ full_name: "", email: "", username: "", phone: "", staff_id: "", department_id: "", password: "", status: "active" });
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
      department_id: u.department_id ?? "",
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
      role: "hospital_staff",
      status: edit.status,
      clinic_id: "",
      hospital_id: profile?.hospital_id ?? "",
      department_id: edit.department_id,
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
        department_id: ed.department_id,
        email: sanitizeOptionalText(ed.email || undefined, 320)?.toLowerCase(),
        status: ed.status,
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
    });
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
                <Label>Email (optional)</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Username *</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                  placeholder="lowercase letters, numbers, . _ -"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Staff ID *</Label>
                <Input value={form.staff_id} onChange={(e) => setForm((f) => ({ ...f, staff_id: e.target.value }))} />
              </div>
              <div>
                <Label>Department *</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Password * (min 6)</Label>
                <div className="relative">
                  <Input
                    type={showCreatePassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={form.password ? "pr-20" : ""}
                  />
                  {form.password && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground transition"
                      onClick={() => setShowCreatePassword((v) => !v)}
                      aria-label={showCreatePassword ? "Hide password" : "Show password"}
                    >
                      <span className="inline-flex items-center gap-1">
                        {showCreatePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {showCreatePassword ? "Hide" : "Show"}
                      </span>
                    </button>
                  )}
                </div>
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
              <Button onClick={createStaff} variant="hero" className="w-full" disabled={busy || !canSubmitCreate}>
                {busy ? "Creating..." : "Create staff"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search by name, username, email, phone, staff ID, or department"
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
                <th className="text-left px-5 py-3">Staff ID</th>
                <th className="text-left px-5 py-3">Department</th>
                <th className="text-left px-5 py-3">Username</th>
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
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.staff_id ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{u.departments?.name ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.username ?? "—"}</td>
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
                  <td colSpan={8} className="text-center py-10 text-muted-foreground">
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
              <Label>Email (optional)</Label>
              <Input type="email" value={edit.email} onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} />
            </div>
            <div>
              <Label>Username *</Label>
              <Input
                value={edit.username}
                onChange={(e) => setEdit((x) => ({ ...x, username: e.target.value.toLowerCase() }))}
                placeholder="lowercase letters, numbers, . _ -"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={edit.phone} onChange={(e) => setEdit((x) => ({ ...x, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Staff ID *</Label>
              <Input value={edit.staff_id} onChange={(e) => setEdit((x) => ({ ...x, staff_id: e.target.value }))} />
            </div>
            <div>
              <Label>Department *</Label>
              <Select value={edit.department_id} onValueChange={(v) => setEdit((x) => ({ ...x, department_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
