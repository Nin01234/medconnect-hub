import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { FullPageLoader, RequireAuth, RequireRole } from "@/components/Guards";
import { ThemeToggle } from "@/components/ThemeToggle";

const NotFound = lazy(() => import("./pages/NotFound"));
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Terms = lazy(() => import("./pages/Terms"));
const PortalRouter = lazy(() => import("./pages/PortalRouter"));
const ClinicLayout = lazy(() => import("./layouts/ClinicLayout"));
const HospitalLayout = lazy(() => import("./layouts/HospitalLayout"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const PortalResetPassword = lazy(() => import("./pages/portal/ResetPasswordPage"));
const ClinicDashboard = lazy(() => import("./pages/clinic/ClinicDashboard"));
const CreateReferral = lazy(() => import("./pages/clinic/CreateReferral"));
const MyReferrals = lazy(() => import("./pages/clinic/MyReferrals"));
const ClinicMessages = lazy(() => import("./pages/clinic/ClinicMessages"));
const ClinicStaffManagement = lazy(() => import("./pages/clinic/ClinicStaffManagement"));
const HospitalDashboard = lazy(() => import("./pages/hospital/HospitalDashboard"));
const HospitalInbox = lazy(() => import("./pages/hospital/HospitalInbox"));
const AssignedCases = lazy(() => import("./pages/hospital/AssignedCases"));
const DoctorDashboard = lazy(() => import("./pages/hospital/DoctorDashboard"));
const FeedbackCenter = lazy(() => import("./pages/hospital/FeedbackCenter"));
const Departments = lazy(() => import("./pages/hospital/Departments"));
const StaffManagement = lazy(() => import("./pages/hospital/StaffManagement"));
const HospitalMessages = lazy(() => import("./pages/hospital/HospitalMessages"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UsersPage = lazy(() => import("./pages/admin/UsersPage"));
const ClinicsPage = lazy(() => import("./pages/admin/ClinicsPage"));
const HospitalsPage = lazy(() => import("./pages/admin/HospitalsPage"));
const RolesPage = lazy(() => import("./pages/admin/RolesPage"));
const AuditPage = lazy(() => import("./pages/admin/AuditPage"));
const PendingApprovalsPage = lazy(() => import("./pages/admin/PendingApprovalsPage"));
const ReferralDetail = lazy(() => import("./pages/ReferralDetail"));
const PatientReferralHistory = lazy(() => import("./pages/PatientReferralHistory"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Lists feel instant when navigating back; realtime invalidation still refreshes when needed. */
      staleTime: 90_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        const msg = error instanceof Error ? error.message.toLowerCase() : "";
        if (msg.includes("invalid login") || msg.includes("unauthorized") || msg.includes("forbidden")) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Toaster />
          <Sonner />
          <ThemeToggle />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
              <Suspense fallback={<FullPageLoader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Navigate to="/auth" replace />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/portal" element={<RequireAuth><PortalRouter /></RequireAuth>} />

                  <Route path="/clinic" element={<RequireRole roles={["clinic_user", "clinic_admin", "clinic_staff", "admin"]}><ClinicLayout /></RequireRole>}>
                    <Route index element={<ClinicDashboard />} />
                    <Route path="referrals/new" element={<CreateReferral />} />
                    <Route path="referrals" element={<MyReferrals />} />
                    <Route path="referrals/:id" element={<ReferralDetail portal="clinic" />} />
                    <Route path="patients/:patientId" element={<PatientReferralHistory portal="clinic" />} />
                    <Route path="messages" element={<ClinicMessages />} />
                    <Route path="staff" element={<RequireRole roles={["clinic_admin", "admin"]}><ClinicStaffManagement /></RequireRole>} />
                    <Route path="reset-password" element={<PortalResetPassword />} />
                  </Route>

                  <Route path="/hospital" element={<RequireRole roles={["hospital_admin", "hospital_staff", "doctor", "admin"]}><HospitalLayout /></RequireRole>}>
                    <Route index element={<HospitalDashboard />} />
                    <Route path="doctor" element={<DoctorDashboard />} />
                    <Route path="inbox" element={<HospitalInbox />} />
                    <Route path="referrals/:id/review" element={<ReferralDetail portal="hospital" />} />
                    <Route path="referrals/new" element={<CreateReferral />} />
                    <Route path="referrals" element={<MyReferrals />} />
                    <Route path="patients/:patientId" element={<PatientReferralHistory portal="hospital" />} />
                    <Route path="assigned" element={<AssignedCases />} />
                    <Route path="feedback" element={<FeedbackCenter />} />
                    <Route path="departments" element={<RequireRole roles={["hospital_admin", "admin"]}><Departments /></RequireRole>} />
                    <Route path="staff" element={<StaffManagement />} />
                    <Route path="messages" element={<HospitalMessages />} />
                    <Route path="reset-password" element={<PortalResetPassword />} />
                  </Route>

                  <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminLayout /></RequireRole>}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="approvals" element={<PendingApprovalsPage />} />
                    <Route path="clinics" element={<ClinicsPage />} />
                    <Route path="hospitals" element={<HospitalsPage />} />
                    <Route path="roles" element={<RolesPage />} />
                    <Route path="audit" element={<AuditPage />} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
