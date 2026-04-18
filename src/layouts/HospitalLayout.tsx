import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Inbox, ClipboardList, MessageSquare, LogOut, Activity, Users, Menu, MessageCircleHeart } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { PortalSearch } from "@/components/PortalSearch";

const links = [
  { to: "/hospital", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/hospital/inbox", label: "Referral Inbox", icon: Inbox },
  { to: "/hospital/assigned", label: "Assigned Cases", icon: ClipboardList },
  { to: "/hospital/feedback", label: "Feedback Center", icon: MessageCircleHeart },
  { to: "/hospital/doctors", label: "Doctors", icon: Users },
  { to: "/hospital/messages", label: "Messages", icon: MessageSquare },
];

export default function HospitalLayout() {
  const { profile, signOut, roles } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar — gold accent strip + dense */}
      <div className="h-1 bg-gradient-gold" />
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
            <Link to="/hospital" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display text-base font-semibold leading-none">{BRAND.appShort}</p>
                <p className="text-[10px] uppercase tracking-widest text-accent">Hospital Portal</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <PortalSearch variant="hospital" />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground leading-tight">{roles.includes("hospital_admin") ? "Hospital Admin" : "Hospital Staff"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => nav("/"))} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className={cn("fixed lg:sticky top-[3.5rem] left-0 h-[calc(100vh-3.5rem)] w-60 bg-card border-r p-3 z-20 transition-transform", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
          <nav className="space-y-0.5">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
                  isActive ? "bg-secondary text-primary border-l-4 border-accent" : "text-foreground hover:bg-secondary/60")}>
                <l.icon className="h-4 w-4" /> {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 lg:p-6 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
