import { useAuth, hasRole } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import { FullPageLoader } from "@/components/Guards";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PortalRouter() {
  const { user, roles, loading, profile } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/" replace />;

  if (hasRole(roles, "admin")) return <Navigate to="/admin" replace />;
  if (hasRole(roles, "hospital_admin", "hospital_staff")) {
    if (!profile?.hospital_id) return <NotLinked kind="hospital" />;
    return <Navigate to="/hospital" replace />;
  }
  if (hasRole(roles, "clinic_user")) {
    if (!profile?.clinic_id) return <NotLinked kind="clinic" />;
    return <Navigate to="/clinic" replace />;
  }
  return <NotLinked kind="clinic" />;
}

function NotLinked({ kind }: { kind: "clinic" | "hospital" }) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
      <Card className="max-w-md shadow-elevated">
        <CardContent className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Account pending setup</h1>
          <p className="text-muted-foreground mt-3">
            Your account is not yet linked to a {kind}. Please contact your administrator to complete onboarding.
          </p>
          <Button className="mt-6" variant="outlineBrand" onClick={() => signOut()}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
