create table if not exists public.staff_directory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  staff_role public.app_role not null,
  clinic_id uuid references public.clinics(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  staff_code text,
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_directory_role_check check (staff_role in ('clinic_staff', 'hospital_staff')),
  constraint staff_directory_scope_check check (
    (staff_role = 'clinic_staff' and hospital_id is null)
    or
    (staff_role = 'hospital_staff' and clinic_id is null)
  )
);

create index if not exists idx_staff_directory_clinic_id on public.staff_directory(clinic_id);
create index if not exists idx_staff_directory_hospital_id on public.staff_directory(hospital_id);
create index if not exists idx_staff_directory_department_id on public.staff_directory(department_id);

create trigger trg_staff_directory_updated before update on public.staff_directory
  for each row execute function public.update_updated_at_column();

create or replace function public.refresh_staff_directory(
  p_user_id uuid,
  p_actor_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  role_value public.app_role;
  profile_row public.profiles%rowtype;
begin
  select ur.role
  into role_value
  from public.user_roles ur
  where ur.user_id = p_user_id
  order by ur.created_at desc
  limit 1;

  select *
  into profile_row
  from public.profiles p
  where p.id = p_user_id;

  if profile_row.id is null then
    delete from public.staff_directory where user_id = p_user_id;
    return;
  end if;

  if role_value in ('clinic_staff', 'hospital_staff') then
    insert into public.staff_directory (
      user_id, staff_role, clinic_id, hospital_id, department_id, staff_code, status, created_by
    )
    values (
      p_user_id,
      role_value,
      case when role_value = 'clinic_staff' then profile_row.clinic_id else null end,
      case when role_value = 'hospital_staff' then profile_row.hospital_id else null end,
      case when role_value = 'hospital_staff' then profile_row.department_id else null end,
      profile_row.staff_id,
      coalesce(profile_row.status, 'active'),
      p_actor_id
    )
    on conflict (user_id) do update
    set staff_role = excluded.staff_role,
        clinic_id = excluded.clinic_id,
        hospital_id = excluded.hospital_id,
        department_id = excluded.department_id,
        staff_code = excluded.staff_code,
        status = excluded.status,
        updated_at = now();
  else
    delete from public.staff_directory where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.refresh_staff_directory_from_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_staff_directory(old.id, auth.uid());
    return old;
  end if;

  perform public.refresh_staff_directory(new.id, auth.uid());
  return new;
end;
$$;

create or replace function public.refresh_staff_directory_from_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_staff_directory(old.user_id, auth.uid());
    return old;
  end if;

  perform public.refresh_staff_directory(new.user_id, auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_refresh_staff_directory_profiles on public.profiles;
create trigger trg_refresh_staff_directory_profiles
after insert or update or delete on public.profiles
for each row execute function public.refresh_staff_directory_from_profiles();

drop trigger if exists trg_refresh_staff_directory_roles on public.user_roles;
create trigger trg_refresh_staff_directory_roles
after insert or update or delete on public.user_roles
for each row execute function public.refresh_staff_directory_from_roles();

insert into public.staff_directory (user_id, staff_role, clinic_id, hospital_id, department_id, staff_code, status, created_by)
select
  p.id,
  ur.role as staff_role,
  case when ur.role = 'clinic_staff' then p.clinic_id else null end,
  case when ur.role = 'hospital_staff' then p.hospital_id else null end,
  case when ur.role = 'hospital_staff' then p.department_id else null end,
  p.staff_id,
  coalesce(p.status, 'active'),
  p.id
from public.profiles p
join public.user_roles ur on ur.user_id = p.id
where ur.role in ('clinic_staff', 'hospital_staff')
on conflict (user_id) do update
set staff_role = excluded.staff_role,
    clinic_id = excluded.clinic_id,
    hospital_id = excluded.hospital_id,
    department_id = excluded.department_id,
    staff_code = excluded.staff_code,
    status = excluded.status,
    updated_at = now();

alter table public.staff_directory enable row level security;

drop policy if exists "view staff directory scoped" on public.staff_directory;
create policy "view staff directory scoped" on public.staff_directory
for select to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or user_id = (select auth.uid())
  or (public.has_role((select auth.uid()), 'hospital_admin') and hospital_id = public.current_hospital_id())
  or (public.has_role((select auth.uid()), 'clinic_admin') and clinic_id = public.current_clinic_id())
);

drop policy if exists "manage staff directory scoped" on public.staff_directory;
create policy "manage staff directory scoped" on public.staff_directory
for all to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_admin') and hospital_id = public.current_hospital_id())
  or (public.has_role((select auth.uid()), 'clinic_admin') and clinic_id = public.current_clinic_id())
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or (public.has_role((select auth.uid()), 'hospital_admin') and hospital_id = public.current_hospital_id())
  or (public.has_role((select auth.uid()), 'clinic_admin') and clinic_id = public.current_clinic_id())
);

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
  or (
    public.has_role((select auth.uid()), 'clinic_admin')
    and clinic_id = public.current_clinic_id()
  )
  or (
    public.has_role((select auth.uid()), 'clinic_staff')
    and clinic_id = public.current_clinic_id()
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
  or (
    public.has_role((select auth.uid()), 'clinic_admin')
    and exists (
      select 1
      from public.profiles p
      where p.id = public.user_roles.user_id
        and p.clinic_id = public.current_clinic_id()
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

drop policy if exists "clinic create referrals" on public.referrals;
create policy "clinic create referrals" on public.referrals
for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'admin')
  or (
    clinic_id = public.current_clinic_id()
    and created_by = (select auth.uid())
    and (
      public.has_role((select auth.uid()), 'clinic_user')
      or public.has_role((select auth.uid()), 'clinic_admin')
      or public.has_role((select auth.uid()), 'clinic_staff')
    )
  )
);

drop policy if exists "update referrals scoped" on public.referrals;
create policy "update referrals scoped" on public.referrals
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (
    clinic_id = public.current_clinic_id()
    and status in ('draft','submitted','info_requested')
    and (
      public.has_role((select auth.uid()), 'clinic_user')
      or public.has_role((select auth.uid()), 'clinic_admin')
      or public.has_role((select auth.uid()), 'clinic_staff')
    )
  )
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

drop policy if exists "admin read audit" on public.audit_logs;
create policy "read audit scoped" on public.audit_logs
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or actor_id = (select auth.uid())
);
