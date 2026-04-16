import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Building2, Hospital, ShieldCheck, ScrollText, LogOut, Crown, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/clinics", label: "Clinics", icon: Building2 },
  { to: "/admin/hospitals", label: "Hospitals", icon: Hospital },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={cn("fixed lg:sticky top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground p-4 z-30 transition-transform flex flex-col", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <Link to="/admin" className="flex items-center gap-2 mb-8 px-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-gold flex items-center justify-center">
            <Crown className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-none">MedReferral</p>
            <p className="text-[10px] uppercase tracking-widest text-sidebar-primary">Admin</p>
          </div>
        </Link>
        <nav className="space-y-1 flex-1">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
              className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent")}>
              <l.icon className="h-4 w-4" /> {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-3 mt-3">
          <p className="text-sm font-medium px-2">{profile?.full_name ?? "—"}</p>
          <p className="text-xs opacity-70 px-2 mb-2 truncate">{profile?.email}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => signOut().then(() => nav("/"))}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-0 flex flex-col min-w-0">
        <header className="lg:hidden bg-card border-b h-14 flex items-center px-4 sticky top-0 z-20">
          <button onClick={() => setOpen(!open)}><Menu className="h-5 w-5" /></button>
          <p className="ml-3 font-display font-semibold">Admin</p>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
