import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Building2, Hospital, FileText, UserCheck, Activity, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface RecentAudit {
  id: string;
  action: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [c, setC] = useState({ users: 0, clinics: 0, hospitals: 0, referrals: 0, pendingApprovals: 0 });
  const [recentAudits, setRecentAudits] = useState<RecentAudit[]>([]);
  useEffect(() => {
    (async () => {
      const [u, cl, h, r, pending, audits] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("clinics").select("id", { count: "exact", head: true }),
        supabase.from("hospitals").select("id", { count: "exact", head: true }),
        supabase.from("referrals").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
        supabase.from("audit_logs").select("id, action, created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      setC({
        users: u.count ?? 0,
        clinics: cl.count ?? 0,
        hospitals: h.count ?? 0,
        referrals: r.count ?? 0,
        pendingApprovals: pending.count ?? 0,
      });
      setRecentAudits((audits.data ?? []) as RecentAudit[]);
    })();
  }, []);
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-r from-primary/10 via-accent/10 to-background p-6 shadow-card">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="inline-flex items-center rounded-full bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Admin control center
            </p>
            <h1 className="font-display text-3xl font-bold">Modern Operations Dashboard</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Monitor platform health, review onboarding queues, and access critical admin actions from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/users"><Button variant="outlineBrand">Manage users</Button></Link>
            <Link to="/admin/approvals"><Button variant="gold">Review approvals</Button></Link>
            <Link to="/admin/audit"><Button variant="outline">Open audit logs</Button></Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Users" value={c.users} icon={<Users className="h-5 w-5" />} accent="primary" />
        <StatCard label="Clinics" value={c.clinics} icon={<Building2 className="h-5 w-5" />} accent="info" />
        <StatCard label="Hospitals" value={c.hospitals} icon={<Hospital className="h-5 w-5" />} accent="success" />
        <StatCard label="Referrals" value={c.referrals} icon={<FileText className="h-5 w-5" />} accent="gold" />
        <Link to="/admin/approvals" className="block">
          <StatCard label="Pending approvals" value={c.pendingApprovals} icon={<UserCheck className="h-5 w-5" />} accent="warning" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Quick Actions</h2>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/admin/users" className="rounded-xl border p-4 transition-colors hover:bg-secondary/30">
                <p className="font-medium">User Management</p>
                <p className="text-sm text-muted-foreground mt-1">Create, edit, and manage accounts.</p>
              </Link>
              <Link to="/admin/approvals" className="rounded-xl border p-4 transition-colors hover:bg-secondary/30">
                <p className="font-medium">Onboarding Queue</p>
                <p className="text-sm text-muted-foreground mt-1">Approve and activate pending signups.</p>
              </Link>
              <Link to="/admin/roles" className="rounded-xl border p-4 transition-colors hover:bg-secondary/30">
                <p className="font-medium">Roles & Access</p>
                <p className="text-sm text-muted-foreground mt-1">Review user permissions and role setup.</p>
              </Link>
              <Link to="/admin/audit" className="rounded-xl border p-4 transition-colors hover:bg-secondary/30">
                <p className="font-medium">Security & Audit</p>
                <p className="text-sm text-muted-foreground mt-1">Inspect activity logs and trace changes.</p>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Recent Activity</h2>
              <Link to="/admin/audit" className="text-xs text-primary inline-flex items-center">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </div>
            <div className="space-y-3">
              {recentAudits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent audit events found.</p>
              ) : (
                recentAudits.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
