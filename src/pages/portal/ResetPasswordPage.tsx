import { useMemo, useState } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { resetPasswordSchema } from "@/lib/validation";
import { safeClientError } from "@/lib/safeError";
import { consumeBrowserRateLimit, formatRetrySeconds } from "@/lib/clientRateLimit";

export default function ResetPasswordPage() {
  const [busy, setBusy] = useState(false);
  const runGuarded = useSubmitGuard();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (pw.length < 6) return false;
    if (pw !== pw2) return false;
    return true;
  }, [busy, pw, pw2]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ new_password: pw });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Password must be at least 6 characters.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords do not match.");
      return;
    }
    await runGuarded(async () => {
      setBusy(true);
      try {
        const pwLimit = consumeBrowserRateLimit("auth_password_update", 8, 900_000);
        if (!pwLimit.ok) {
          toast.error(`Too many password updates. Try again in about ${formatRetrySeconds(pwLimit.retryAfterMs)}s.`);
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
        if (error) throw error;
        toast.success("Password updated.");
        setPw("");
        setPw2("");
      } catch (err) {
        toast.error(safeClientError(err));
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <div className="max-w-xl">
      <Card className="shadow-card">
        <CardContent className="p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Choose a new password for your account.
          </p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="pw">New password</Label>
              <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw2">Confirm new password</Label>
              <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <Button type="submit" variant="hero" disabled={!canSubmit}>
              {busy ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

