drop policy if exists "auth insert audit" on public.audit_logs;
create policy "self insert audit" on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid());