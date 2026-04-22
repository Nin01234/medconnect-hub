create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_departments_hospital_name
  on public.departments (hospital_id, lower(name));

create index if not exists idx_departments_hospital
  on public.departments (hospital_id);

alter table public.departments enable row level security;

drop policy if exists "view departments scoped" on public.departments;
create policy "view departments scoped" on public.departments
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or hospital_id = public.current_hospital_id()
);

drop policy if exists "hospital admin manage departments" on public.departments;
create policy "hospital admin manage departments" on public.departments
for all to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'hospital_admin') and hospital_id = public.current_hospital_id())
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (public.has_role(auth.uid(), 'hospital_admin') and hospital_id = public.current_hospital_id())
);

alter table public.profiles
add column if not exists department_id uuid references public.departments(id) on delete set null;

alter table public.referrals
add column if not exists department_id uuid references public.departments(id) on delete set null;
