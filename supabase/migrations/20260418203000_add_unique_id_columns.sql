-- Human-readable public IDs for search, support, and cross-portal display.
-- Prefixes keep values unique across entity types when shown together.

alter table public.profiles add column if not exists unique_id text;
alter table public.clinics add column if not exists unique_id text;
alter table public.hospitals add column if not exists unique_id text;
alter table public.doctors add column if not exists unique_id text;
alter table public.referrals add column if not exists unique_id text;

update public.profiles set unique_id = 'USR-' || replace(id::text, '-', '') where unique_id is null;
update public.clinics set unique_id = 'CLN-' || replace(id::text, '-', '') where unique_id is null;
update public.hospitals set unique_id = 'HSP-' || replace(id::text, '-', '') where unique_id is null;
update public.doctors set unique_id = 'DOC-' || replace(id::text, '-', '') where unique_id is null;
update public.referrals set unique_id = 'RX-' || replace(id::text, '-', '') where unique_id is null;

create unique index if not exists uq_profiles_unique_id on public.profiles (unique_id);
create unique index if not exists uq_clinics_unique_id on public.clinics (unique_id);
create unique index if not exists uq_hospitals_unique_id on public.hospitals (unique_id);
create unique index if not exists uq_doctors_unique_id on public.doctors (unique_id);
create unique index if not exists uq_referrals_unique_id on public.referrals (unique_id);

create or replace function public.assign_unique_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'profiles' and new.unique_id is null then
    new.unique_id := 'USR-' || replace(new.id::text, '-', '');
  elsif tg_table_name = 'clinics' and new.unique_id is null then
    new.unique_id := 'CLN-' || replace(new.id::text, '-', '');
  elsif tg_table_name = 'hospitals' and new.unique_id is null then
    new.unique_id := 'HSP-' || replace(new.id::text, '-', '');
  elsif tg_table_name = 'doctors' and new.unique_id is null then
    new.unique_id := 'DOC-' || replace(new.id::text, '-', '');
  elsif tg_table_name = 'referrals' and new.unique_id is null then
    new.unique_id := 'RX-' || replace(new.id::text, '-', '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_unique_id on public.profiles;
create trigger trg_profiles_unique_id
  before insert on public.profiles
  for each row execute function public.assign_unique_id();

drop trigger if exists trg_clinics_unique_id on public.clinics;
create trigger trg_clinics_unique_id
  before insert on public.clinics
  for each row execute function public.assign_unique_id();

drop trigger if exists trg_hospitals_unique_id on public.hospitals;
create trigger trg_hospitals_unique_id
  before insert on public.hospitals
  for each row execute function public.assign_unique_id();

drop trigger if exists trg_doctors_unique_id on public.doctors;
create trigger trg_doctors_unique_id
  before insert on public.doctors
  for each row execute function public.assign_unique_id();

drop trigger if exists trg_referrals_unique_id on public.referrals;
create trigger trg_referrals_unique_id
  before insert on public.referrals
  for each row execute function public.assign_unique_id();

notify pgrst, 'reload schema';
