-- Persist doctor assignment events in referral history and
-- maintain a staff snapshot directly on departments.

alter table public.departments
add column if not exists staff_details jsonb not null default '[]'::jsonb,
add column if not exists staff_count integer not null default 0,
add column if not exists active_staff_count integer not null default 0;

create or replace function public.refresh_department_staff_snapshot(p_department_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_department_id is null then
    return;
  end if;

  update public.departments d
  set
    staff_details = coalesce(s.snapshot, '[]'::jsonb),
    staff_count = coalesce(s.total_count, 0),
    active_staff_count = coalesce(s.active_count, 0)
  from (
    select
      p.department_id,
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'staff_id', p.staff_id,
          'email', p.email,
          'phone', p.phone,
          'status', p.status
        )
        order by coalesce(p.full_name, p.email, p.id::text)
      ) as snapshot,
      count(*)::int as total_count,
      count(*) filter (where p.status = 'active')::int as active_count
    from public.profiles p
    where p.department_id = p_department_id
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = p.id
          and ur.role = 'hospital_staff'
      )
    group by p.department_id
  ) s
  where d.id = p_department_id;

  update public.departments d
  set
    staff_details = '[]'::jsonb,
    staff_count = 0,
    active_staff_count = 0
  where d.id = p_department_id
    and not exists (
      select 1
      from public.profiles p
      where p.department_id = p_department_id
        and exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role = 'hospital_staff'
        )
    );
end;
$$;

create or replace function public.handle_profile_department_snapshot_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_department_staff_snapshot(old.department_id);
    return old;
  end if;

  perform public.refresh_department_staff_snapshot(new.department_id);
  if tg_op = 'UPDATE' and old.department_id is distinct from new.department_id then
    perform public.refresh_department_staff_snapshot(old.department_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_department_snapshot_refresh on public.profiles;
create trigger trg_profiles_department_snapshot_refresh
after insert or update or delete on public.profiles
for each row execute function public.handle_profile_department_snapshot_refresh();

create or replace function public.handle_user_role_department_snapshot_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  dep_id uuid;
begin
  target_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if tg_op = 'INSERT' and new.role <> 'hospital_staff' then
    return new;
  end if;
  if tg_op = 'DELETE' and old.role <> 'hospital_staff' then
    return old;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.role::text, '') = coalesce(new.role::text, '') and new.role <> 'hospital_staff' then
    return new;
  end if;

  select p.department_id into dep_id
  from public.profiles p
  where p.id = target_user_id;

  perform public.refresh_department_staff_snapshot(dep_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_user_roles_department_snapshot_refresh on public.user_roles;
create trigger trg_user_roles_department_snapshot_refresh
after insert or update or delete on public.user_roles
for each row execute function public.handle_user_role_department_snapshot_refresh();

create or replace function public.log_doctor_assignment_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  doctor_name text;
  doctor_specialty text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.assigned_doctor_id is distinct from old.assigned_doctor_id then
    if new.assigned_doctor_id is null then
      insert into public.referral_status_history(referral_id, from_status, to_status, changed_by, note)
      values (new.id, old.status, new.status, auth.uid(), 'Doctor assignment cleared');
    else
      select d.full_name, d.specialty
      into doctor_name, doctor_specialty
      from public.doctors d
      where d.id = new.assigned_doctor_id;

      insert into public.referral_status_history(referral_id, from_status, to_status, changed_by, note)
      values (
        new.id,
        old.status,
        new.status,
        auth.uid(),
        'Doctor assigned: ' || coalesce(doctor_name, new.assigned_doctor_id::text) ||
        case when doctor_specialty is not null and btrim(doctor_specialty) <> '' then ' (' || doctor_specialty || ')' else '' end
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_doctor_assignment_history on public.referrals;
create trigger trg_log_doctor_assignment_history
after update on public.referrals
for each row execute function public.log_doctor_assignment_history();

do $$
declare
  dep_id uuid;
begin
  for dep_id in select id from public.departments loop
    perform public.refresh_department_staff_snapshot(dep_id);
  end loop;
end;
$$;
