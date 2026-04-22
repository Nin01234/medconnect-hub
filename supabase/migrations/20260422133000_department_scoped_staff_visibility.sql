alter table public.referrals
add column if not exists visible_to_all_departments boolean not null default false;

create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

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
      or visible_to_all_departments = true
      or department_id = public.current_department_id()
      or department_id is null
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
      or visible_to_all_departments = true
      or department_id = public.current_department_id()
      or department_id is null
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
      or visible_to_all_departments = true
      or department_id = public.current_department_id()
      or department_id is null
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

    if new.visible_to_all_departments is distinct from old.visible_to_all_departments then
      perform public.append_audit_log(
        'referral_visibility_changed',
        'referral',
        new.id,
        jsonb_build_object(
          'referral_number', new.referral_number,
          'visible_to_all_departments', new.visible_to_all_departments
        )
      );
    end if;
  end if;
  return new;
end;
$$;
