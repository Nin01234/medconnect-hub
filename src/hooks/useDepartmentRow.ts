import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Shared cache key so PortalRouter + HospitalDashboard don’t duplicate department requests. */
export const departmentQueryKey = (id: string | null | undefined) => ["department", id ?? "none"] as const;

export type DepartmentRow = { status: string; name: string };

export function useDepartmentRow(deptId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: departmentQueryKey(deptId),
    enabled: enabled && !!deptId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<DepartmentRow> => {
      const { data, error } = await supabase
        .from("departments")
        .select("status,name")
        .eq("id", deptId!)
        .maybeSingle();
      if (error) throw error;
      const row = data as { status?: string; name?: string | null } | null;
      return {
        status: row?.status ?? "inactive",
        name: (row?.name ?? "").trim(),
      };
    },
  });
}
