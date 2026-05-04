import { useAuth } from "@/context/AuthContext";
import { hasRole, type AppRole } from "@/context/authRoles";
import { Navigate } from "react-router-dom";
import { FullPageLoader } from "@/components/Guards";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useDepartmentRow } from "@/hooks/useDepartmentRow";

export default function PortalRouter() {
  const { user, roles, loading, profile } = useAuth();
  const isHospitalStaff = hasRole(roles, "hospital_staff");
  const normalizedStatus = (profile?.status ?? "active").toLowerCase().trim();
  const isBlockedStatus =
    normalizedStatus === "pending_approval" ||
    normalizedStatus === "suspended" ||
    normalizedStatus === "rejected";
  const { data: deptRow, isLoading: departmentLoading } = useDepartmentRow(
    profile?.department_id,
    !!user && isHospitalStaff && !!profile?.department_id,
  );
  const departmentStatus = deptRow?.status ?? "active";
  if (loading) return <FullPageLoader />;
  if (departmentLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!hasRole(roles, "admin") && isBlockedStatus) return <AccountStatus status={normalizedStatus} />;
  if (isHospitalStaff && profile?.department_id && departmentStatus !== "active") {
    return <AccountStatus status="department_inactive" />;
  }

  if (hasRole(roles, "admin")) return <Navigate to="/admin" replace />;
  if (hasRole(roles, "hospital_admin", "hospital_staff")) {
    if (!profile?.hospital_id) return <NotLinked role="hospital_staff" />;
    return <Navigate to="/hospital" replace />;
  }
  if (hasRole(roles, "clinic_user", "clinic_admin", "clinic_staff")) {
    if (!profile?.clinic_id) return <NotLinked role="clinic_user" />;
    return <Navigate to="/clinic" replace />;
  }
  return <NotLinked role={roles[0] as AppRole | undefined} />;
}

function AccountStatus({ status }: { status?: string }) {
  const { signOut } = useAuth();
  const title =
    status === "pending_approval"
      ? "Approval required"
      : status === "suspended"
        ? "Account deactivated"
        : status === "rejected"
          ? "Account rejected"
          : status === "department_inactive"
            ? "Department inactive"
            : "Account inactive";
  const message =
    status === "pending_approval"
      ? "Your account request is awaiting admin approval. You will be able to login after an administrator activates your account."
      : status === "suspended"
        ? "Your account has been deactivated by an administrator. Please contact an admin to reactivate your account."
        : status === "rejected"
          ? "Your account request was rejected. Please contact an admin if you believe this is a mistake."
        : status === "department_inactive"
          ? "Your department is currently deactivated by a hospital admin, so staff access is temporarily blocked."
          : "Your account is not active. Please contact an administrator.";
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
      <Card className="max-w-md shadow-elevated">
        <CardContent className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-3">{message}</p>
          <Button className="mt-6" variant="outlineBrand" onClick={() => signOut()}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NotLinked({ role }: { role?: AppRole }) {
  const { signOut, refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  const roleLabel =
    role === "clinic_user" || role === "clinic_staff"
      ? "Clinic User"
      : role === "clinic_admin"
        ? "Clinic Admin"
      : role === "hospital_admin"
        ? "Hospital Admin"
        : role === "hospital_staff"
          ? "Hospital Staff"
          : role === "admin"
            ? "Admin"
            : "your role";

  const retry = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-subtle">
      <Card className="max-w-md shadow-elevated">
        <CardContent className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Account pending setup</h1>
          <p className="text-muted-foreground mt-3">
            Your account role is set to {roleLabel}, but your organization link is not configured yet. Ask an admin to assign the correct clinic or hospital.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="hero" onClick={retry} disabled={checking}>
              {checking ? "Checking..." : "I've been linked - check again"}
            </Button>
            <Button variant="outlineBrand" onClick={() => signOut()}>Sign out</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
