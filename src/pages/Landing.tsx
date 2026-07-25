import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { Activity, Stethoscope, ArrowRight, ShieldCheck, Zap, Users, CheckCircle2, Clock, FileText, HeartPulse, Sparkles, Building2 } from "lucide-react";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { warmAuthAndPortalBundles } from "@/lib/routeWarmup";

export default function Landing() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (hasRole(roles, "admin")) nav("/admin", { replace: true });
      else if (hasRole(roles, "hospital_admin", "hospital_staff")) nav("/hospital", { replace: true });
      else if (hasRole(roles, "clinic_user", "clinic_admin", "clinic_staff")) nav("/clinic", { replace: true });
    }
  }, [user, roles, loading, nav]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 font-sans relative overflow-x-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-teal-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/70 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent block">
                {BRAND.appShort}
              </span>
              <span className="text-[11px] text-slate-400 tracking-wider uppercase block font-medium">
                {BRAND.institution}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              onMouseEnter={warmAuthAndPortalBundles}
              onFocus={warmAuthAndPortalBundles}
              onTouchStart={warmAuthAndPortalBundles}
            >
              <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium">
                Sign in
              </Button>
            </Link>
            <Link
              to="/auth"
              onMouseEnter={warmAuthAndPortalBundles}
              onFocus={warmAuthAndPortalBundles}
              onTouchStart={warmAuthAndPortalBundles}
            >
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/25 border-0">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>

            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="h-3.5 w-3.5" /> Next-Gen Health Referral Ecosystem
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] font-display">
              Refer Patients With <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-400 bg-clip-text text-transparent">Clarity</span>. <br />
              Treat Them With <span className="bg-gradient-to-r from-teal-400 via-emerald-300 to-green-300 bg-clip-text text-transparent">Speed</span>.
            </h1>

            <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal">
              Manage referrals, track hospital responses in real time, assign specialists, and keep multi-department teams aligned in one unified, highly secure platform.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to="/auth"
                className="w-full sm:w-auto"
                onMouseEnter={warmAuthAndPortalBundles}
                onFocus={warmAuthAndPortalBundles}
                onTouchStart={warmAuthAndPortalBundles}
              >
                <Button size="lg" className="w-full sm:w-auto h-13 px-8 text-base bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold shadow-xl shadow-emerald-500/20 rounded-xl">
                  Get Started Free
                </Button>
              </Link>
              <Link
                to="/auth"
                className="w-full sm:w-auto"
                onMouseEnter={warmAuthAndPortalBundles}
                onFocus={warmAuthAndPortalBundles}
                onTouchStart={warmAuthAndPortalBundles}
              >
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-13 px-8 text-base border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl">
                  I have an account
                </Button>
              </Link>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-slate-800/80">
              <div className="text-left">
                <div className="text-xl font-bold text-emerald-400 font-mono">&lt; 1 min</div>
                <div className="text-xs text-slate-400 font-medium">To submit referral</div>
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-emerald-400 font-mono">Real-time</div>
                <div className="text-xs text-slate-400 font-medium">Status updates</div>
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-indigo-400 font-mono">RLS</div>
                <div className="text-xs text-slate-400 font-medium">Secure by design</div>
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-amber-400 font-mono">100%</div>
                <div className="text-xs text-slate-400 font-medium">Audit coverage</div>
              </div>
            </div>
          </div>

          {/* Right Hero Image & Visual Showcase */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900/80 shadow-2xl shadow-emerald-950/50 group">
              {/* Generated Image Showcase */}
              <img
                src="/hero-medical.jpg"
                alt="Modern Hospital Digital Command Center"
                className="w-full h-[440px] object-cover object-center transform transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

              {/* Floating Overlay Badge 1 */}
              <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-3 rounded-xl shadow-lg flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-200">Live Hospital Sync Active</span>
              </div>

              {/* Floating Overlay Badge 2 */}
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 p-4 rounded-xl shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">Emergency Triage Stream</div>
                    <div className="text-xs text-slate-400">Automated Patient Routing</div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/30">
                  99.9% Uptime
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modern Features Grid */}
      <section className="py-20 bg-slate-900/60 border-y border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs uppercase font-bold tracking-widest text-emerald-400">Built for Hospital & Clinic Workflows</h2>
            <p className="text-3xl sm:text-4xl font-bold font-display text-slate-100">
              Complete End-to-End Care Coordination
            </p>
            <p className="text-slate-400 text-base">
              Eliminate paper friction, phone call delays, and untracked cases with specialized modules for admins, hospitals, and departments.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-7 hover:border-emerald-500/50 transition duration-300 shadow-lg relative group">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:bg-emerald-500 group-hover:text-slate-950 transition duration-300">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Hospital Triage Inbox</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Triaged, filterable, real-time incoming referrals queue. Hospital admins assign cases directly to specialized departments and attending doctors.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Real-time triage updates</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Multi-department routing</li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-7 hover:border-teal-500/50 transition duration-300 shadow-lg relative group">
              <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6 group-hover:bg-teal-500 group-hover:text-slate-950 transition duration-300">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Clinic & Department Portal</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Structured guided referral submission forms with vitals, diagnostic notes, urgency levels, and direct document attachment uploads.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-400" /> Automatic deduplication</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-400" /> Department staff management</li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-7 hover:border-green-500/50 transition duration-300 shadow-lg relative group">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-6 group-hover:bg-green-500 group-hover:text-slate-950 transition duration-300">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-3">Enterprise Audit & Security</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Row-Level Security (RLS) guarantees data is scoped strictly to authorized organizations. Timestamped history timelines cover every action.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400" /> Full timeline audit logs</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-400" /> Role-gated portal security</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Step-by-Step */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs uppercase font-bold tracking-widest text-emerald-400 mb-2">3 Simple Steps</h2>
          <p className="text-3xl font-bold font-display text-slate-100">How MedConnect Hub Works</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 relative">
            <span className="text-5xl font-extrabold font-mono text-emerald-500/20 block mb-2">01</span>

            <h4 className="text-lg font-bold text-slate-100 mb-2">Clinic Creates Referral</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Patient details, symptoms, vitals, urgency, and medical documents are entered into a structured, validated record.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 relative">
            <span className="text-5xl font-extrabold font-mono text-cyan-500/20 block mb-2">02</span>
            <h4 className="text-lg font-bold text-slate-100 mb-2">Hospital Reviews & Assigns</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Hospital triage staff review the incoming case live, accept or request info, and route it to department specialists.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 relative">
            <span className="text-5xl font-extrabold font-mono text-cyan-500/20 block mb-2">03</span>
            <h4 className="text-lg font-bold text-slate-100 mb-2">Real-Time Tracking & Outcome</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              Sending departments monitor status changes live, exchange feedback notes, and print finalized medical reports.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div>
            © {new Date().getFullYear()} {BRAND.institution} — {BRAND.appName}. All rights reserved.
          </div>
          <div>
            <Link to="/terms" className="hover:text-emerald-400 transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
