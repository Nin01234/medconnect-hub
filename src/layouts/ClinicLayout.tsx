import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FilePlus2, ListChecks, MessageSquare, LogOut, Stethoscope, Menu, PanelLeft, PanelLeftClose, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { BRAND } from "@/lib/brand";
import { PortalSearch } from "@/components/PortalSearch";

const links = [
  { to: "/clinic", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clinic/referrals/new", label: "Create Referral", icon: FilePlus2, end: true },
  { to: "/clinic/referrals", label: "My Referrals", icon: ListChecks, end: true },
  { to: "/clinic/messages", label: "Messages & feedback", icon: MessageSquare },
  { to: "/clinic/reset-password", label: "Reset password", icon: KeyRound },
];

export default function ClinicLayout() {
  const { profile, signOut } = useAuth();
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

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-subtle">
      {/* Top bar */}
      <header className="bg-card border-b sticky top-0 z-30 no-print">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16 gap-2 min-w-0">
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
            <Link to="/clinic" className="flex items-center gap-2 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-gradient-hero flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold leading-none">{BRAND.appShort}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Clinic Portal</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <div className="min-w-0 flex-1 sm:flex-initial flex justify-end">
              <PortalSearch variant="clinic" />
            </div>
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

      {!isLg && mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-background/80 backdrop-blur-sm lg:hidden no-print"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex relative min-w-0">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky top-16 left-0 h-[calc(100dvh-4rem)] w-64 max-w-[85vw] bg-card border-r p-4 z-20 transition-transform duration-200 ease-out shadow-lg lg:shadow-none no-print",
            navVisible ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <nav className="space-y-1">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMobileOpen(false)}
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

        <main className="flex-1 min-w-0 p-4 lg:p-8 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
