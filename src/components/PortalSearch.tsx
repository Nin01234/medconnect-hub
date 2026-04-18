import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import {
  Activity,
  Building2,
  ClipboardList,
  FilePlus2,
  FileText,
  Hospital,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageCircleHeart,
  MessageSquare,
  ScrollText,
  Search,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";

export type PortalSearchVariant = "clinic" | "hospital" | "admin";

type ReferralHit = {
  id: string;
  referral_number: string | null;
  patient_name: string;
  status: string;
  hospitals?: { name: string } | null;
  clinics?: { name: string } | null;
};

type DoctorHit = { id: string; full_name: string; specialty: string | null; email: string | null; phone: string | null; unique_id: string | null };

type AdminUserHit = {
  id: string;
  unique_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  clinics: { name: string } | null;
  hospitals: { name: string } | null;
  user_roles: { role: string }[];
};

function normalizeRoleList(
  ur: { role: string } | { role: string }[] | null | undefined,
): { role: string }[] {
  if (ur == null) return [];
  return Array.isArray(ur) ? ur : [ur];
}

type AdminClinicHit = { id: string; unique_id: string | null; name: string; region: string | null; city: string | null; type: string };
type AdminHospitalHit = { id: string; unique_id: string | null; name: string; region: string | null; city: string | null; type: string };
type AdminAuditHit = { id: string; action: string; entity_type: string | null; entity_id: string | null; actor_id: string | null; metadata: Record<string, unknown> | null };

function referralSearchValue(r: ReferralHit, extra?: string) {
  return [r.patient_name, r.referral_number, r.status, r.hospitals?.name, r.clinics?.name, extra].filter(Boolean).join(" ");
}

function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "") || /Mac OS/.test(navigator.userAgent || "");
}

