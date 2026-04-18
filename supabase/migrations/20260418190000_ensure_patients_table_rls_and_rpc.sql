-- Idempotent repair when patients + RLS never landed (e.g. partial / skipped migration).
-- Safe to re-run: uses IF NOT EXISTS, DROP POLICY IF EXISTS, guarded publication add.

-- ==================================
-- PATIENTS (canonical profile)
-- ==================================
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  age int,
  gender public.gender_type,
  phone text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patients_clinic on public.patients(clinic_id);
create index if not exists idx_patients_name on public.patients(lower(full_name));
create index if not exists idx_patients_phone on public.patients(phone);

drop trigger if exists trg_patients_updated on public.patients;
create trigger trg_patients_updated before update on public.patients
  for each row execute function public.update_updated_at_column();

-- ==================================
-- REFERRALS: patient_id link
-- ==================================
alter table public.referrals
  add column if not exists patient_id uuid references public.patients(id) on delete set null;

create index if not exists idx_referrals_patient_id on public.referrals(patient_id);

-- ==================================
-- BACKFILL PATIENTS + LINKS (safe if empty)
-- ==================================
insert into public.patients (clinic_id, full_name, age, gender, phone, created_by)
select distinct on (r.clinic_id, lower(trim(r.patient_name)), coalesce(nullif(trim(r.patient_phone), ''), ''))
  r.clinic_id,
  trim(r.patient_name),
  r.patient_age,
  r.patient_gender,
  nullif(trim(r.patient_phone), ''),
  r.created_by
from public.referrals r
where r.clinic_id is not null
  and r.patient_name is not null
  and trim(r.patient_name) <> ''
order by
  r.clinic_id,
  lower(trim(r.patient_name)),
  coalesce(nullif(trim(r.patient_phone), ''), ''),
  r.created_at desc;

update public.referrals r
set patient_id = p.id
from public.patients p
where r.patient_id is null
  and r.clinic_id = p.clinic_id
  and lower(trim(r.patient_name)) = lower(trim(p.full_name))
  and coalesce(nullif(trim(r.patient_phone), ''), '') = coalesce(nullif(trim(p.phone), ''), '');

-- ==================================
-- RPC (depends on patients)
-- ==================================
create or replace function public.upsert_patient_for_clinic(
  p_clinic_id uuid,
  p_full_name text,
  p_age int default null,
  p_gender public.gender_type default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_full_name text;
  v_phone text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.has_role(auth.uid(), 'admin')
    or (public.has_role(auth.uid(), 'clinic_user') and p_clinic_id = public.current_clinic_id())
  ) then
    raise exception 'Not allowed to manage this clinic patient';
  end if;

  v_full_name := trim(coalesce(p_full_name, ''));
  if v_full_name = '' then
    raise exception 'Patient name is required';
  end if;
  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  select id into v_patient_id
  from public.patients
  where clinic_id = p_clinic_id
    and lower(trim(full_name)) = lower(v_full_name)
    and coalesce(nullif(trim(phone), ''), '') = coalesce(v_phone, '')
  order by updated_at desc
  limit 1;

  if v_patient_id is null then
    insert into public.patients (clinic_id, full_name, age, gender, phone, created_by)
    values (p_clinic_id, v_full_name, p_age, p_gender, v_phone, auth.uid())
    returning id into v_patient_id;
  else
    update public.patients
    set
      full_name = v_full_name,
      age = coalesce(p_age, age),
      gender = coalesce(p_gender, gender),
      phone = coalesce(v_phone, phone),
      updated_at = now()
    where id = v_patient_id;
  end if;

  return v_patient_id;
end;
$$;

grant execute on function public.upsert_patient_for_clinic(uuid, text, int, public.gender_type, text) to authenticated;

-- ==================================
-- RLS
-- ==================================
alter table public.patients enable row level security;

drop policy if exists "view patients scoped" on public.patients;
create policy "view patients scoped" on public.patients for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or clinic_id = public.current_clinic_id()
  or exists (
    select 1
    from public.referrals r
    where r.patient_id = patients.id
      and r.hospital_id = public.current_hospital_id()
  )
);

drop policy if exists "clinic insert patients" on public.patients;
create policy "clinic insert patients" on public.patients for insert to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'clinic_user') and clinic_id = public.current_clinic_id())
);

drop policy if exists "clinic update patients" on public.patients;
create policy "clinic update patients" on public.patients for update to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'clinic_user') and clinic_id = public.current_clinic_id())
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'clinic_user') and clinic_id = public.current_clinic_id())
);

-- ==================================
-- Realtime (skip if already added)
-- ==================================
do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'patients'
  ) then
    execute 'alter publication supabase_realtime add table public.patients';
  end if;
end
$pub$;

notify pgrst, 'reload schema';
