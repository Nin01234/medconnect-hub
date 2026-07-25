import { CheckCircle2, Clock, User, Calendar, MessageSquare, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TimelineStep {
  stage: string;
  label: string;
  status: "completed" | "current" | "pending";
  date?: string;
  time?: string;
  user?: string;
  comment?: string;
}

interface ReferralTimelineProps {
  currentStatus: string;
  createdAt: string;
  history?: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    created_at: string;
    note: string | null;
    changed_by?: string | null;
  }>;
}

const STAGES = [
  { stage: "created", label: "Referral Created" },
  { stage: "submitted", label: "Submitted" },
  { stage: "assigned", label: "Assigned" },
  { stage: "reviewed", label: "Reviewed" },
  { stage: "accepted", label: "Accepted" },
  { stage: "scheduled", label: "Appointment Scheduled" },
  { stage: "completed", label: "Completed" },
];

export function ReferralTimeline({ currentStatus, createdAt, history = [] }: ReferralTimelineProps) {
  const normStatus = (currentStatus || "").toLowerCase();

  const historyByStatus: Record<string, { date: string; time: string; note?: string; user?: string }> = {};

  history.forEach((h) => {
    const dt = new Date(h.created_at);
    historyByStatus[h.to_status.toLowerCase()] = {
      date: dt.toLocaleDateString(),
      time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      note: h.note || undefined,
      user: h.changed_by || undefined,
    };
  });

  if (!historyByStatus["created"] && !historyByStatus["submitted"]) {
    const dt = new Date(createdAt);
    historyByStatus["created"] = {
      date: dt.toLocaleDateString(),
      time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  }

  const getStageState = (stageKey: string, idx: number): "completed" | "current" | "pending" => {
    if (normStatus === stageKey) return "current";
    if (normStatus === "completed") return "completed";
    if (normStatus === "rejected") {
      if (stageKey === "created" || stageKey === "submitted") return "completed";
      return "pending";
    }

    const order = ["created", "submitted", "new", "under_review", "assigned", "reviewed", "accepted", "scheduled", "completed"];
    const currentIdx = order.indexOf(normStatus);
    const stageIdx = order.indexOf(stageKey);

    if (currentIdx >= stageIdx && currentIdx !== -1) return "completed";
    return "pending";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Referral Progress Timeline
        </h3>
        <Badge variant="outline" className="capitalize text-xs font-mono">
          Status: {normStatus}
        </Badge>
      </div>

      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {STAGES.map((s, idx) => {
          const state = getStageState(s.stage, idx);
          const meta = historyByStatus[s.stage] || (s.stage === "submitted" ? historyByStatus["new"] : undefined);

          return (
            <div key={s.stage} className="relative flex items-start gap-4 group">
              <div
                className={`absolute -left-6 top-0.5 h-5 w-5 rounded-full border flex items-center justify-center text-xs transition-colors ${
                  state === "completed"
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : state === "current"
                    ? "bg-primary border-primary text-primary-foreground animate-pulse"
                    : "bg-background border-border text-muted-foreground"
                }`}
              >
                {state === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </div>

              <div className="flex-1 rounded-lg border bg-card p-3 text-xs space-y-1 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${state === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                    {s.label}
                  </span>
                  {meta && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {meta.date} {meta.time}
                    </span>
                  )}
                </div>

                {meta?.user && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3" /> {meta.user}
                  </div>
                )}

                {meta?.note && (
                  <div className="flex items-start gap-1.5 mt-1 p-2 rounded bg-secondary/50 text-[11px] text-muted-foreground italic">
                    <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>"{meta.note}"</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
