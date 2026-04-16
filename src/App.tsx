import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth, RequireRole } from "@/components/Guards";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import PortalRouter from "./pages/PortalRouter";
import ClinicLayout from "./layouts/ClinicLayout";
import HospitalLayout from "./layouts/HospitalLayout";
import AdminLayout from "./layouts/AdminLayout";
import ClinicDashboard from "./pages/clinic/ClinicDashboard";
import CreateReferral from "./pages/clinic/CreateReferral";
import MyReferrals from "./pages/clinic/MyReferrals";
import ClinicMessages from "./pages/clinic/ClinicMessages";
import HospitalDashboard from "./pages/hospital/HospitalDashboard";
import HospitalInbox from "./pages/hospital/HospitalInbox";
import AssignedCases from "./pages/hospital/AssignedCases";
import FeedbackCenter from "./pages/hospital/FeedbackCenter";
import Doctors from "./pages/hospital/Doctors";
import HospitalMessages from "./pages/hospital/HospitalMessages";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UsersPage from "./pages/admin/UsersPage";
import ClinicsPage from "./pages/admin/ClinicsPage";
import HospitalsPage from "./pages/admin/HospitalsPage";
import RolesPage from "./pages/admin/RolesPage";
import AuditPage from "./pages/admin/AuditPage";
import ReferralDetail from "./pages/ReferralDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/portal" element={<RequireAuth><PortalRouter /></RequireAuth>} />

            <Route path="/clinic" element={<RequireRole roles={["clinic_user","admin"]}><ClinicLayout /></RequireRole>}>
              <Route index element={<ClinicDashboard />} />
              <Route path="referrals/new" element={<CreateReferral />} />
              <Route path="referrals" element={<MyReferrals />} />
              <Route path="referrals/:id" element={<ReferralDetail portal="clinic" />} />
              <Route path="messages" element={<ClinicMessages />} />
            </Route>

            <Route path="/hospital" element={<RequireRole roles={["hospital_admin","hospital_staff","admin"]}><HospitalLayout /></RequireRole>}>
              <Route index element={<HospitalDashboard />} />
              <Route path="inbox" element={<HospitalInbox />} />
              <Route path="referrals/:id/review" element={<ReferralDetail portal="hospital" />} />
              <Route path="assigned" element={<AssignedCases />} />
              <Route path="feedback" element={<FeedbackCenter />} />
              <Route path="doctors" element={<Doctors />} />
              <Route path="messages" element={<HospitalMessages />} />
            </Route>

            <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminLayout /></RequireRole>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="clinics" element={<ClinicsPage />} />
              <Route path="hospitals" element={<HospitalsPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="audit" element={<AuditPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
