import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-info/15 text-info",
  new: "bg-info/15 text-info",
  under_review: "bg-warning/15 text-warning",
  info_requested: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  assigned: "bg-primary/15 text-primary",
  treated: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const urgencyMap: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning",
  critical: "bg-destructive/15 text-destructive animate-pulse",
};

export function UrgencyBadge({ level }: { level: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide", urgencyMap[level] ?? "bg-muted")}>
      {level}
    </span>
  );
}
