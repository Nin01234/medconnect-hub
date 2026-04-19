import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck, Stethoscope } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { useRotatingIndex } from "@/hooks/useRotatingIndex";
import { AUTH_BULLET_ROTATIONS, HERO_ROTATIONS, SUBTEXT_ROTATIONS } from "@/lib/marketingRotations";
import { MarketingHeroHeading } from "@/components/MarketingHero";
import { authSignInSchema, authSignUpSchema, LIMITS } from "@/lib/validation";
import { sanitizeText } from "@/lib/sanitize";
import { safeClientError } from "@/lib/safeError";

const ROTATE_MS = 9000;

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("Clinic");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();
  const rotationIndex = useRotatingIndex(HERO_ROTATIONS.length, ROTATE_MS);
  const hero = HERO_ROTATIONS[rotationIndex];
  const sub = SUBTEXT_ROTATIONS[rotationIndex % SUBTEXT_ROTATIONS.length];
  const [bulletA, bulletB] = AUTH_BULLET_ROTATIONS[rotationIndex % AUTH_BULLET_ROTATIONS.length];

  useEffect(() => {
    if (user) nav("/portal", { replace: true });
  }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !acceptedTerms) {
      toast.error("Please accept the Terms & Conditions to continue.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = authSignUpSchema.safeParse({
          email,
          password,
          fullName,
          phone,
          orgName,
          orgType,
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
          return;
        }
        const v = parsed.data;
        const { data, error } = await supabase.auth.signUp({
          email: v.email,
          password: v.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: sanitizeText(v.fullName, LIMITS.name),
              phone: v.phone ? sanitizeText(v.phone, LIMITS.phone) : undefined,
              org_name: sanitizeText(v.orgName, LIMITS.name),
              org_type: sanitizeText(v.orgType, LIMITS.orgType),
              signup_source: "self",
            },
          },
        });
        if (error) throw error;
        if (data.user?.id) {
          await supabase.from("profiles").update({ status: "pending_approval" }).eq("id", data.user.id);
        }
        await supabase.auth.signOut();
        toast.success("Signup submitted. An admin must approve your account before login.");
        setMode("signin");
        setPassword("");
        setAcceptedTerms(false);
        return;
      } else {
        const parsed = authSignInSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("status").maybeSingle(),
          supabase.from("user_roles").select("role"),
        ]);
        const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
        if (!isAdmin && profile?.status !== "active") {
          await supabase.auth.signOut();
          const status = profile?.status;
          if (status === "pending_approval") throw new Error("Your account is pending admin approval.");
          if (status === "suspended") throw new Error("Your account has been deactivated. Please contact an admin.");
          if (status === "rejected") throw new Error("Your account request was rejected. Please contact an admin.");
          throw new Error("Your account is not active. Please contact an admin.");
        }
        toast.success("Welcome back");
      }
      nav("/portal", { replace: true });
    } catch (err) {
      toast.error(safeClientError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-5">
      <div className="hidden lg:flex lg:col-span-2 bg-gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="flex items-start gap-2">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-accent flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <span className="font-display text-xl font-bold leading-tight block">{BRAND.appShort}</span>
            <span className="text-xs opacity-90 leading-tight block">{BRAND.institution}</span>
          </div>
        </Link>
        <div key={rotationIndex} className="animate-fade-in">
          <MarketingHeroHeading rotation={hero} className="font-display text-4xl xl:text-5xl font-bold leading-tight" />
          <p className="mt-4 opacity-90 max-w-md">{sub}</p>
          <div className="mt-8 space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" /> {bulletA}
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" /> {bulletB}
            </p>
          </div>
        </div>
        <div className="text-sm opacity-80 space-y-2">
          <p>Secure authentication and database-enforced access controls.</p>
          <p>
            <Link to="/terms" className="underline underline-offset-4 hover:opacity-100">
              Terms &amp; Conditions
            </Link>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:col-span-3 bg-gradient-subtle">
        <Card className="w-full max-w-xl shadow-elevated">
          <CardContent className="p-8">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted mb-6">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === "signin" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === "signup" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </div>

            <h2 className="font-display text-3xl font-bold">{mode === "signin" ? "Welcome back" : "Create account request"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Use your credentials to access your portal." : "Your request will be reviewed by admin before your first login."}
            </p>
            <form onSubmit={submit} className="space-y-4 mt-6">
              {mode === "signup" && (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="org-name">Organization name</Label>
                      <Input id="org-name" required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="org-type">Organization type</Label>
                      <Input id="org-type" value={orgType} onChange={(e) => setOrgType(e.target.value)} placeholder="Clinic, Hospital, CHPS..." />
                    </div>
                  </div>
                </>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className={mode === "signin" ? "sm:col-span-2" : ""}>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className={mode === "signin" ? "sm:col-span-2" : ""}>
                  <Label htmlFor="pw">Password</Label>
                  <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              {mode === "signup" && (
                <div className="flex items-start gap-3 rounded-md border border-dashed p-3">
                  <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(v === true)} className="mt-0.5" />
                  <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer">
                      Terms &amp; Conditions
                    </Link>{" "}
                    of {BRAND.institution}&apos;s referral platform.
                  </Label>
                </div>
              )}
              <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy}>
                {busy ? "Please wait..." : mode === "signin" ? "Sign in to portal" : "Submit signup request"}
              </Button>
            </form>
            {mode === "signin" && (
              <p className="text-xs mt-5 rounded-md border border-dashed p-3 text-muted-foreground">
                If you signed up recently and cannot login yet, your account may still be awaiting admin approval.
              </p>
            )}
            <p className="text-xs text-center text-muted-foreground mt-6 lg:hidden">
              <Link to="/terms" className="underline underline-offset-4">
                Terms &amp; Conditions
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
