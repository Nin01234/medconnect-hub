import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
const HospitalDashboard = lazy(() => import("./pages/hospital/HospitalDashboard"));
const HospitalInbox = lazy(() => import("./pages/hospital/HospitalInbox"));
const AssignedCases = lazy(() => import("./pages/hospital/AssignedCases"));
const FeedbackCenter = lazy(() => import("./pages/hospital/FeedbackCenter"));
const Doctors = lazy(() => import("./pages/hospital/Doctors"));
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
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const App = () => (
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
                <Route path="/terms" element={<Terms />} />
                <Route path="/portal" element={<RequireAuth><PortalRouter /></RequireAuth>} />

                <Route path="/clinic" element={<RequireRole roles={["clinic_user", "admin"]}><ClinicLayout /></RequireRole>}>
                  <Route index element={<ClinicDashboard />} />
                  <Route path="referrals/new" element={<CreateReferral />} />
                  <Route path="referrals" element={<MyReferrals />} />
                  <Route path="referrals/:id" element={<ReferralDetail portal="clinic" />} />
                  <Route path="patients/:patientId" element={<PatientReferralHistory portal="clinic" />} />
                  <Route path="messages" element={<ClinicMessages />} />
                  <Route path="reset-password" element={<PortalResetPassword />} />
                </Route>

                <Route path="/hospital" element={<RequireRole roles={["hospital_admin", "hospital_staff", "admin"]}><HospitalLayout /></RequireRole>}>
                  <Route index element={<HospitalDashboard />} />
                  <Route path="inbox" element={<HospitalInbox />} />
                  <Route path="referrals/:id/review" element={<ReferralDetail portal="hospital" />} />
                  <Route path="patients/:patientId" element={<PatientReferralHistory portal="hospital" />} />
                  <Route path="assigned" element={<AssignedCases />} />
                  <Route path="feedback" element={<FeedbackCenter />} />
                  <Route path="doctors" element={<Doctors />} />
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

export default App;
