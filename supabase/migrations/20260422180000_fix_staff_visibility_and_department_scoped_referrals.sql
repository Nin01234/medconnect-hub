-- Ensure hospital admins can always read hospital staff roles for listing.
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

-- Staff should only see referrals assigned to their own department.
drop policy if exists "view referrals scoped" on public.referrals;
create policy "view referrals scoped" on public.referrals for select to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or (clinic_id is not null and clinic_id = public.current_clinic_id())
  or (
    hospital_id is not null
    and hospital_id = public.current_hospital_id()
    and (
      not public.has_role(auth.uid(),'hospital_staff')
      or department_id = public.current_department_id()
    )
  )
);

drop policy if exists "update referrals scoped" on public.referrals;
create policy "update referrals scoped" on public.referrals for update to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or (clinic_id = public.current_clinic_id() and status in ('draft','submitted','info_requested'))
  or (
    hospital_id = public.current_hospital_id()
    and (
      not public.has_role(auth.uid(),'hospital_staff')
      or department_id = public.current_department_id()
    )
  )
)
with check (
  public.has_role(auth.uid(),'admin')
  or clinic_id = public.current_clinic_id()
  or (
    hospital_id = public.current_hospital_id()
    and (
      not public.has_role(auth.uid(),'hospital_staff')
      or department_id = public.current_department_id()
    )
  )
);
