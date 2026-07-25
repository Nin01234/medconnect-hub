/**
 * LabResultsPanel.tsx
 * Full-featured laboratory results panel for use on referral create & detail pages.
 * Features: summary card, filterable table, status colour-coding, result attachment,
 * PDF download, print, and meaningful loading/error states.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  FlaskConical,
  AlertTriangle,
  Search,
  Printer,
  Download,
  Paperclip,
  RefreshCcw,
  Activity,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchLabResults,
  attachLabResultsToReferral,
  summarizeLabResults,
  LAB_STATUS_CONFIG,
  DATE_RANGE_OPTIONS,
  type LabResult,
  type DateRangeDays,
  type LabStatus,
} from "@/lib/laboratoryService";
import { safeClientError } from "@/lib/safeError";

interface LabResultsPanelProps {
  patientId?: string | null;
  referralId?: string | null;
  /** When provided, shows attach-to-referral actions */
  allowAttach?: boolean;
  /** Called after results are attached to the referral */
  onAttached?: (ids: string[]) => void;
}

export function LabResultsPanel({
  patientId,
  referralId,
  allowAttach = false,
  onAttached,
}: LabResultsPanelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRangeDays>(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryKey = ["lab_results", patientId, dateRange];

  const {
    data: allResults = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    enabled: !!patientId,
    queryFn: () => fetchLabResults(patientId!, dateRange),
    staleTime: 60_000,
  });

  const summary = useMemo(() => summarizeLabResults(allResults), [allResults]);

  const filtered = useMemo(() => {
    let list = allResults;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.test_name.toLowerCase().includes(q) ||
          (r.ordering_doctor ?? "").toLowerCase().includes(q) ||
          r.result.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allResults, statusFilter, searchQuery]);

  const attachMutation = useMutation({
    mutationFn: () => {
      if (!referralId) throw new Error("No referral ID provided.");
      if (!user?.id) throw new Error("Must be signed in.");
      return attachLabResultsToReferral(referralId, Array.from(selectedIds), user.id);
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} lab result(s) attached to this referral.`);
      qc.invalidateQueries({ queryKey });
      onAttached?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    },
    onError: (e) => toast.error(safeClientError(e)),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const handlePrint = () => window.print();

  if (!patientId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-8 text-center text-muted-foreground">
        <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Enter patient information first</p>
        <p className="text-sm mt-1">Lab results will automatically load once a patient is identified.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground animate-pulse">
        <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Loading laboratory results…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-rose-700 dark:text-rose-300">Failed to load lab results</p>
          <p className="text-sm text-muted-foreground mt-1">{safeClientError(error)}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void refetch()}>
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryTile label="Total Tests" value={summary.total} icon={FlaskConical} className="border-primary/20 bg-primary/5" />
        <SummaryTile label="Normal" value={summary.normal} icon={CheckCircle2} className="border-emerald-500/20 bg-emerald-500/5" valueClass="text-emerald-600 dark:text-emerald-400" />
        <SummaryTile label="Abnormal" value={summary.abnormal} icon={Activity} className="border-amber-500/20 bg-amber-500/5" valueClass="text-amber-600 dark:text-amber-400" />
        <SummaryTile label="Critical" value={summary.critical} icon={AlertTriangle} className="border-rose-500/20 bg-rose-500/5" valueClass="text-rose-600 dark:text-rose-400" />
        <div className="rounded-xl border bg-card p-3 flex flex-col justify-center text-center shadow-sm col-span-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Latest</p>
          <p className="font-display text-sm font-bold mt-1 text-foreground">
            {summary.latestDate ? new Date(summary.latestDate).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search test, doctor, result…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="normal">🟢 Normal</SelectItem>
            <SelectItem value="high">🟡 High</SelectItem>
            <SelectItem value="low">🟠 Low</SelectItem>
            <SelectItem value="critical">🔴 Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(dateRange)}
          onValueChange={(v) => setDateRange(Number(v) as DateRangeDays)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={() => void refetch()} className="no-print">
          <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Attach bar */}
      {allowAttach && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <Paperclip className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium flex-1">
            {selectedIds.size} result{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            size="sm"
            variant="hero"
            disabled={attachMutation.isPending}
            onClick={() => void attachMutation.mutateAsync()}
          >
            {attachMutation.isPending ? "Attaching…" : "Attach to Referral"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0 overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No lab results found</p>
              <p className="text-sm mt-1">
                {allResults.length === 0
                  ? "No results recorded for this patient in the selected period."
                  : "No results match your filters."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground bg-secondary/30">
                <tr>
                  {allowAttach && (
                    <th className="px-4 py-3 w-10">
                      <Checkbox
                        checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3">Test</th>
                  <th className="text-left px-4 py-3">Result</th>
                  <th className="text-left px-4 py-3">Range</th>
                  <th className="text-left px-4 py-3">Unit</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Doctor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cfg = LAB_STATUS_CONFIG[r.status as LabStatus];
                  return (
                    <tr
                      key={r.id}
                      className={`border-b hover:bg-secondary/30 transition-colors ${cfg.rowClass} ${
                        selectedIds.has(r.id) ? "ring-inset ring-1 ring-primary/40 bg-primary/5" : ""
                      }`}
                    >
                      {allowAttach && (
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                            aria-label={`Select ${r.test_name}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium">{r.test_name}</td>
                      <td className="px-4 py-3 font-mono font-semibold">
                        <span className="flex items-center gap-1">
                          {r.status === "high" && <TrendingUp className="h-3.5 w-3.5 text-amber-500" />}
                          {r.status === "low" && <TrendingDown className="h-3.5 w-3.5 text-orange-500" />}
                          {r.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.normal_range ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.unit ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] border ${cfg.className}`}>
                          {cfg.emoji} {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(r.date_performed).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.ordering_doctor ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  className = "",
  valueClass = "text-foreground",
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 shadow-sm ${className}`}>
      <div className="h-9 w-9 rounded-lg bg-background/60 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
        <p className={`font-display text-xl font-bold ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
