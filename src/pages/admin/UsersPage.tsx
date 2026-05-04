import { useEffect, useMemo, useState } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Eye, EyeOff, KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminCreateUserSchema,
  adminEditUserSchema,
  resetPasswordSchema,
} from "@/lib/validation";
import { safeClientError, safeFunctionError } from "@/lib/safeError";
import { sanitizeOptionalText, sanitizeText } from "@/lib/sanitize";
import { sanitizePayload } from "@/lib/sanitizePayload";

type UserStatus = "pending_approval" | "active" | "rejected" | "suspended";

interface UserRow {
  id: string; unique_id: string | null; full_name: string | null; email: string | null; username: string | null; phone: string | null; status: string;
  clinic_id: string | null; hospital_id: string | null;
  clinics: { name: string; region: string | null; city: string | null } | null;
  hospitals: { name: string; region: string | null; city: string | null } | null;
  user_roles: { role: string }[];
}
interface OrgRef { id: string; name: string; }
interface DepartmentRef { id: string; name: string; hospital_id: string; }

const REGIONS = ["Greater Accra","Ashanti","Western","Central","Eastern","Volta","Northern","Upper East","Upper West","Bono","Bono East","Ahafo","Western North","Oti","Savannah","North East"];
const CLINIC_TYPES = ["CHPS","Polyclinic","Private Clinic","Health Center","Other"];
const HOSPITAL_TYPES = ["District","Regional","Teaching","Military","Private","Other"];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clinics, setClinics] = useState<OrgRef[]>([]);
  const [hospitals, setHospitals] = useState<OrgRef[]>([]);
  const [departments, setDepartments] = useState<DepartmentRef[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const runGuarded = useSubmitGuard();
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [edit, setEdit] = useState({
    full_name: "",
    email: "",
    username: "",
    phone: "",
    role: "clinic_admin",
    status: "active" as UserStatus,
    clinic_id: "",
    hospital_id: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  const isUnauthorizedError = (error: unknown) => {
    const err = error as { message?: string; context?: { status?: number; statusText?: string } };
    const msg = err?.message ?? "";
    return err?.context?.status === 401 || /unauthorized|invalid or expired token|401/i.test(msg);
  };

  const isJwtAlgorithmMismatchError = (error: unknown) => {
    const err = error as { message?: string };
    return /unsupported jwt algorithm/i.test(err?.message ?? "");
  };

  const invokeAdminFunction = async (
    fnName: "admin-create-user" | "admin-manage-user",
    body: Record<string, unknown>,
  ) => {
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

    // Do not force logout on server-side auth misconfiguration errors.
    // This keeps admin session alive while showing a meaningful error.
    if (isJwtAlgorithmMismatchError(result.error)) {
      throw new Error("Request failed (401): Unsupported JWT algorithm. Function JWT verification must be updated.");
    }

    throw result.error;
  };

  const load = async () => {
    const [
      { data: u, error: usersError },
      { data: c, error: clinicsError },
      { data: h, error: hospitalsError },
      { data: d, error: departmentsError },
    ] = await Promise.all([
      supabase.from("profiles").select("*, clinics(name,region,city), hospitals(name,region,city), user_roles!user_roles_user_id_fkey(role)").order("created_at",{ascending:false}),
      supabase.from("clinics").select("id,name").order("name"),
      supabase.from("hospitals").select("id,name").order("name"),
      supabase.from("departments").select("id,name,hospital_id").order("name"),
    ]);
    if (usersError || clinicsError || hospitalsError || departmentsError) {
      toast.error(safeClientError(usersError ?? clinicsError ?? hospitalsError ?? departmentsError));
      return;
    }
    setUsers((u ?? []) as unknown as UserRow[]);
    setClinics((c ?? []) as OrgRef[]);
    setHospitals((h ?? []) as OrgRef[]);
    setDepartments((d ?? []) as DepartmentRef[]);
  };
  useEffect(() => { load(); }, []);

  const pendingCount = useMemo(() => users.filter((u) => u.status === "pending_approval").length, [users]);
  const activeCount = useMemo(() => users.filter((u) => u.status === "active").length, [users]);

  const filtered = useMemo(() => {
    const term = sanitizeText(q, 200).toLowerCase();
    return users
    .filter(u => {
      return (
        (filterRole === "all" || u.user_roles.some(r => r.role === filterRole)) &&
        (filterStatus === "all" || u.status === filterStatus) &&
        (
          term === "" ||
          (u.full_name ?? "").toLowerCase().includes(term) ||
          (u.email ?? "").toLowerCase().includes(term) ||
          (u.username ?? "").toLowerCase().includes(term) ||
          (u.unique_id ?? "").toLowerCase().includes(term) ||
          (u.phone ?? "").toLowerCase().includes(term)
        )
      );
    })
    .sort((a, b) => {
      if (a.status === "pending_approval" && b.status !== "pending_approval") return -1;
      if (a.status !== "pending_approval" && b.status === "pending_approval") return 1;
      return 0;
    });
  }, [users, filterRole, filterStatus, q]);

  // Form state
  const [form, setForm] = useState({
    full_name: "", email: "", username: "", phone: "", password: "", role: "clinic_admin",
    status: "active" as UserStatus,
    org_mode: "existing" as "existing" | "new", clinic_id: "", hospital_id: "",
    department_id: "",
    staff_id: "",
    new_org: { name: "", type: "Other", region: "", city: "", address: "", gps_code: "", contact: "", email: "", ownership_type: "Private", departments: [] as string[] },
  });
  useEffect(() => {
    if (!form.password) setShowCreatePassword(false);
  }, [form.password]);

  const submit = async () => {
    const validated = adminCreateUserSchema.safeParse({
      full_name: form.full_name,
      email: form.email,
      username: form.username,
      phone: form.phone,
      password: form.password,
      role: form.role,
      status: form.status,
      org_mode: form.org_mode,
      clinic_id: form.clinic_id,
      hospital_id: form.hospital_id,
      department_id: form.department_id,
      staff_id: form.staff_id,
      new_org:
        form.org_mode === "new"
          ? {
              name: form.new_org.name,
              type: form.new_org.type,
              region: form.new_org.region,
              city: form.new_org.city,
              address: form.new_org.address,
              gps_code: form.new_org.gps_code,
              contact: form.new_org.contact,
              email: form.new_org.email,
              ownership_type: form.new_org.ownership_type,
              departments: form.new_org.departments,
            }
          : undefined,
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
        role: v.role,
        status: v.status,
      };
      const normalizedEmail = sanitizeOptionalText(v.email || undefined, 320)?.toLowerCase();
      if (normalizedEmail) payload.email = normalizedEmail;
      if (v.role === "clinic_admin") {
        if (v.org_mode === "existing") payload.clinic_id = v.clinic_id;
        else if (v.new_org) {
          payload.new_clinic = {
            name: sanitizeText(v.new_org.name, 200),
            type: sanitizeText(v.new_org.type, 120),
            region: sanitizeText(v.new_org.region, 120),
            city: sanitizeText(v.new_org.city, 120),
            address: sanitizeText(v.new_org.address, 500),
            gps_code: sanitizeText(v.new_org.gps_code, 80),
            contact: sanitizeText(v.new_org.contact, 40),
            email: sanitizeOptionalText(v.new_org.email || undefined, 320) ?? undefined,
            ownership_type: sanitizeOptionalText(v.new_org.ownership_type, 80) ?? undefined,
          };
        }
      } else if (v.role === "hospital_admin") {
        if (v.org_mode === "existing") payload.hospital_id = v.hospital_id;
        else if (v.new_org) {
          payload.new_hospital = {
            name: sanitizeText(v.new_org.name, 200),
            type: sanitizeText(v.new_org.type, 120),
            region: sanitizeText(v.new_org.region, 120),
            city: sanitizeText(v.new_org.city, 120),
            address: sanitizeText(v.new_org.address, 500),
            gps_code: sanitizeText(v.new_org.gps_code, 80),
            contact: sanitizeText(v.new_org.contact, 40),
            email: sanitizeOptionalText(v.new_org.email || undefined, 320) ?? undefined,
            departments: (v.new_org.departments ?? []).slice(0, 20).map((d) => sanitizeText(d, 80)),
          };
        }
      }
      const { data, error } = await invokeAdminFunction("admin-create-user", payload);
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("User created");
      setOpen(false);
      setForm({ full_name: "", email: "", username: "", phone: "", password: "", role: "clinic_admin", status: "active", org_mode: "existing", clinic_id: "", hospital_id: "", department_id: "", staff_id: "", new_org: { name: "", type: "Other", region: "", city: "", address: "", gps_code: "", contact: "", email: "", ownership_type: "Private", departments: [] } });
      load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally { setBusy(false); }
    });
  };

  const runAdminAction = async (body: Record<string, unknown>) => {
    const { data, error } = await invokeAdminFunction("admin-manage-user", body);
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  };

  const openEdit = (u: UserRow) => {
    setSelected(u);
    setEdit({
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      username: u.username ?? "",
      phone: u.phone ?? "",
      role: u.user_roles[0]?.role ?? "clinic_admin",
      status: (u.status as UserStatus) ?? "active",
      clinic_id: u.clinic_id ?? "",
      hospital_id: u.hospital_id ?? "",
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
      role: edit.role,
      status: edit.status,
      clinic_id: edit.clinic_id,
      hospital_id: edit.hospital_id,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
      return;
    }
    const ed = parsed.data;
    await runGuarded(async () => {
    setBusy(true);
    try {
      await runAdminAction({
        action: "update_user",
        user_id: selected.id,
        full_name: sanitizeText(ed.full_name, 200),
        username: sanitizeText(ed.username, 30).toLowerCase(),
        phone: sanitizeOptionalText(ed.phone || undefined, 40) ?? undefined,
        role: ed.role,
        status: ed.status,
        clinic_id: ed.role === "clinic_admin" ? (ed.clinic_id || null) : null,
        hospital_id: ed.role === "hospital_admin" ? (ed.hospital_id || null) : null,
        email: sanitizeOptionalText(ed.email || undefined, 320)?.toLowerCase(),
      });
      toast.success("User updated");
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const approve = async (u: UserRow) => {
    await runGuarded(async () => {
    setBusy(true);
    try {
      await runAdminAction({ action: "approve_user", user_id: u.id });
      toast.success("User approved");
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const setStatus = async (u: UserRow, status: UserStatus) => {
    await runGuarded(async () => {
    setBusy(true);
    try {
      await runAdminAction({ action: "update_user", user_id: u.id, status });
      toast.success(status === "active" ? "User activated" : "User deactivated");
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
      await runAdminAction({ action: "reset_password", user_id: selected.id, new_password: parsed.data.new_password });
      toast.success("Password reset");
      setResetOpen(false);
      setNewPassword("");
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const removeUser = async (u: UserRow) => {
    if (!window.confirm(`Delete ${u.full_name ?? u.email ?? "this user"}? This cannot be undone.`)) return;
    await runGuarded(async () => {
    setBusy(true);
    try {
      await runAdminAction({ action: "delete_user", user_id: u.id });
      toast.success("User removed");
      await load();
    } catch (e) {
      toast.error(await safeFunctionError(e));
    } finally {
      setBusy(false);
    }
    });
  };

  const needsOrg = form.role === "clinic_admin" || form.role === "hospital_admin";
  const orgKind = form.role === "clinic_admin" ? "clinic" : "hospital";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">{users.length} total users · manage accounts and approvals</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="h-4 w-4" /> Create user</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create user</DialogTitle>
              <DialogDescription>Create a new account and optionally link it to a clinic or hospital.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Section title="Account">
                <Two><F label="Full name *"><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></F>
                <F label={form.role === "hospital_admin" || form.role === "clinic_admin" ? "Email *" : "Email (optional)"}><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></F></Two>
                <Two><F label="Username *"><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} placeholder="lowercase letters, numbers, . _ -" /></F>
                <F label="Phone"><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></F></Two>
                <F label="Password * (min 6)">
                  <div className="relative">
                    <Input
                      type={showCreatePassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
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
                </F>
                <Two>
                  <F label="Role *">
                    <Select
                      value={form.role}
                      onValueChange={(v) =>
                        setForm((f) => ({
                          ...f,
                          role: v,
                          org_mode: "existing",
                          clinic_id: "",
                          hospital_id: "",
                          department_id: "",
                          staff_id: "",
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinic_admin">Clinic Admin</SelectItem>
                        <SelectItem value="hospital_admin">Hospital Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Status">
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as UserStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending_approval">Pending approval</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                </Two>
              </Section>

              {needsOrg && (
                <Section title={`${orgKind === "clinic" ? "Clinic" : "Hospital"} Link`}>
                  <Select
                    value={form.org_mode}
                    onValueChange={(v) => setForm((f) => ({ ...f, org_mode: v as "existing" | "new" }))}
                    disabled={false}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="existing">Link to existing</SelectItem><SelectItem value="new">Create new</SelectItem></SelectContent>
                  </Select>
                  {form.org_mode === "existing" ? (
                    <>
                      <F label={orgKind === "clinic" ? "Clinic *" : "Hospital *"}>
                        <Select
                          value={orgKind === "clinic" ? form.clinic_id : form.hospital_id}
                          onValueChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              [orgKind === "clinic" ? "clinic_id" : "hospital_id"]: v,
                              ...(orgKind === "hospital" ? { department_id: "" } : {}),
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>{(orgKind === "clinic" ? clinics : hospitals).map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </F>

                    </>
                  ) : (
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                      <Two>
                        <F label="Name *"><Input value={form.new_org.name} onChange={e => setForm(f => ({ ...f, new_org: { ...f.new_org, name: e.target.value } }))} /></F>
                        <F label="Type">
                          <Select value={form.new_org.type} onValueChange={v => setForm(f => ({ ...f, new_org: { ...f.new_org, type: v } }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{(orgKind === "clinic" ? CLINIC_TYPES : HOSPITAL_TYPES).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </F>
                      </Two>
                      <Two>
                        <F label="Region">
                          <Select value={form.new_org.region} onValueChange={v => setForm(f => ({ ...f, new_org: { ...f.new_org, region: v } }))}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                          </Select>
                        </F>
                        <F label="City"><Input value={form.new_org.city} onChange={e => setForm(f => ({ ...f, new_org: { ...f.new_org, city: e.target.value } }))} /></F>
                      </Two>
                      <F label="Full address"><Input value={form.new_org.address} onChange={e => setForm(f => ({ ...f, new_org: { ...f.new_org, address: e.target.value } }))} /></F>
                      <Two>
                        <F label="GPS / Digital address"><Input value={form.new_org.gps_code} onChange={e => setForm(f => ({ ...f, new_org: { ...f.new_org, gps_code: e.target.value } }))} placeholder="GA-123-4567" /></F>
                        <F label="Contact phone"><Input value={form.new_org.contact} onChange={e => setForm(f => ({ ...f, new_org: { ...f.new_org, contact: e.target.value } }))} /></F>
                      </Two>
                      <F label="Org email"><Input type="email" value={form.new_org.email} onChange={e => setForm(f => ({ ...f, new_org: { ...f.new_org, email: e.target.value } }))} /></F>
                      {orgKind === "hospital" && (
                        <F label="Departments (comma-separated)"><Input placeholder="Emergency, Surgery, Pediatrics" onChange={e => setForm(f => ({ ...f, new_org: { ...f.new_org, departments: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } }))} /></F>
                      )}
                      {orgKind === "clinic" && (
                        <F label="Ownership">
                          <Select value={form.new_org.ownership_type} onValueChange={v => setForm(f => ({ ...f, new_org: { ...f.new_org, ownership_type: v } }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Private">Private</SelectItem><SelectItem value="Government">Government</SelectItem><SelectItem value="Mission">Mission</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                          </Select>
                        </F>
                      )}
                    </div>
                  )}
                </Section>
              )}

              <Button
                onClick={submit}
                variant="hero"
                className="w-full"
                disabled={
                  busy ||
                  !form.full_name ||
                  !form.username ||
                  !form.password ||
                  ((form.role === "hospital_admin" || form.role === "clinic_admin") && !form.email.trim()) ||
                  (form.role === "hospital_admin" &&
                    form.org_mode === "existing" &&
                    !form.hospital_id) ||
                  (form.role === "clinic_admin" &&
                    form.org_mode === "existing" &&
                    !form.clinic_id)
                }
              >
                {busy ? "Creating…" : "Create user"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wide">Pending approval</p><p className="text-2xl font-semibold text-amber-600">{pendingCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wide">Active users</p><p className="text-2xl font-semibold text-emerald-600">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase tracking-wide">Total users</p><p className="text-2xl font-semibold">{users.length}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search name, username, email, account ID, or phone" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="hospital_admin">Hospital Admin</SelectItem>
            <SelectItem value="hospital_staff">Hospital Staff</SelectItem>
            <SelectItem value="clinic_admin">Clinic Admin</SelectItem>
            <SelectItem value="clinic_staff">Clinic Staff</SelectItem>
            <SelectItem value="clinic_user">Clinic User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Account ID</th><th className="text-left px-5 py-3">Username</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3">Role</th><th className="text-left px-5 py-3">Organization</th><th className="text-left px-5 py-3">Location</th><th className="text-left px-5 py-3">Status</th><th className="text-left px-5 py-3">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const org = u.clinics?.name ?? u.hospitals?.name ?? "—";
                const loc = [u.clinics?.region ?? u.hospitals?.region, u.clinics?.city ?? u.hospitals?.city].filter(Boolean).join(", ") || "—";
                return (
                  <tr key={u.id} className="border-b hover:bg-secondary/30">
                    <td className="px-5 py-3 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.unique_id ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.username ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{u.user_roles[0]?.role.replace(/_/g," ") ?? "—"}</span></td>
                    <td className="px-5 py-3">{org}</td>
                    <td className="px-5 py-3 text-muted-foreground">{loc}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{u.status}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        {u.status === "pending_approval" && (
                          <Button size="sm" variant="outlineBrand" disabled={busy} onClick={() => approve(u)}><Check className="h-3.5 w-3.5" /> Approve</Button>
                        )}
                        {u.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Deactivate ${u.full_name ?? u.email ?? "this user"}?`)) return;
                              setStatus(u, "suspended");
                            }}
                          >
                            <Power className="h-3.5 w-3.5" /> Deactivate
                          </Button>
                        )}
                        {(u.status === "suspended" || u.status === "rejected") && (
                          <Button size="sm" variant="outlineBrand" disabled={busy} onClick={() => setStatus(u, "active")}>
                            <Power className="h-3.5 w-3.5" /> Activate
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => { setSelected(u); setResetOpen(true); }}><KeyRound className="h-3.5 w-3.5" /> Reset</Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => removeUser(u)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No users.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update profile fields, role, or account status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <F label="Full name"><Input value={edit.full_name} onChange={(e) => setEdit((x) => ({ ...x, full_name: e.target.value }))} /></F>
            <F label="Email (optional)"><Input type="email" value={edit.email} onChange={(e) => setEdit((x) => ({ ...x, email: e.target.value }))} /></F>
            <F label="Username"><Input value={edit.username} onChange={(e) => setEdit((x) => ({ ...x, username: e.target.value.toLowerCase() }))} placeholder="lowercase letters, numbers, . _ -" /></F>
            <F label="Phone"><Input value={edit.phone} onChange={(e) => setEdit((x) => ({ ...x, phone: e.target.value }))} /></F>
            <Two>
              <F label="Role">
                <Select value={edit.role} onValueChange={(v) => setEdit((x) => ({ ...x, role: v, clinic_id: v === "clinic_user" || v === "clinic_admin" || v === "clinic_staff" ? x.clinic_id : "", hospital_id: v === "hospital_admin" || v === "hospital_staff" ? x.hospital_id : "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinic_admin">Clinic Admin</SelectItem>
                    <SelectItem value="hospital_admin">Hospital Admin</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Status">
                <Select value={edit.status} onValueChange={(v) => setEdit((x) => ({ ...x, status: v as UserStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_approval">Pending approval</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </F>
            </Two>
            {edit.role === "clinic_admin" && (
              <F label="Clinic">
                <Select value={edit.clinic_id} onValueChange={(v) => setEdit((x) => ({ ...x, clinic_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select clinic" /></SelectTrigger>
                  <SelectContent>
                    {clinics.length > 0 ? (
                      clinics.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_clinics__" disabled>No clinics available. Create one first.</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </F>
            )}
            {edit.role === "hospital_admin" && (
              <F label="Hospital">
                <Select value={edit.hospital_id} onValueChange={(v) => setEdit((x) => ({ ...x, hospital_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select hospital" /></SelectTrigger>
                  <SelectContent>
                    {hospitals.length > 0 ? (
                      hospitals.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_hospitals__" disabled>No hospitals available. Create one first.</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </F>
            )}
            <Button
              className="w-full"
              variant="hero"
              disabled={
                busy ||
                !edit.full_name ||
                !edit.username ||
                (edit.role === "clinic_admin" && !edit.clinic_id) ||
                (edit.role === "hospital_admin" && !edit.hospital_id)
              }
              onClick={saveEdit}
            >
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a temporary password for this user account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <F label="New password (min 6)">
              <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </F>
            <Button className="w-full" disabled={busy || newPassword.length < 6} onClick={resetPassword}>
              {busy ? "Resetting..." : "Reset password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-3"><p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{title}</p>{children}</div>;
}
function Two({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-1 block text-xs">{label}</Label>{children}</div>; }
