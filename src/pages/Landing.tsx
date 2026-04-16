import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth, hasRole } from "@/context/AuthContext";
import { Activity, Hospital, Users, Zap, ShieldCheck, Stethoscope } from "lucide-react";
import { useEffect } from "react";

export default function Landing() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    // Auto-redirect signed-in users to their portal
    if (user) {
      if (hasRole(roles, "admin")) nav("/admin", { replace: true });
      else if (hasRole(roles, "hospital_admin", "hospital_staff")) nav("/hospital", { replace: true });
      else if (hasRole(roles, "clinic_user")) nav("/clinic", { replace: true });
    }
  }, [user, roles, loading, nav]);

  return (
    <div className="min-h-screen bg-background">
      <header className="container py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gradient-hero flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">MedReferral</span>
        </div>
        <Link to="/auth"><Button variant="outlineBrand" size="sm">Sign in</Button></Link>
      </header>

      <section className="container py-12 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
        <div className="animate-fade-in">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-primary bg-primary/10 px-3 py-1 rounded-full">
            <Activity className="h-3.5 w-3.5" /> Built for African healthcare
          </span>
          <h1 className="font-display text-5xl lg:text-7xl font-bold mt-6 leading-[1.05]">
            Refer patients with <span className="text-primary">clarity.</span><br />
            Treat them with <span className="text-accent">speed.</span>
          </h1>
          <p className="text-lg text-muted-foreground mt-6 max-w-lg">
            MedReferral connects clinics, hospitals and doctors through a structured, real-time referral workflow — from CHPS compounds to teaching hospitals.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/auth"><Button variant="hero" size="lg">Get started</Button></Link>
            <Link to="/auth"><Button variant="outlineBrand" size="lg">I have an account</Button></Link>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-12 max-w-md">
            <Stat n="< 1 min" l="To submit referral" />
            <Stat n="Real-time" l="Status updates" />
            <Stat n="RLS" l="Secure by design" />
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-hero opacity-20 blur-3xl rounded-full" />
          <div className="relative grid grid-cols-2 gap-4">
            <Feature icon={Hospital} title="Hospital Inbox" desc="Triaged, filterable, real-time." accent="primary" />
            <Feature icon={Stethoscope} title="Clinic Portal" desc="Structured referrals in a guided form." accent="gold" />
            <Feature icon={Users} title="Doctor Assignment" desc="Inside the Hospital Portal." accent="primary" />
            <Feature icon={ShieldCheck} title="RBAC + RLS" desc="Each user only sees their data." accent="gold" />
          </div>
        </div>
      </section>

      <section className="bg-gradient-subtle border-y">
        <div className="container py-16 grid md:grid-cols-3 gap-6">
          <Step n="01" title="Clinic creates referral" desc="Patient & clinical data, urgency, attachments — saved as structured records." />
          <Step n="02" title="Hospital reviews & assigns" desc="Inbox triage, accept/reject/assign to a doctor, request more info." />
          <Step n="03" title="Clinic tracks progress" desc="Live status, feedback, messages and a printable referral document." />
        </div>
      </section>

      <footer className="container py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MedReferral · Built with Lovable Cloud
      </footer>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-primary">{n}</p>
      <p className="text-xs text-muted-foreground mt-1">{l}</p>
    </div>
  );
}

function Feature({ icon: Icon, title, desc, accent }: { icon: typeof Activity; title: string; desc: string; accent: "primary" | "gold" }) {
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card hover:shadow-elevated transition-shadow">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent === "gold" ? "bg-gradient-gold" : "bg-gradient-hero"}`}>
        <Icon className={`h-5 w-5 ${accent === "gold" ? "text-accent-foreground" : "text-primary-foreground"}`} />
      </div>
      <p className="font-semibold mt-3">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="bg-card rounded-2xl p-6 border shadow-card">
      <p className="font-display text-5xl font-bold text-primary/20">{n}</p>
      <p className="font-semibold mt-2 text-lg">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
