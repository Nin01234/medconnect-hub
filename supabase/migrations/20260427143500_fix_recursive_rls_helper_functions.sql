-- Prevent recursive RLS evaluation by forcing helper functions
-- to run as SECURITY DEFINER PL/pgSQL with row_security disabled.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_has_role boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  )
  into v_has_role;

  return coalesce(v_has_role, false);
end;
$$;

create or replace function public.current_clinic_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_clinic_id uuid;
begin
  select p.clinic_id
  into v_clinic_id
  from public.profiles p
  where p.id = auth.uid();

  return v_clinic_id;
end;
$$;

create or replace function public.current_hospital_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_hospital_id uuid;
begin
  select p.hospital_id
  into v_hospital_id
  from public.profiles p
  where p.id = auth.uid();

  return v_hospital_id;
end;
$$;

create or replace function public.current_department_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_department_id uuid;
begin
  select p.department_id
  into v_department_id
  from public.profiles p
  where p.id = auth.uid();

  return v_department_id;
end;
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke all on function public.current_clinic_id() from public, anon;
grant execute on function public.current_clinic_id() to authenticated, service_role;

revoke all on function public.current_hospital_id() from public, anon;
grant execute on function public.current_hospital_id() to authenticated, service_role;

revoke all on function public.current_department_id() from public, anon;
grant execute on function public.current_department_id() to authenticated, service_role;