export function PortalSearch({
  variant,
  className,
  compact,
}: {
  variant: PortalSearchVariant;
  /** Extra classes for the trigger control */
  className?: string;
  /** Icon-only trigger (e.g. mobile admin bar) */
  compact?: boolean;
}) {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referrals, setReferrals] = useState<ReferralHit[]>([]);
  const [doctors, setDoctors] = useState<DoctorHit[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserHit[]>([]);
  const [adminClinics, setAdminClinics] = useState<AdminClinicHit[]>([]);
  const [adminHospitals, setAdminHospitals] = useState<AdminHospitalHit[]>([]);
  const [adminAudit, setAdminAudit] = useState<AdminAuditHit[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (variant === "clinic" && profile?.clinic_id) {
          const { data } = await supabase
            .from("referrals")
            .select("id, referral_number, patient_name, status, hospitals(name)")
            .eq("clinic_id", profile.clinic_id)
            .order("created_at", { ascending: false })
            .limit(500);
          if (!cancelled) setReferrals((data ?? []) as ReferralHit[]);
        } else if (variant === "hospital" && profile?.hospital_id) {
          const [refRes, docRes] = await Promise.all([
            supabase
              .from("referrals")
              .select("id, referral_number, patient_name, status, clinics(name)")
              .eq("hospital_id", profile.hospital_id)
              .order("created_at", { ascending: false })
              .limit(500),
            supabase.from("doctors").select("id, full_name, specialty, email, phone, unique_id").eq("hospital_id", profile.hospital_id).order("created_at", { ascending: false }),
          ]);
          if (!cancelled) {
            setReferrals((refRes.data ?? []) as ReferralHit[]);
            setDoctors((docRes.data ?? []) as DoctorHit[]);
          }
        } else if (variant === "admin") {
          const [u, c, h, a] = await Promise.all([
            supabase
              .from("profiles")
              .select("id, unique_id, full_name, email, phone, status, clinics(name), hospitals(name), user_roles!user_roles_user_id_fkey(role)")
              .order("created_at", { ascending: false }),
            supabase.from("clinics").select("id, unique_id, name, region, city, type").order("name"),
            supabase.from("hospitals").select("id, unique_id, name, region, city, type").order("name"),
            supabase.from("audit_logs").select("id, action, entity_type, entity_id, actor_id, metadata").order("created_at", { ascending: false }).limit(200),
          ]);
          if (!cancelled) {
            setAdminUsers(
              (u.data ?? []).map((row) => ({
                ...row,
                user_roles: normalizeRoleList(
                  row.user_roles as { role: string } | { role: string }[] | null | undefined,
                ),
              })) as AdminUserHit[],
            );
            setAdminClinics((c.data ?? []) as AdminClinicHit[]);
            setAdminHospitals((h.data ?? []) as AdminHospitalHit[]);
            setAdminAudit((a.data ?? []) as AdminAuditHit[]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, variant, profile?.clinic_id, profile?.hospital_id]);

  const go = (path: string) => {
    setOpen(false);
    nav(path);
  };

  const clinicName = profile?.clinics?.name;
  const hospitalName = profile?.hospitals?.name;

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon" : "sm"}
        className={
          compact
            ? className
            : cn(
                variant === "admin"
                  ? "w-full justify-start gap-2 text-sidebar-foreground border-sidebar-border bg-sidebar-accent/30 hover:bg-sidebar-accent"
                  : "gap-2 text-muted-foreground",
                className,
              )
        }
        onClick={() => setOpen(true)}
        aria-label="Search portal"
      >
        <Search className="h-4 w-4 shrink-0" />
        {!compact && (
          <>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline pointer-events-none ml-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {isApplePlatform() ? "⌘K" : "Ctrl+K"}
            </kbd>
          </>
        )}
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">
          {variant === "clinic" && "Search clinic portal"}
          {variant === "hospital" && "Search hospital portal"}
          {variant === "admin" && "Search admin portal"}
        </DialogTitle>
        <CommandInput placeholder={placeholder(variant, clinicName, hospitalName)} />
        <CommandList>
          <CommandEmpty>{loading ? "Loading…" : "No matches."}</CommandEmpty>

          {variant === "clinic" && (
            <>
              <CommandGroup heading="Pages">
                <CommandItem value="dashboard clinic home" onSelect={() => go("/clinic")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </CommandItem>
                <CommandItem value="create referral new patient" onSelect={() => go("/clinic/referrals/new")}>
                  <FilePlus2 className="mr-2 h-4 w-4" /> Create referral
                </CommandItem>
                <CommandItem value="my referrals list" onSelect={() => go("/clinic/referrals")}>
                  <ListChecks className="mr-2 h-4 w-4" /> My referrals
                </CommandItem>
                <CommandItem value="messages hospital feedback inbox" onSelect={() => go("/clinic/messages")}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Messages & hospital feedback
                </CommandItem>
              </CommandGroup>
              {clinicName && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Your clinic">
                    <CommandItem value={clinicName} disabled>
                      <Stethoscope className="mr-2 h-4 w-4 opacity-50" /> {clinicName}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
              {referrals.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Referrals">
                    {referrals.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={referralSearchValue(r)}
                        onSelect={() => go(`/clinic/referrals/${r.id}`)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        <span className="truncate">
                          {r.patient_name}
                          <span className="text-muted-foreground ml-2 font-mono text-xs">{r.referral_number ?? r.id.slice(0, 8)}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}

          {variant === "hospital" && (
            <>
              <CommandGroup heading="Pages">
                <CommandItem value="dashboard hospital home" onSelect={() => go("/hospital")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </CommandItem>
                <CommandItem value="inbox referrals" onSelect={() => go("/hospital/inbox")}>
                  <Inbox className="mr-2 h-4 w-4" /> Referral inbox
                </CommandItem>
                <CommandItem value="assigned cases" onSelect={() => go("/hospital/assigned")}>
                  <ClipboardList className="mr-2 h-4 w-4" /> Assigned cases
                </CommandItem>
                <CommandItem value="feedback" onSelect={() => go("/hospital/feedback")}>
                  <MessageCircleHeart className="mr-2 h-4 w-4" /> Feedback center
                </CommandItem>
                <CommandItem value="doctors roster" onSelect={() => go("/hospital/doctors")}>
                  <Users className="mr-2 h-4 w-4" /> Doctors
                </CommandItem>
                <CommandItem value="messages" onSelect={() => go("/hospital/messages")}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Messages
                </CommandItem>
              </CommandGroup>
              {hospitalName && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Your hospital">
                    <CommandItem value={hospitalName} disabled>
                      <Activity className="mr-2 h-4 w-4 opacity-50" /> {hospitalName}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
              {referrals.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Referrals">
                    {referrals.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={referralSearchValue(r)}
                        onSelect={() => go(`/hospital/referrals/${r.id}/review`)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        <span className="truncate">
                          {r.patient_name}
                          <span className="text-muted-foreground ml-2 font-mono text-xs">{r.referral_number ?? r.id.slice(0, 8)}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {doctors.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Doctors">
                    {doctors.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={[d.full_name, d.specialty, d.email, d.phone, d.unique_id].filter(Boolean).join(" ")}
                        onSelect={() => go("/hospital/doctors")}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        <span className="truncate">
                          {d.full_name}
                          {d.specialty ? <span className="text-muted-foreground ml-2 text-xs">{d.specialty}</span> : null}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}

          {variant === "admin" && (
            <>
              <CommandGroup heading="Pages">
                <CommandItem value="admin dashboard home" onSelect={() => go("/admin")}>
                  <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </CommandItem>
                <CommandItem value="users" onSelect={() => go("/admin/users")}>
                  <Users className="mr-2 h-4 w-4" /> Users
                </CommandItem>
                <CommandItem value="pending approvals" onSelect={() => go("/admin/approvals")}>
                  <UserCheck className="mr-2 h-4 w-4" /> Pending approvals
                </CommandItem>
                <CommandItem value="clinics" onSelect={() => go("/admin/clinics")}>
                  <Building2 className="mr-2 h-4 w-4" /> Clinics
                </CommandItem>
                <CommandItem value="hospitals" onSelect={() => go("/admin/hospitals")}>
                  <Hospital className="mr-2 h-4 w-4" /> Hospitals
                </CommandItem>
                <CommandItem value="roles" onSelect={() => go("/admin/roles")}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Roles
                </CommandItem>
                <CommandItem value="audit logs" onSelect={() => go("/admin/audit")}>
                  <ScrollText className="mr-2 h-4 w-4" /> Audit logs
                </CommandItem>
              </CommandGroup>
              {adminUsers.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Users">
                    {adminUsers.map((u) => {
                      const roles = (u.user_roles ?? []).map((x) => x.role).join(" ");
                      const org = u.clinics?.name ?? u.hospitals?.name ?? "";
                      return (
                        <CommandItem
                          key={u.id}
                          value={[u.full_name, u.email, u.unique_id, u.phone, u.status, roles, org].filter(Boolean).join(" ")}
                          onSelect={() => go("/admin/users")}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          <span className="truncate">{u.full_name ?? u.email ?? u.id}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
              {adminClinics.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Clinics">
                    {adminClinics.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={[c.name, c.unique_id, c.region, c.city, c.type].filter(Boolean).join(" ")}
                        onSelect={() => go("/admin/clinics")}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        <span className="truncate">{c.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {adminHospitals.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Hospitals">
                    {adminHospitals.map((h) => (
                      <CommandItem
                        key={h.id}
                        value={[h.name, h.unique_id, h.region, h.city, h.type].filter(Boolean).join(" ")}
                        onSelect={() => go("/admin/hospitals")}
                      >
                        <Hospital className="mr-2 h-4 w-4" />
                        <span className="truncate">{h.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {adminAudit.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Recent audit (200)">
                    {adminAudit.map((row) => {
                      const details = row.metadata ? JSON.stringify(row.metadata) : "";
                      return (
                        <CommandItem
                          key={row.id}
                          value={[row.action, row.entity_type, row.entity_id, row.actor_id, details].filter(Boolean).join(" ")}
                          onSelect={() => go("/admin/audit")}
                        >
                          <ScrollText className="mr-2 h-4 w-4" />
                          <span className="truncate text-xs">{row.action}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function placeholder(variant: PortalSearchVariant, clinic?: string | null, hospital?: string | null) {
  if (variant === "clinic") return clinic ? `Search referrals, ${clinic}…` : "Search referrals and pages…";
  if (variant === "hospital") return hospital ? `Search referrals, doctors, ${hospital}…` : "Search referrals, doctors, pages…";
  return "Search users, orgs, audit, pages…";
}
