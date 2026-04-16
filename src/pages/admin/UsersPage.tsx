import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  id: string; full_name: string | null; email: string | null; phone: string | null; status: string;
  clinic_id: string | null; hospital_id: string | null;
  clinics: { name: string; region: string | null; city: string | null } | null;
  hospitals: { name: string; region: string | null; city: string | null } | null;
  user_roles: { role: string }[];
}
interface OrgRef { id: string; name: string; }

const REGIONS = ["Greater Accra","Ashanti","Western","Central","Eastern","Volta","Northern","Upper East","Upper West","Bono","Bono East","Ahafo","Western North","Oti","Savannah","North East"];
const CLINIC_TYPES = ["CHPS","Polyclinic","Private Clinic","Health Center","Other"];
const HOSPITAL_TYPES = ["District","Regional","Teaching","Military","Private","Other"];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [clinics, setClinics] = useState<OrgRef[]>([]);
  const [hospitals, setHospitals] = useState<OrgRef[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: u }, { data: c }, { data: h }] = await Promise.all([
      supabase.from("profiles").select("*, clinics(name,region,city), hospitals(name,region,city), user_roles(role)").order("created_at",{ascending:false}),
      supabase.from("clinics").select("id,name").order("name"),
      supabase.from("hospitals").select("id,name").order("name"),
    ]);
    setUsers((u ?? []) as unknown as UserRow[]);
    setClinics((c ?? []) as OrgRef[]);
    setHospitals((h ?? []) as OrgRef[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    (filterRole === "all" || u.user_roles.some(r => r.role === filterRole)) &&
    (q === "" || (u.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (u.email ?? "").toLowerCase().includes(q.toLowerCase()))
  );

  // Form state
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", password: "", role: "clinic_user",
    status: "active",
    org_mode: "existing" as "existing" | "new", clinic_id: "", hospital_id: "",
    new_org: { name: "", type: "Other", region: "", city: "", address: "", gps_code: "", contact: "", email: "", ownership_type: "Private", departments: [] as string[] },
  });

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name, email: form.email, phone: form.phone, password: form.password,
        role: form.role, status: form.status,
      };
      if (form.role === "clinic_user") {
        if (form.org_mode === "existing") payload.clinic_id = form.clinic_id;
        else payload.new_clinic = {
          name: form.new_org.name, type: form.new_org.type, region: form.new_org.region, city: form.new_org.city,
          address: form.new_org.address, gps_code: form.new_org.gps_code, contact: form.new_org.contact, email: form.new_org.email, ownership_type: form.new_org.ownership_type,
        };
      } else if (form.role === "hospital_admin" || form.role === "hospital_staff") {
        if (form.org_mode === "existing") payload.hospital_id = form.hospital_id;
        else payload.new_hospital = {
          name: form.new_org.name, type: form.new_org.type, region: form.new_org.region, city: form.new_org.city,
          address: form.new_org.address, gps_code: form.new_org.gps_code, contact: form.new_org.contact, email: form.new_org.email, departments: form.new_org.departments,
        };
      }
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body: payload });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("User created");
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", password: "", role: "clinic_user", status: "active", org_mode: "existing", clinic_id: "", hospital_id: "", new_org: { name: "", type: "Other", region: "", city: "", address: "", gps_code: "", contact: "", email: "", ownership_type: "Private", departments: [] } });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const needsOrg = form.role === "clinic_user" || form.role === "hospital_admin" || form.role === "hospital_staff";
  const orgKind = form.role === "clinic_user" ? "clinic" : "hospital";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">{users.length} total · create new users below</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="hero"><Plus className="h-4 w-4" /> Create user</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Section title="Account">
                <Two><F label="Full name *"><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></F>
                <F label="Email *"><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></F></Two>
                <Two><F label="Phone"><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></F>
                <F label="Password * (min 6)"><Input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></F></Two>
                <Two>
                  <F label="Role *">
                    <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v, org_mode: "existing" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinic_user">Clinic User</SelectItem>
                        <SelectItem value="hospital_admin">Hospital Admin</SelectItem>
                        <SelectItem value="hospital_staff">Hospital Staff</SelectItem>
                        <SelectItem value="admin">Admin (system)</SelectItem>
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Status">
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                    </Select>
                  </F>
                </Two>
              </Section>

              {needsOrg && (
                <Section title={`${orgKind === "clinic" ? "Clinic" : "Hospital"} Link`}>
                  <Select value={form.org_mode} onValueChange={v => setForm(f => ({ ...f, org_mode: v as "existing" | "new" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="existing">Link to existing</SelectItem><SelectItem value="new">Create new</SelectItem></SelectContent>
                  </Select>
                  {form.org_mode === "existing" ? (
                    <F label={orgKind === "clinic" ? "Clinic *" : "Hospital *"}>
                      <Select value={orgKind === "clinic" ? form.clinic_id : form.hospital_id} onValueChange={v => setForm(f => ({ ...f, [orgKind === "clinic" ? "clinic_id" : "hospital_id"]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>{(orgKind === "clinic" ? clinics : hospitals).map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </F>
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

              <Button onClick={submit} variant="hero" className="w-full" disabled={busy || !form.full_name || !form.email || !form.password}>
                {busy ? "Creating…" : "Create user"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} className="max-w-sm" />
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="hospital_admin">Hospital Admin</SelectItem>
            <SelectItem value="hospital_staff">Hospital Staff</SelectItem>
            <SelectItem value="clinic_user">Clinic User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-5 py-3">Name</th><th className="text-left px-5 py-3">Email</th><th className="text-left px-5 py-3">Role</th><th className="text-left px-5 py-3">Organization</th><th className="text-left px-5 py-3">Location</th><th className="text-left px-5 py-3">Status</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const org = u.clinics?.name ?? u.hospitals?.name ?? "—";
                const loc = [u.clinics?.region ?? u.hospitals?.region, u.clinics?.city ?? u.hospitals?.city].filter(Boolean).join(", ") || "—";
                return (
                  <tr key={u.id} className="border-b hover:bg-secondary/30">
                    <td className="px-5 py-3 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{u.user_roles[0]?.role.replace(/_/g," ") ?? "—"}</span></td>
                    <td className="px-5 py-3">{org}</td>
                    <td className="px-5 py-3 text-muted-foreground">{loc}</td>
                    <td className="px-5 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${u.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{u.status}</span></td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No users.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-3"><p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{title}</p>{children}</div>;
}
function Two({ children }: { children: React.ReactNode }) { return <div className="grid grid-cols-2 gap-3">{children}</div>; }
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-1 block text-xs">{label}</Label>{children}</div>; }
