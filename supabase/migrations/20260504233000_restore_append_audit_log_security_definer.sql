-- Referral submit runs AFTER INSERT trigger → log_referral_status_change → append_audit_log.
-- SECURITY INVOKER (see 20260427124000_security_advisor_definer_hardening.sql) caused
-- "permission denied for function append_audit_log" during inserts: the audit writer must
-- run as definer so audit rows are recorded reliably from triggers. Do not call this RPC
-- from the client — triggers and DB-only paths only.

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
