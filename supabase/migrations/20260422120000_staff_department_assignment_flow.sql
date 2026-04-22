alter table public.profiles
add column if not exists staff_id text,
add column if not exists department_id uuid references public.departments(id) on delete set null;

create unique index if not exists uq_profiles_hospital_staff_id
  on public.profiles (hospital_id, lower(staff_id))
  where staff_id is not null and btrim(staff_id) <> '';

create index if not exists idx_profiles_department_id on public.profiles(department_id);

alter table public.referrals
add column if not exists assigned_staff_id uuid references public.profiles(id) on delete set null,
add column if not exists staff_assignment_locked boolean not null default false;

create index if not exists idx_referrals_assigned_staff_id on public.referrals(assigned_staff_id);

create or replace function public.validate_referral_staff_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_hospital_staff boolean;
begin
  is_hospital_staff := public.has_role(auth.uid(), 'hospital_staff');

  if tg_op = 'UPDATE' and is_hospital_staff then
    if old.assigned_staff_id is null and new.assigned_staff_id is distinct from old.assigned_staff_id then
      raise exception 'A hospital admin must assign staff first.';
    end if;
    if old.assigned_staff_id is not null and old.assigned_staff_id <> auth.uid() and new.assigned_staff_id is distinct from old.assigned_staff_id then
      raise exception 'You can only reassign referrals assigned to you.';
    end if;
    if old.staff_assignment_locked is not true and new.assigned_staff_id is distinct from old.assigned_staff_id then
      raise exception 'This referral has not been assigned by an admin yet.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_referral_staff_update on public.referrals;
create trigger trg_validate_referral_staff_update
before update on public.referrals
for each row execute function public.validate_referral_staff_update();

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
  or (
    public.has_role(auth.uid(), 'hospital_staff')
    and hospital_id = public.current_hospital_id()
  )
);

drop policy if exists "update referrals scoped" on public.referrals;
create policy "update referrals scoped" on public.referrals for update to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or (clinic_id = public.current_clinic_id() and status in ('draft','submitted','info_requested'))
  or (hospital_id = public.current_hospital_id())
)
with check (
  public.has_role(auth.uid(),'admin')
  or clinic_id = public.current_clinic_id()
  or (
    hospital_id = public.current_hospital_id()
    and (
      not public.has_role(auth.uid(),'hospital_staff')
      or assigned_staff_id is null
      or assigned_staff_id = auth.uid()
    )
  )
);

create or replace function public.audit_referral_assignment_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.department_id is distinct from old.department_id then
      perform public.append_audit_log(
        'referral_department_assigned',
        'referral',
        new.id,
        jsonb_build_object(
          'referral_number', new.referral_number,
          'department_id', new.department_id,
          'assigned_department', new.assigned_department
        )
      );
    end if;

    if new.assigned_staff_id is distinct from old.assigned_staff_id then
      perform public.append_audit_log(
        'referral_staff_assigned',
        'referral',
        new.id,
        jsonb_build_object(
          'referral_number', new.referral_number,
          'assigned_staff_id', new.assigned_staff_id,
          'department_id', new.department_id
        )
      );
    end if;

    if new.assigned_doctor_id is distinct from old.assigned_doctor_id then
      perform public.append_audit_log(
        'referral_doctor_assigned',
        'referral',
        new.id,
        jsonb_build_object(
          'referral_number', new.referral_number,
          'assigned_doctor_id', new.assigned_doctor_id
        )
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_referral_assignments on public.referrals;
create trigger trg_audit_referral_assignments
after update on public.referrals
for each row execute function public.audit_referral_assignment_changes();
