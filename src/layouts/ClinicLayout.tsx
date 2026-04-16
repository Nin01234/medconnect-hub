import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FilePlus2, ListChecks, MessageSquare, LogOut, Stethoscope, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/clinic", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clinic/referrals/new", label: "Create Referral", icon: FilePlus2 },
  { to: "/clinic/referrals", label: "My Referrals", icon: ListChecks },
  { to: "/clinic/messages", label: "Messages", icon: MessageSquare },
];

export default function ClinicLayout() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Top bar */}
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
            <Link to="/clinic" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-hero flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold leading-none">MedReferral</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Clinic Portal</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground leading-tight">Clinic user</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => nav("/"))} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn("fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-card border-r p-4 z-20 transition-transform", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
          <nav className="space-y-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-primary text-primary-foreground shadow-card" : "text-foreground hover:bg-secondary")}>
                <l.icon className="h-4 w-4" /> {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 p-3 rounded-lg bg-gradient-hero text-primary-foreground">
            <p className="text-xs font-semibold mb-1">Need to refer a patient?</p>
            <p className="text-xs opacity-90 mb-3">Create a structured referral in seconds.</p>
            <Button size="sm" variant="gold" className="w-full" onClick={() => nav("/clinic/referrals/new")}>New Referral</Button>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
