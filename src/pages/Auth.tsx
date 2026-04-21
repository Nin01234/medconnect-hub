import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { authSignInSchema, authSignUpSchema, LIMITS } from "@/lib/validation";
import { sanitizeText } from "@/lib/sanitize";
import { safeClientError } from "@/lib/safeError";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("Clinic");
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user) nav("/portal", { replace: true });
  }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = authSignUpSchema.safeParse({
          email,
          username,
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
              username: sanitizeText(v.username, LIMITS.username).toLowerCase(),
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
        return;
      } else {
        const parsed = authSignInSchema.safeParse({ identifier, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
          return;
        }
        let emailForLogin = parsed.data.identifier;
        if (!emailForLogin.includes("@")) {
          const { data, error } = await supabase.rpc("resolve_login_identifier", {
            p_identifier: emailForLogin,
          });
          if (error || !data) throw new Error("Invalid login credentials");
          emailForLogin = data;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: emailForLogin,
          password: parsed.data.password,
        });
        if (error) throw new Error("Invalid login credentials");
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
    <div className="min-h-screen bg-gradient-subtle">
      <div className="flex min-h-screen items-center justify-center p-6">
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
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="e.g. nino_admin"
                      />
                    </div>
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
              {mode === "signin" ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label htmlFor="identifier">Email or username</Label>
                    <Input
                      id="identifier"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or username"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="pw">Password</Label>
                    <PasswordInput id="pw" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pw">Password</Label>
                    <PasswordInput id="pw" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
