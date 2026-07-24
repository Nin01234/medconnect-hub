-- Fix profiles & user_roles RLS so department-linked clinic_admin / clinic_staff
-- can see profiles and roles scoped to their department.
-- The previous policy used clinic_id = current_clinic_id() which evaluates to
-- NULL = NULL (always false) for department users who have clinic_id = NULL.

-- ─── profiles SELECT ──────────────────────────────────────────────────────────
drop policy if exists "view own profile" on public.profiles;
create policy "view own profile" on public.profiles
for select to authenticated
using (
  -- Own profile
  id = (select auth.uid())
  -- Super admin
  or public.has_role((select auth.uid()), 'admin')
  -- Hospital admin/staff: same hospital
  or (
    public.has_role((select auth.uid()), 'hospital_admin')
    and hospital_id = public.current_hospital_id()
  )
  or (
    public.has_role((select auth.uid()), 'hospital_staff')
    and hospital_id = public.current_hospital_id()
  )
  -- Clinic-linked admin/staff (clinic_id is set): same clinic
  or (
    public.has_role((select auth.uid()), 'clinic_admin')
    and clinic_id is not null
    and clinic_id = public.current_clinic_id()
  )
  or (
    public.has_role((select auth.uid()), 'clinic_staff')
    and clinic_id is not null
    and clinic_id = public.current_clinic_id()
  )
  -- Department-linked admin/staff (clinic_id is null): same department
  or (
    public.has_role((select auth.uid()), 'clinic_admin')
    and clinic_id is null
    and department_id is not null
    and department_id = public.current_department_id()
  )
  or (
    public.has_role((select auth.uid()), 'clinic_staff')
    and clinic_id is null
    and department_id is not null
    and department_id = public.current_department_id()
  )
);

-- ─── user_roles SELECT ────────────────────────────────────────────────────────
drop policy if exists "view own roles" on public.user_roles;
create policy "view own roles" on public.user_roles
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  -- Hospital admin sees roles of same-hospital profiles
  or (
    public.has_role((select auth.uid()), 'hospital_admin')
    and exists (
      select 1 from public.profiles p
      where p.id = public.user_roles.user_id
        and p.hospital_id = public.current_hospital_id()
    )
  )
  -- Clinic-linked admin sees roles of same-clinic profiles
  or (
    public.has_role((select auth.uid()), 'clinic_admin')
    and exists (
      select 1 from public.profiles p
      where p.id = public.user_roles.user_id
        and p.clinic_id is not null
        and p.clinic_id = public.current_clinic_id()
    )
  )
  -- Department-linked admin sees roles of same-department profiles
  or (
    public.has_role((select auth.uid()), 'clinic_admin')
    and exists (
      select 1 from public.profiles p
      where p.id = public.user_roles.user_id
        and p.clinic_id is null
        and p.department_id is not null
        and p.department_id = public.current_department_id()
    )
  )
);
