-- Backend hardening and scale-focused RLS/index optimizations.a
-- Addresses:
-- 1) unindexed foreign key on doctors.user_id
-- 2) auth_rls_initplan warnings by hoisting auth.uid() through initplans
-- 3) duplicate permissive policy overhead on departments/doctors/hospitals

create index if not exists idx_doctors_user_id on public.doctors(user_id);

drop policy if exists "view own profile" on public.profiles;
create policy "view own profile" on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or (
    public.has_role((select auth.uid()), 'hospital_admin')
    and hospital_id = public.current_hospital_id()
  )
  or (
    public.has_role((select auth.uid()), 'hospital_staff')
    and hospital_id = public.current_hospital_id()
  )
);

drop policy if exists "view own roles" on public.user_roles;
create policy "view own roles" on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or (
    public.has_role((select auth.uid()), 'hospital_admin')
    and exists (
      select 1
      from public.profiles p
      where p.id = public.user_roles.user_id
        and p.hospital_id = public.current_hospital_id()
    )
  )
);

drop policy if exists "view referrals scoped" on public.referrals;
create policy "view referrals scoped" on public.referrals
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (clinic_id is not null and clinic_id = public.current_clinic_id())
  or (
    hospital_id is not null
    and hospital_id = public.current_hospital_id()
    and (
      not public.has_role((select auth.uid()), 'hospital_staff')
      or department_id = public.current_department_id()
    )
  )
);

drop policy if exists "update referrals scoped" on public.referrals;
create policy "update referrals scoped" on public.referrals
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (clinic_id = public.current_clinic_id() and status in ('draft','submitted','info_requested'))
  or (
    hospital_id = public.current_hospital_id()
    and (
      not public.has_role((select auth.uid()), 'hospital_staff')
      or department_id = public.current_department_id()
    )
  )
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or clinic_id = public.current_clinic_id()
  or (
    hospital_id = public.current_hospital_id()
    and (
      not public.has_role((select auth.uid()), 'hospital_staff')
      or department_id = public.current_department_id()
    )
  )
);

drop policy if exists "view doctors of my hospital" on public.doctors;
create policy "view doctors of my hospital" on public.doctors
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or hospital_id = public.current_hospital_id()
  or hospital_id in (
    select hospital_id
    from public.referrals
    where clinic_id = public.current_clinic_id()
  )
);

drop policy if exists "hospital staff manage doctors" on public.doctors;
drop policy if exists "hospital staff insert doctors" on public.doctors;
drop policy if exists "hospital staff update doctors" on public.doctors;
drop policy if exists "hospital staff delete doctors" on public.doctors;

create policy "hospital staff insert doctors" on public.doctors
for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_staff') and hospital_id = public.current_hospital_id())
);

create policy "hospital staff update doctors" on public.doctors
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_staff') and hospital_id = public.current_hospital_id())
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_staff') and hospital_id = public.current_hospital_id())
);

create policy "hospital staff delete doctors" on public.doctors
for delete
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_staff') and hospital_id = public.current_hospital_id())
);

drop policy if exists "view departments scoped" on public.departments;
create policy "view departments scoped" on public.departments
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or hospital_id = public.current_hospital_id()
);

drop policy if exists "hospital admin manage departments" on public.departments;
drop policy if exists "hospital admin insert departments" on public.departments;
drop policy if exists "hospital admin update departments" on public.departments;
drop policy if exists "hospital admin delete departments" on public.departments;

create policy "hospital admin insert departments" on public.departments
for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_admin') and hospital_id = public.current_hospital_id())
);

create policy "hospital admin update departments" on public.departments
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_admin') and hospital_id = public.current_hospital_id())
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_admin') and hospital_id = public.current_hospital_id())
);

create policy "hospital admin delete departments" on public.departments
for delete
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_admin') and hospital_id = public.current_hospital_id())
);

drop policy if exists "hospital admin update own hospital" on public.hospitals;
drop policy if exists "admin write hospitals" on public.hospitals;
drop policy if exists "admin insert hospitals" on public.hospitals;
drop policy if exists "admin delete hospitals" on public.hospitals;
drop policy if exists "update hospitals scoped" on public.hospitals;

create policy "admin insert hospitals" on public.hospitals
for insert
to authenticated
with check (public.has_role((select auth.uid()), 'admin'));

create policy "admin delete hospitals" on public.hospitals
for delete
to authenticated
using (public.has_role((select auth.uid()), 'admin'));

create policy "update hospitals scoped" on public.hospitals
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (
    public.has_role((select auth.uid()), 'hospital_admin')
    and id = public.current_hospital_id()
  )
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or (
    public.has_role((select auth.uid()), 'hospital_admin')
    and id = public.current_hospital_id()
  )
);
