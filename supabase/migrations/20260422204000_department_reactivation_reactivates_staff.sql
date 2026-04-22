create or replace function public.handle_department_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'inactive' then
        update public.profiles p
        set status = 'suspended'
        where p.department_id = new.id
          and exists (
            select 1
            from public.user_roles ur
            where ur.user_id = p.id
              and ur.role = 'hospital_staff'
          );
      elsif new.status = 'active' then
        update public.profiles p
        set status = 'active'
        where p.department_id = new.id
          and exists (
            select 1
            from public.user_roles ur
            where ur.user_id = p.id
              and ur.role = 'hospital_staff'
          );
      end if;
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
