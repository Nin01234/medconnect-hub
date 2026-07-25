import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { hasRole } from "@/context/authRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Bookmark, BookOpen, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  type TemplateItem,
  GLOBAL_TEMPLATES,
  createDeptTemplate,
  updateDeptTemplate,
  deleteDeptTemplate,
  fetchTemplatesFromDb,
} from "@/lib/referralTemplates";
import { safeClientError } from "@/lib/safeError";

type UrgencyLevel = "low" | "medium" | "high" | "critical";

const EMPTY_FORM: Omit<TemplateItem, "id"> = {
  title: "",
  referral_reason: "",
  diagnosis: "",
  notes: "",
  urgency_level: "medium",
  required_documents: "",
  is_global: false,
};

const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  low: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export default function TemplateManagement() {
  const { profile, roles, user } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole(roles, "clinic_admin", "admin");
  const departmentId = profile?.department_id ?? null;
  const runGuarded = useSubmitGuard();

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selected, setSelected] = useState<TemplateItem | null>(null);
  const [form, setForm] = useState<Omit<TemplateItem, "id">>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<Omit<TemplateItem, "id">>(EMPTY_FORM);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["referral_templates", departmentId],
    enabled: true,
    queryFn: () => fetchTemplatesFromDb(departmentId),
  });

  const deptTemplates = useMemo(
    () => templates.filter((t) => !t.is_global),
    [templates],
  );

  const createMutation = useMutation({
    mutationFn: async (data: Omit<TemplateItem, "id">) => {
      if (!departmentId) throw new Error("No department linked to your account.");
      if (!user?.id) throw new Error("You must be signed in.");
      return createDeptTemplate(
        { ...data, department_id: departmentId, hospital_id: profile?.hospital_id ?? null },
        user.id,
      );
    },
    onSuccess: () => {
      toast.success("Template created");
      qc.invalidateQueries({ queryKey: ["referral_templates"] });
      setOpenCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: (e) => toast.error(safeClientError(e)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<TemplateItem, "id" | "created_by">> }) =>
      updateDeptTemplate(id, data),
    onSuccess: () => {
      toast.success("Template updated");
      qc.invalidateQueries({ queryKey: ["referral_templates"] });
      setOpenEdit(false);
      setSelected(null);
    },
    onError: (e) => toast.error(safeClientError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDeptTemplate(id),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["referral_templates"] });
    },
    onError: (e) => toast.error(safeClientError(e)),
  });

  const handleCreate = () => {
    if (!form.title.trim()) return toast.error("Title is required.");
    if (!form.referral_reason.trim()) return toast.error("Referral reason is required.");
    void runGuarded(() => createMutation.mutateAsync(form));
  };

  const handleUpdate = () => {
    if (!selected) return;
    if (!editForm.title.trim()) return toast.error("Title is required.");
    void runGuarded(() => updateMutation.mutateAsync({ id: selected.id, data: editForm }));
  };

  const handleDelete = (tpl: TemplateItem) => {
    if (!window.confirm(`Delete template "${tpl.title}"? This cannot be undone.`)) return;
    void deleteMutation.mutateAsync(tpl.id);
  };

  const openEditDialog = (tpl: TemplateItem) => {
    setSelected(tpl);
    setEditForm({
      title: tpl.title,
      referral_reason: tpl.referral_reason,
      diagnosis: tpl.diagnosis ?? "",
      notes: tpl.notes ?? "",
      urgency_level: tpl.urgency_level,
      required_documents: tpl.required_documents ?? "",
      is_global: tpl.is_global,
    });
    setOpenEdit(true);
  };

  if (!canManage) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <h1 className="font-display text-2xl font-bold">Referral Templates</h1>
          <p className="text-muted-foreground mt-2">Only department admins can manage referral templates.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Referral Templates</h1>
          <p className="text-muted-foreground">
            Create reusable templates for your department. Staff can apply these when creating referrals.
          </p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Department Template</DialogTitle>
              <DialogDescription>
                This template will be available to all staff in your department.
              </DialogDescription>
            </DialogHeader>
            <TemplateForm form={form} onChange={setForm} />
            <Button
              variant="hero"
              className="w-full mt-2"
              disabled={createMutation.isPending}
              onClick={handleCreate}
            >
              {createMutation.isPending ? "Creating…" : "Create Template"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dept Templates */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="p-5 border-b flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Your Department Templates</h2>
            <Badge variant="outline" className="ml-auto font-mono text-xs">{deptTemplates.length}</Badge>
          </div>
          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">Loading templates…</p>
          ) : deptTemplates.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No department templates yet.</p>
              <p className="text-sm mt-1">Create your first template to speed up referral creation for your staff.</p>
            </div>
          ) : (
            <div className="divide-y">
              {deptTemplates.map((tpl) => (
                <div key={tpl.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{tpl.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${URGENCY_COLORS[tpl.urgency_level as UrgencyLevel]}`}>
                        {tpl.urgency_level}
                      </span>
                    </div>
                    {tpl.referral_reason && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.referral_reason}</p>
                    )}
                    {tpl.required_documents && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground/60">Docs required:</span> {tpl.required_documents}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(tpl)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(tpl)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Templates (read-only) */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="p-5 border-b flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Global Templates</h2>
            <Badge variant="outline" className="ml-auto font-mono text-xs text-muted-foreground">
              {GLOBAL_TEMPLATES.length} built-in
            </Badge>
          </div>
          <div className="divide-y">
            {GLOBAL_TEMPLATES.map((tpl) => (
              <div key={tpl.id} className="px-5 py-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{tpl.title}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${URGENCY_COLORS[tpl.urgency_level as UrgencyLevel]}`}>
                    {tpl.urgency_level}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">Global</Badge>
                </div>
                {tpl.referral_reason && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.referral_reason}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update this department template.</DialogDescription>
          </DialogHeader>
          <TemplateForm form={editForm} onChange={setEditForm} />
          <Button
            variant="hero"
            className="w-full mt-2"
            disabled={updateMutation.isPending}
            onClick={handleUpdate}
          >
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateForm({
  form,
  onChange,
}: {
  form: Omit<TemplateItem, "id">;
  onChange: (f: Omit<TemplateItem, "id">) => void;
}) {
  const set = (k: keyof typeof form, v: string) => onChange({ ...form, [k]: v });
  return (
    <div className="space-y-3">
      <Field label="Template Title *">
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Cardiology Chest Pain Protocol" />
      </Field>
      <Field label="Referral Reason *">
        <Textarea rows={2} value={form.referral_reason} onChange={(e) => set("referral_reason", e.target.value)} placeholder="Clinical indication for referral…" />
      </Field>
      <Field label="Diagnosis (optional)">
        <Input value={form.diagnosis ?? ""} onChange={(e) => set("diagnosis", e.target.value)} placeholder="e.g. Suspected ACS" />
      </Field>
      <Field label="Notes (optional)">
        <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Additional clinical notes…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Urgency Level">
          <Select value={form.urgency_level} onValueChange={(v) => set("urgency_level", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Required Documents">
          <Input value={form.required_documents ?? ""} onChange={(e) => set("required_documents", e.target.value)} placeholder="ECG, Blood Glucose…" />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}
