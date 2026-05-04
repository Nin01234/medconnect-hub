-- Fix "stack depth limit exceeded" when inserting referrals (and related RPC).
--
-- Cause: migration 20260427124000_security_advisor_definer_hardening.sql set
-- has_role / current_* helpers to SECURITY INVOKER. Policies on user_roles and
-- profiles call has_role() and current_*(); those queries re-enter RLS → infinite
-- recursion until stack overflow.
--
-- Fix: force SECURITY DEFINER + SET row_security = OFF on helpers (same as
-- 20260427143500_fix_recursive_rls_helper_functions.sql). Re-apply even if a DB
-- missed that migration or order diverged on remote.
--
-- append_audit_log: SECURITY DEFINER + row_security off so audit inserts never
-- participate in recursive policy evaluation; require auth.uid() for inserts.

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

create or replace function public.append_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'append_audit_log requires an authenticated user';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.append_audit_log(text, text, uuid, jsonb) from public;
grant execute on function public.append_audit_log(text, text, uuid, jsonb) to authenticated;
grant execute on function public.append_audit_log(text, text, uuid, jsonb) to service_role;
