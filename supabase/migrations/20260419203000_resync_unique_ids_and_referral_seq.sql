-- One-time resync: rebuild public unique_id values from stable UUIDs (same rules as assign_unique_id).
-- Realign referral_seq with existing REF-YYYY-NNNNNN values so the next insert does not duplicate referral_number.

update public.profiles set unique_id = 'USR-' || replace(id::text, '-', '');
update public.clinics set unique_id = 'CLN-' || replace(id::text, '-', '');
update public.hospitals set unique_id = 'HSP-' || replace(id::text, '-', '');
update public.doctors set unique_id = 'DOC-' || replace(id::text, '-', '');
update public.referrals set unique_id = 'RX-' || replace(id::text, '-', '');

-- Empty DB: setval(1, false) so the next nextval() is 1 (REF-*-000001).
-- Otherwise: setval(max_suffix, true) so the next nextval() is max_suffix + 1.
do $$
declare
  max_suffix bigint;
begin
  select max((regexp_replace(referral_number, '^REF-[0-9]{4}-', ''))::bigint)
  into max_suffix
  from public.referrals
  where referral_number is not null
    and referral_number ~ '^REF-[0-9]{4}-[0-9]+$';

  if max_suffix is null then
    perform setval('public.referral_seq', 1, false);
  else
    perform setval('public.referral_seq', max_suffix, true);
  end if;
end $$;
