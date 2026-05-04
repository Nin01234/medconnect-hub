import { useEffect, useState } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { authSignInSchema, LIMITS } from "@/lib/validation";
import { safeClientError } from "@/lib/safeError";
import { sanitizeLoginIdentifier } from "@/lib/sanitize";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Auth() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const runGuarded = useSubmitGuard();
  const [showPassword, setShowPassword] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (user) nav("/portal", { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (!password) setShowPassword(false);
  }, [password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runGuarded(async () => {
      setBusy(true);
      try {
        const normalizedIdentifier = sanitizeLoginIdentifier(identifier, LIMITS.email);
        const parsed = authSignInSchema.safeParse({ identifier: normalizedIdentifier, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your input.");
          return;
        }
        let emailForLogin = parsed.data.identifier;
        if (!emailForLogin.includes("@")) {
          const { data, error } = await supabase.functions.invoke("resolve-login-identifier", {
            body: { identifier: emailForLogin },
          });
          const resolved = (data as { email?: string | null } | null)?.email ?? null;
          if (error || !resolved) throw new Error("Invalid login credentials");
          emailForLogin = resolved;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: emailForLogin,
          password: parsed.data.password,
        });
        if (error) throw new Error("Invalid login credentials");
        toast.success("Welcome back");
        nav("/portal", { replace: true });
      } catch (err) {
        toast.error(safeClientError(err));
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-xl shadow-elevated">
          <CardContent className="p-8">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-1">Use your credentials to access your portal.</p>
            <form onSubmit={submit} className="space-y-4 mt-6">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="identifier">Email or username</Label>
                  <Input
                    id="identifier"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@example.com or username"
                    disabled={busy}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="pw">Password</Label>
                  <div className="relative">
                    <Input
                      id="pw"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={password ? "pr-20" : ""}
                      disabled={busy}
                    />
                    {password && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground transition"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        <span className="inline-flex items-center gap-1">
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showPassword ? "Hide" : "Show"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <Button type="submit" variant="hero" className="w-full" size="lg" disabled={busy} aria-busy={busy}>
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Please wait...
                  </span>
                ) : (
                  "Sign in to portal"
                )}
              </Button>
            </form>
            <p className="text-xs mt-5 rounded-md border border-dashed p-3 text-muted-foreground">
              If your account cannot login yet, it may still be awaiting admin approval.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
