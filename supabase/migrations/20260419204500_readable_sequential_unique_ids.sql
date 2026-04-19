-- Replace UUID-derived unique_id strings (32 hex chars) with short sequential codes:
-- USR-000001, CLN-000001, HSP-000001, DOC-000001, RX-000001.
-- (referral_number REF-YYYY-NNNNNN is unchanged; this only affects unique_id / RX-*.)

create sequence if not exists public.profile_unique_seq;
create sequence if not exists public.clinic_unique_seq;
create sequence if not exists public.hospital_unique_seq;
create sequence if not exists public.doctor_unique_seq;
create sequence if not exists public.referral_rx_seq;

update public.profiles p
set unique_id = sub.new_uid
from (
  select id, 'USR-' || lpad(row_number() over (order by created_at asc nulls last, id)::text, 6, '0') as new_uid
  from public.profiles
) sub
where p.id = sub.id;

update public.clinics c
set unique_id = sub.new_uid
from (
  select id, 'CLN-' || lpad(row_number() over (order by created_at asc nulls last, id)::text, 6, '0') as new_uid
  from public.clinics
) sub
where c.id = sub.id;

update public.hospitals h
set unique_id = sub.new_uid
from (
  select id, 'HSP-' || lpad(row_number() over (order by created_at asc nulls last, id)::text, 6, '0') as new_uid
  from public.hospitals
) sub
where h.id = sub.id;

update public.doctors d
set unique_id = sub.new_uid
from (
  select id, 'DOC-' || lpad(row_number() over (order by created_at asc nulls last, id)::text, 6, '0') as new_uid
  from public.doctors
) sub
where d.id = sub.id;

update public.referrals r
set unique_id = sub.new_uid
from (
  select id, 'RX-' || lpad(row_number() over (order by created_at asc nulls last, id)::text, 6, '0') as new_uid
  from public.referrals
) sub
where r.id = sub.id;

create or replace function public.assign_unique_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'profiles' and new.unique_id is null then
    new.unique_id := 'USR-' || lpad(nextval('public.profile_unique_seq')::text, 6, '0');
  elsif tg_table_name = 'clinics' and new.unique_id is null then
    new.unique_id := 'CLN-' || lpad(nextval('public.clinic_unique_seq')::text, 6, '0');
  elsif tg_table_name = 'hospitals' and new.unique_id is null then
    new.unique_id := 'HSP-' || lpad(nextval('public.hospital_unique_seq')::text, 6, '0');
  elsif tg_table_name = 'doctors' and new.unique_id is null then
    new.unique_id := 'DOC-' || lpad(nextval('public.doctor_unique_seq')::text, 6, '0');
  elsif tg_table_name = 'referrals' and new.unique_id is null then
    new.unique_id := 'RX-' || lpad(nextval('public.referral_rx_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

do $$
declare
  mx bigint;
begin
  select coalesce(max(substring(unique_id from 5)::bigint), 0) into mx
  from public.profiles where unique_id ~ '^USR-[0-9]+$';
  if mx = 0 then perform setval('public.profile_unique_seq', 1, false);
  else perform setval('public.profile_unique_seq', mx, true);
  end if;

  select coalesce(max(substring(unique_id from 5)::bigint), 0) into mx
  from public.clinics where unique_id ~ '^CLN-[0-9]+$';
  if mx = 0 then perform setval('public.clinic_unique_seq', 1, false);
  else perform setval('public.clinic_unique_seq', mx, true);
  end if;

  select coalesce(max(substring(unique_id from 5)::bigint), 0) into mx
  from public.hospitals where unique_id ~ '^HSP-[0-9]+$';
  if mx = 0 then perform setval('public.hospital_unique_seq', 1, false);
  else perform setval('public.hospital_unique_seq', mx, true);
  end if;

  select coalesce(max(substring(unique_id from 5)::bigint), 0) into mx
  from public.doctors where unique_id ~ '^DOC-[0-9]+$';
  if mx = 0 then perform setval('public.doctor_unique_seq', 1, false);
  else perform setval('public.doctor_unique_seq', mx, true);
  end if;

  select coalesce(max(substring(unique_id from 4)::bigint), 0) into mx
  from public.referrals where unique_id ~ '^RX-[0-9]+$';
  if mx = 0 then perform setval('public.referral_rx_seq', 1, false);
  else perform setval('public.referral_rx_seq', mx, true);
  end if;
end $$;

notify pgrst, 'reload schema';
