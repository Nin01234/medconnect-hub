import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Building2, Hospital, ShieldCheck, ScrollText, LogOut, Crown, Menu, UserCheck, PanelLeft, PanelLeftClose } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { BRAND } from "@/lib/brand";
import { PortalSearch } from "@/components/PortalSearch";

const links = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/approvals", label: "Pending Approvals", icon: UserCheck },
  { to: "/admin/hospitals", label: "Hospitals", icon: Hospital },
  { to: "/admin/roles", label: "Roles", icon: ShieldCheck },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
];

export default function AdminLayout() {
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
    <div className="min-h-screen min-h-[100dvh] bg-background flex relative min-w-0">
      {!isLg && mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm lg:hidden no-print"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      {isLg && !desktopNavOpen ? (
        <button
          type="button"
          className="fixed left-0 top-1/2 z-[35] -translate-y-1/2 rounded-r-lg border border-sidebar-border border-l-0 bg-sidebar p-2.5 text-sidebar-foreground shadow-md hover:bg-sidebar-accent no-print"
          onClick={() => setDesktopNavOpen(true)}
          aria-label="Open navigation"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      ) : null}

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-[100dvh] min-h-0 w-64 max-w-[min(100vw,16rem)] bg-sidebar text-sidebar-foreground p-4 z-30 transition-transform duration-200 ease-out flex flex-col shadow-xl lg:shadow-none no-print",
          navVisible ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-8 px-2">
          <Link to="/admin" className="flex items-center gap-2 min-w-0" onClick={() => setMobileOpen(false)}>
            <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-gold flex items-center justify-center">
              <Crown className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-none truncate">{BRAND.appShort}</p>
              <p className="text-[10px] uppercase tracking-widest text-sidebar-primary">Admin</p>
            </div>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setDesktopNavOpen(false)}
            aria-label="Hide navigation"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-3 px-0">
          <PortalSearch variant="admin" />
        </div>
        <nav className="space-y-1 flex-1 min-h-0 overflow-y-auto">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMobileOpen(false)}
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
        <header className="lg:hidden bg-card border-b h-14 flex items-center px-4 sticky top-0 z-20 gap-2 min-w-0 no-print">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="ml-1 font-display font-semibold flex-1">Admin</p>
          <PortalSearch variant="admin" compact />
        </header>
        <main className="flex-1 min-w-0 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
