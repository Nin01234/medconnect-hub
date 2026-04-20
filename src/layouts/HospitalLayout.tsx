import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Inbox, ClipboardList, MessageSquare, LogOut, Activity, Users, Menu, MessageCircleHeart, PanelLeft, PanelLeftClose, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { BRAND } from "@/lib/brand";
import { PortalSearch } from "@/components/PortalSearch";

const links = [
  { to: "/hospital", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/hospital/inbox", label: "Referral Inbox", icon: Inbox },
  { to: "/hospital/assigned", label: "Assigned Cases", icon: ClipboardList },
  { to: "/hospital/feedback", label: "Feedback Center", icon: MessageCircleHeart },
  { to: "/hospital/doctors", label: "Doctors", icon: Users },
  { to: "/hospital/staff", label: "Staff Accounts", icon: Users },
  { to: "/hospital/messages", label: "Messages", icon: MessageSquare },
  { to: "/hospital/reset-password", label: "Reset password", icon: KeyRound },
];

export default function HospitalLayout() {
  const { profile, signOut, roles } = useAuth();
  const nav = useNavigate();
  const isLg = useMediaQuery("(min-width: 1024px)");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavOpen, setDesktopNavOpen] = useState(true);
  const navVisible = isLg ? desktopNavOpen : mobileOpen;

  useEffect(() => {
    if (isLg) setMobileOpen(false);
  }, [isLg]);

  useEffect(() => {
    document.body.style.overflow = !isLg && mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isLg, mobileOpen]);

  const navLinks = roles.includes("hospital_admin") || roles.includes("admin")
    ? links
    : links.filter((l) => l.to !== "/hospital/staff");

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      {/* Top bar — gold accent strip + dense */}
      <div className="h-1 bg-gradient-gold no-print" />
      <header className="bg-card border-b sticky top-0 z-30 no-print">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14 gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden shrink-0"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="hidden lg:inline-flex shrink-0 rounded-md border border-border bg-background p-2 text-foreground hover:bg-secondary"
              onClick={() => setDesktopNavOpen((o) => !o)}
              aria-expanded={desktopNavOpen}
              aria-label={desktopNavOpen ? "Hide navigation" : "Show navigation"}
            >
              {desktopNavOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </button>
            <Link to="/hospital" className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                <Activity className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display text-base font-semibold leading-none">{BRAND.appShort}</p>
                <p className="text-[10px] uppercase tracking-widest text-accent">Hospital Portal</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <div className="min-w-0 flex-1 sm:flex-initial flex justify-end">
              <PortalSearch variant="hospital" />
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground leading-tight">{roles.includes("hospital_admin") ? "Hospital Admin" : "Hospital Staff"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut().then(() => nav("/"))} aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      {!isLg && mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-background/80 backdrop-blur-sm lg:hidden no-print"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex relative min-w-0">
        <aside
          className={cn(
            "fixed lg:sticky top-[3.75rem] left-0 h-[calc(100dvh-3.75rem)] w-60 max-w-[85vw] bg-card border-r p-3 z-20 transition-transform duration-200 ease-out shadow-lg lg:shadow-none no-print",
            navVisible ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="space-y-0.5">
            {navLinks.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium",
                  isActive ? "bg-secondary text-primary border-l-4 border-accent" : "text-foreground hover:bg-secondary/60")}>
                <l.icon className="h-4 w-4" /> {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-4 lg:p-6 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
