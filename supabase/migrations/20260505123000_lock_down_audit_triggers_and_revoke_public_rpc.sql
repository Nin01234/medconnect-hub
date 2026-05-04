-- Harden audit path: block PostgREST RPC to append_audit_log() for end users.
-- Trigger functions are SECURITY DEFINER (owner postgres) so they may call append_audit_log
-- without granting EXECUTE to the authenticated role.

-- ---------------------------------------------------------------------------
-- append_audit_log
-- ---------------------------------------------------------------------------
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

  if length(coalesce(p_action, '')) > 200 or length(coalesce(p_entity_type, '')) > 120 then
    raise exception 'append_audit_log: action or entity_type too long';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

alter function public.append_audit_log(text, text, uuid, jsonb) owner to postgres;

revoke all on function public.append_audit_log(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.append_audit_log(text, text, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Referrals: status history + audit (must bypass RLS on referral_status_history inserts)
-- ---------------------------------------------------------------------------
create or replace function public.log_referral_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.referral_status_history(referral_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
    perform public.append_audit_log(
      'referral_created',
      'referral',
      new.id,
      jsonb_build_object(
        'status', new.status,
        'referral_number', new.referral_number,
        'clinic_id', new.clinic_id,
        'hospital_id', new.hospital_id
      )
    );
  elsif (new.status is distinct from old.status) then
    insert into public.referral_status_history(referral_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
    perform public.append_audit_log(
      'referral_status_changed',
      'referral',
      new.id,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'referral_number', new.referral_number
      )
    );
  end if;
  return new;
end;
$$;

alter function public.log_referral_status_change() owner to postgres;
revoke all on function public.log_referral_status_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Messages / attachments / doctors
-- ---------------------------------------------------------------------------
create or replace function public.audit_referral_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.append_audit_log(
    'referral_message_sent',
    'referral_message',
    new.id,
    jsonb_build_object('referral_id', new.referral_id)
  );
  return new;
end;
$$;

alter function public.audit_referral_message_insert() owner to postgres;
revoke all on function public.audit_referral_message_insert() from public, anon, authenticated;

create or replace function public.audit_referral_attachment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.append_audit_log(
    'referral_attachment_uploaded',
    'referral_attachment',
    new.id,
    jsonb_build_object('referral_id', new.referral_id, 'file_name', new.file_name)
  );
  return new;
end;
$$;

alter function public.audit_referral_attachment_insert() owner to postgres;
revoke all on function public.audit_referral_attachment_insert() from public, anon, authenticated;

create or replace function public.audit_doctor_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_op = 'INSERT' then
    perform public.append_audit_log(
      'doctor_created',
      'doctor',
      new.id,
      jsonb_build_object('hospital_id', new.hospital_id, 'full_name', new.full_name)
    );
  elsif tg_op = 'UPDATE' then
    perform public.append_audit_log(
      'doctor_updated',
      'doctor',
      new.id,
      jsonb_build_object('hospital_id', new.hospital_id, 'full_name', new.full_name)
    );
  elsif tg_op = 'DELETE' then
    perform public.append_audit_log(
      'doctor_deleted',
      'doctor',
      old.id,
      jsonb_build_object('hospital_id', old.hospital_id, 'full_name', old.full_name)
    );
  end if;
  return coalesce(new, old);
end;
$$;

alter function public.audit_doctor_change() owner to postgres;
revoke all on function public.audit_doctor_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Referral assignment / visibility audit (latest logic from department migration)
-- ---------------------------------------------------------------------------
create or replace function public.audit_referral_assignment_changes()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
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

alter function public.audit_referral_assignment_changes() owner to postgres;
revoke all on function public.audit_referral_assignment_changes() from public, anon, authenticated;
