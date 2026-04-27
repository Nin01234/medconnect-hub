import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { hasRole, type AppRole } from "@/context/authRoles";
import { ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export function RequireRole({ roles: allowed, children }: { roles: AppRole[]; children: ReactNode }) {
  const { user, roles, loading, profile } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasRole(roles, "admin") && profile?.status !== "active") return <Navigate to="/portal" replace />;
  if (!hasRole(roles, ...allowed)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-subtle">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
