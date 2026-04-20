-- Allow hospital admins to view staff accounts scoped to their own hospital.
-- This enables hospital admin staff management screens to list all hospital staff.

drop policy if exists "view own profile" on public.profiles;
create policy "view own profile" on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'hospital_admin')
    and hospital_id = public.current_hospital_id()
  )
);

drop policy if exists "view own roles" on public.user_roles;
create policy "view own roles" on public.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_role(auth.uid(), 'admin')
  or (
    public.has_role(auth.uid(), 'hospital_admin')
    and exists (
      select 1
      from public.profiles p
      where p.id = public.user_roles.user_id
        and p.hospital_id = public.current_hospital_id()
    )
  )
);
