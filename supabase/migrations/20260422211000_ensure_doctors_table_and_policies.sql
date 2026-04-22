create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  unique_id text,
  full_name text not null,
  specialty text,
  phone text,
  email text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.doctors add column if not exists unique_id text;
alter table public.doctors add column if not exists status text not null default 'active';

update public.doctors
set unique_id = 'DOC-' || replace(id::text, '-', '')
where unique_id is null;

create unique index if not exists uq_doctors_unique_id on public.doctors (unique_id);
create index if not exists idx_doctors_hospital_id on public.doctors (hospital_id);
create index if not exists idx_doctors_status on public.doctors (status);

alter table public.doctors enable row level security;

drop trigger if exists trg_doctors_updated on public.doctors;
create trigger trg_doctors_updated
before update on public.doctors
for each row execute function public.update_updated_at_column();

drop trigger if exists trg_doctors_unique_id on public.doctors;
create trigger trg_doctors_unique_id
before insert on public.doctors
for each row execute function public.assign_unique_id();

drop policy if exists "view doctors of my hospital" on public.doctors;
create policy "view doctors of my hospital" on public.doctors
for select to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or hospital_id = public.current_hospital_id()
  or hospital_id in (select hospital_id from public.referrals where clinic_id = public.current_clinic_id())
);

drop policy if exists "hospital admin manage doctors" on public.doctors;
drop policy if exists "hospital staff manage doctors" on public.doctors;
create policy "hospital staff manage doctors" on public.doctors
for all to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or (public.has_role(auth.uid(),'hospital_staff') and hospital_id = public.current_hospital_id())
)
with check (
  public.has_role(auth.uid(),'admin')
  or (public.has_role(auth.uid(),'hospital_staff') and hospital_id = public.current_hospital_id())
);

notify pgrst, 'reload schema';
