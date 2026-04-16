import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon?: ReactNode; accent?: "primary" | "gold" | "info" | "warning" | "destructive" | "success" }) {
  const accentClass: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    gold: "text-accent-foreground bg-accent/20",
    info: "text-info bg-info/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    success: "text-success bg-success/10",
  };
  return (
    <Card className="shadow-card">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
          <p className="font-display text-3xl font-semibold mt-1">{value}</p>
        </div>
        {icon && <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${accentClass[accent ?? "primary"]}`}>{icon}</div>}
      </CardContent>
    </Card>
  );
}
