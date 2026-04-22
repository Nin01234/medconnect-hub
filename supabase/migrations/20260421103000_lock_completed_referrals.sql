create or replace function public.prevent_completed_referral_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'completed' and new is distinct from old then
    if not (
      public.has_role(auth.uid(), 'admin')
      or (
        public.has_role(auth.uid(), 'hospital_admin')
        and old.hospital_id = public.current_hospital_id()
      )
    ) then
      raise exception 'Completed referrals are locked and can only be modified by hospital admin.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_completed_referral_changes on public.referrals;
create trigger trg_prevent_completed_referral_changes
before update on public.referrals
for each row
execute function public.prevent_completed_referral_changes();

create or replace function public.prevent_messages_on_completed_referrals()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  referral_status public.referral_status;
  referral_hospital_id uuid;
begin
  select status, hospital_id into referral_status, referral_hospital_id
  from public.referrals
  where id = new.referral_id;

  if referral_status = 'completed' then
    if not (
      public.has_role(auth.uid(), 'admin')
      or (
        public.has_role(auth.uid(), 'hospital_admin')
        and referral_hospital_id = public.current_hospital_id()
      )
    ) then
      raise exception 'Completed referrals are locked and only hospital admin can add messages.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_messages_on_completed_referrals on public.referral_messages;
create trigger trg_prevent_messages_on_completed_referrals
before insert on public.referral_messages
for each row
execute function public.prevent_messages_on_completed_referrals();
