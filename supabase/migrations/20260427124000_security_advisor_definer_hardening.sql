-- Harden SECURITY DEFINER exposure reported by Supabase Security Advisor.
-- Keep app behavior while reducing externally callable privileged surfaces.

-- 1) Helper functions used by RLS: run as invoker, not definer.
alter function public.has_role(uuid, public.app_role) security invoker;
alter function public.current_clinic_id() security invoker;
alter function public.current_hospital_id() security invoker;
alter function public.current_department_id() security invoker;

-- 2) RPC used by clinic referral flow: run as invoker.
alter function public.upsert_patient_for_clinic(uuid, text, int, public.gender_type, text) security invoker;

-- 3) Audit writer is called from trigger code paths; remove definer privilege.
alter function public.append_audit_log(text, text, uuid, jsonb) security invoker;

-- 4) Internal trigger-maintenance functions must not be remotely callable.
revoke all on function public.refresh_staff_directory(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refresh_staff_directory_from_profiles() from public, anon, authenticated;
revoke all on function public.refresh_staff_directory_from_roles() from public, anon, authenticated;
revoke all on function public.refresh_department_staff_snapshot(uuid) from public, anon, authenticated;

-- 5) Username/email resolver moved to edge function; block PostgREST RPC access.
revoke all on function public.resolve_login_identifier(text) from public, anon, authenticated;
grant execute on function public.resolve_login_identifier(text) to service_role;
