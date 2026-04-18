-- Central audit writer: runs as definer so inserts succeed for all authenticated actors (clinic, hospital, admin).
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
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.append_audit_log(text, text, uuid, jsonb) from public;
grant execute on function public.append_audit_log(text, text, uuid, jsonb) to authenticated;
grant execute on function public.append_audit_log(text, text, uuid, jsonb) to service_role;

-- Referrals: log creates and status transitions (same trigger as status history).
create or replace function public.log_referral_status_change()
returns trigger
language plpgsql
set search_path = public
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

-- Referral thread messages (clinic + hospital).
create or replace function public.audit_referral_message_insert()
returns trigger
language plpgsql
set search_path = public
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

drop trigger if exists trg_audit_referral_message on public.referral_messages;
create trigger trg_audit_referral_message
  after insert on public.referral_messages
  for each row execute function public.audit_referral_message_insert();

-- File uploads on referrals.
create or replace function public.audit_referral_attachment_insert()
returns trigger
language plpgsql
set search_path = public
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

drop trigger if exists trg_audit_referral_attachment on public.referral_attachments;
create trigger trg_audit_referral_attachment
  after insert on public.referral_attachments
  for each row execute function public.audit_referral_attachment_insert();

-- Hospital doctor directory (hospital_admin / hospital_staff).
create or replace function public.audit_doctor_change()
returns trigger
language plpgsql
set search_path = public
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

drop trigger if exists trg_audit_doctor on public.doctors;
create trigger trg_audit_doctor
  after insert or update or delete on public.doctors
  for each row execute function public.audit_doctor_change();
