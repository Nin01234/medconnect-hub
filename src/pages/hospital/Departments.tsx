import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, hasRole } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sanitizeText } from "@/lib/sanitize";
import { safeClientError } from "@/lib/safeError";

interface HospitalRow {
  id: string;
  name: string;
}

interface DepartmentRow {
  id: string;
  name: string;
  status: string;
}

export default function Departments() {
  const { profile, roles } = useAuth();
  const canManage = hasRole(roles, "hospital_admin", "admin");
  const [hospital, setHospital] = useState<HospitalRow | null>(null);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.hospital_id) return;
    const { data, error } = await supabase
      .from("hospitals")
      .select("id, name")
      .eq("id", profile.hospital_id)
      .maybeSingle();
    if (error) {
      toast.error(safeClientError(error));
      return;
    }
    const { data: depData, error: depError } = await supabase
      .from("departments")
      .select("id, name, status")
      .eq("hospital_id", profile.hospital_id)
      .order("name");
    if (depError) {
      toast.error(safeClientError(depError));
      return;
    }
    setHospital((data ?? null) as HospitalRow | null);
    setDepartments((depData ?? []) as DepartmentRow[]);
  }, [profile?.hospital_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const addDepartment = async () => {
    if (!canManage) return;
    if (!profile?.hospital_id) return;
    const value = sanitizeText(newDepartment, 80);
    if (!value) {
      toast.error("Enter a department name.");
      return;
    }
    if (departments.some((d) => d.name.toLowerCase() === value.toLowerCase())) {
      toast.error("Department already exists.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").insert({
        hospital_id: profile.hospital_id,
        name: value,
        status: "active",
      });
      if (error) throw error;
      await load();
      setNewDepartment("");
      toast.success("Department added");
    } catch (e) {
      toast.error(safeClientError(e));
    } finally {
      setBusy(false);
    }
  };

  const removeDepartment = async (id: string) => {
    if (!canManage) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
      await load();
      toast.success("Department removed");
    } catch (e) {
      toast.error(safeClientError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Departments</h1>
        <p className="text-muted-foreground">
          {canManage
            ? "Create and manage departments used for referral assignment."
            : "Hospital departments used for referral assignment."}
        </p>
        {hospital?.name && <p className="text-xs text-muted-foreground mt-1">Hospital: {hospital.name}</p>}
      </div>

      {canManage && (
        <Card className="shadow-card">
          <CardContent className="p-5">
            <Label>Add department</Label>
            <div className="mt-2 flex gap-2">
              <Input
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="e.g. Emergency, Surgery, Pediatrics"
              />
              <Button variant="hero" disabled={busy || !newDepartment.trim()} onClick={() => void addDepartment()}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardContent className="p-5">
          <h2 className="font-semibold mb-3">Hospital department list</h2>
          <div className="space-y-2">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span>{d.name}</span>
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void removeDepartment(d.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            ))}
            {departments.length === 0 && (
              <p className="text-sm text-muted-foreground">No departments configured yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
