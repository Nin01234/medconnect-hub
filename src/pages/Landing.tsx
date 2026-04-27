import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { Activity, Stethoscope } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect } from "react";
import { BRAND } from "@/lib/brand";
import { useRotatingIndex } from "@/hooks/useRotatingIndex";
import {
  BADGE_ROTATIONS,
  FEATURE_SLIDES,
  HERO_ROTATIONS,
  STAT_ROTATIONS,
  SUBTEXT_ROTATIONS,
} from "@/lib/marketingRotations";
import { MarketingHeroHeading } from "@/components/MarketingHero";
import { warmAuthAndPortalBundles } from "@/lib/routeWarmup";

const ROTATE_MS = 9000;

export default function Landing() {
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();
  const rotationIndex = useRotatingIndex(HERO_ROTATIONS.length, ROTATE_MS);
  const hero = HERO_ROTATIONS[rotationIndex];
  const sub = SUBTEXT_ROTATIONS[rotationIndex % SUBTEXT_ROTATIONS.length];
  const stats = STAT_ROTATIONS[rotationIndex % STAT_ROTATIONS.length];
  const features = FEATURE_SLIDES[rotationIndex % FEATURE_SLIDES.length];
  const badge = BADGE_ROTATIONS[rotationIndex % BADGE_ROTATIONS.length];

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (hasRole(roles, "admin")) nav("/admin", { replace: true });
      else if (hasRole(roles, "hospital_admin", "hospital_staff")) nav("/hospital", { replace: true });
      else if (hasRole(roles, "clinic_user", "clinic_admin", "clinic_staff")) nav("/clinic", { replace: true });
    }
  }, [user, roles, loading, nav]);

  return (
    <div className="min-h-screen bg-background">
      <header className="container py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-hero flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <span className="font-display text-lg sm:text-xl font-bold leading-tight block truncate">{BRAND.appShort}</span>
            <span className="text-[11px] sm:text-xs text-muted-foreground leading-tight block truncate">{BRAND.institution}</span>
          </div>
        </div>
        <Link to="/auth" className="shrink-0">
          <Button variant="outlineBrand" size="sm">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="container py-12 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
        <div className="animate-fade-in">
          <span
            key={badge}
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-primary bg-primary/10 px-3 py-1 rounded-full max-w-full"
          >
            <Activity className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{badge}</span>
          </span>
          <div key={rotationIndex} className="animate-fade-in">
            <MarketingHeroHeading rotation={hero} />
            <p className="text-lg text-muted-foreground mt-6 max-w-lg">{sub}</p>
          </div>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to="/auth"
              onMouseEnter={warmAuthAndPortalBundles}
              onFocus={warmAuthAndPortalBundles}
              onTouchStart={warmAuthAndPortalBundles}
            >
              <Button variant="hero" size="lg">
                Get started
              </Button>
            </Link>
            <Link
              to="/auth"
              onMouseEnter={warmAuthAndPortalBundles}
              onFocus={warmAuthAndPortalBundles}
              onTouchStart={warmAuthAndPortalBundles}
            >
              <Button variant="outlineBrand" size="lg">
                I have an account
              </Button>
            </Link>
          </div>
          <div key={`${rotationIndex}-stats`} className="grid grid-cols-3 gap-4 mt-12 max-w-md animate-fade-in">
            {stats.map((s) => (
              <Stat key={s.l} n={s.n} l={s.l} />
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-hero opacity-20 blur-3xl rounded-full" />
          <div key={rotationIndex} className="relative grid grid-cols-2 gap-4 animate-fade-in">
            {features.map((f) => (
              <Feature key={`${f.title}-${rotationIndex}`} icon={f.icon} title={f.title} desc={f.desc} accent={f.accent} />
            ))}
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

      <footer className="container py-10 text-center text-sm text-muted-foreground space-y-2">
        <p>
          © {new Date().getFullYear()} {BRAND.institution}
        </p>
        <p>
          <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms &amp; Conditions
          </Link>
        </p>
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

function Feature({ icon: Icon, title, desc, accent }: { icon: LucideIcon; title: string; desc: string; accent: "primary" | "gold" }) {
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
