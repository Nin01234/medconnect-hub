create or replace function public.handle_department_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status = 'inactive' and old.status is distinct from new.status then
      update public.profiles p
      set status = 'suspended'
      where p.department_id = new.id
        and exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role = 'hospital_staff'
        );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.profiles p
    set status = 'suspended',
        department_id = null
    where p.department_id = old.id
      and exists (
        select 1
        from public.user_roles ur
        where ur.user_id = p.id
          and ur.role = 'hospital_staff'
      );

    delete from public.referrals r
    where r.department_id = old.id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_handle_department_lifecycle on public.departments;
create trigger trg_handle_department_lifecycle
after update or delete on public.departments
for each row
execute function public.handle_department_lifecycle();

create or replace function public.enforce_referral_assignment_actor_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_hospital_admin boolean;
  is_hospital_staff boolean;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  is_hospital_admin := public.has_role(auth.uid(), 'hospital_admin');
  is_hospital_staff := public.has_role(auth.uid(), 'hospital_staff');

  if is_hospital_admin then
    if new.assigned_staff_id is distinct from old.assigned_staff_id then
      raise exception 'Hospital admin cannot assign staff to referrals.';
    end if;
    if new.assigned_doctor_id is distinct from old.assigned_doctor_id then
      raise exception 'Hospital admin cannot assign doctors to referrals.';
    end if;
  end if;

  if is_hospital_staff then
    if new.department_id is distinct from old.department_id
      or new.assigned_department is distinct from old.assigned_department then
      raise exception 'Hospital staff cannot assign departments. Hospital admin must assign department.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_referral_assignment_actor_rules on public.referrals;
create trigger trg_enforce_referral_assignment_actor_rules
before update on public.referrals
for each row
execute function public.enforce_referral_assignment_actor_rules();

do $$
begin
  if to_regclass('public.doctors') is not null then
    execute 'drop policy if exists "hospital admin manage doctors" on public.doctors';
    execute $policy$
      create policy "hospital staff manage doctors" on public.doctors
      for all to authenticated
      using (
        public.has_role(auth.uid(),''admin'')
        or (public.has_role(auth.uid(),''hospital_staff'') and hospital_id = public.current_hospital_id())
      )
      with check (
        public.has_role(auth.uid(),''admin'')
        or (public.has_role(auth.uid(),''hospital_staff'') and hospital_id = public.current_hospital_id())
      )
    $policy$;
  end if;
end
$$;
