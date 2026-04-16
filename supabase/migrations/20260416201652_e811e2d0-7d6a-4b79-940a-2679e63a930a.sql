
-- =========================
-- ENUMS
-- =========================
create type public.app_role as enum ('admin','hospital_admin','hospital_staff','clinic_user','doctor');
create type public.referral_status as enum ('draft','submitted','new','under_review','info_requested','accepted','rejected','assigned','treated','completed');
create type public.urgency_level as enum ('low','medium','high','critical');
create type public.gender_type as enum ('male','female','other');
create type public.clinic_type as enum ('CHPS','Polyclinic','Private Clinic','Health Center','Other');
create type public.hospital_type as enum ('District','Regional','Teaching','Military','Private','Other');
create type public.ownership_type as enum ('Private','Government','Mission','Other');

-- =========================
-- TIMESTAMP TRIGGER
-- =========================
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- =========================
-- CLINICS
-- =========================
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.clinic_type not null default 'Other',
  region text,
  city text,
  address text,
  gps_code text,
  contact text,
  email text,
  ownership_type public.ownership_type default 'Private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_clinics_updated before update on public.clinics
  for each row execute function public.update_updated_at_column();

-- =========================
-- HOSPITALS
-- =========================
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.hospital_type not null default 'Other',
  region text,
  city text,
  address text,
  gps_code text,
  contact text,
  email text,
  departments text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_hospitals_updated before update on public.hospitals
  for each row execute function public.update_updated_at_column();

-- =========================
-- PROFILES
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  status text not null default 'active',
  clinic_id uuid references public.clinics(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- =========================
-- USER ROLES (separate table - security best practice)
-- =========================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);

-- =========================
-- DOCTORS
-- =========================
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  specialty text,
  phone text,
  email text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_doctors_updated before update on public.doctors
  for each row execute function public.update_updated_at_column();

-- =========================
-- REFERRALS
-- =========================
create sequence public.referral_seq start 1;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_number text unique,
  patient_name text not null,
  patient_age int,
  patient_gender public.gender_type,
  patient_phone text,
  diagnosis text,
  symptoms text,
  urgency_level public.urgency_level not null default 'medium',
  referral_reason text,
  notes text,
  status public.referral_status not null default 'submitted',
  rejection_reason text,
  hospital_feedback text,
  clinic_id uuid references public.clinics(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  assigned_doctor_id uuid references public.doctors(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_referrals_hospital on public.referrals(hospital_id);
create index idx_referrals_clinic on public.referrals(clinic_id);
create index idx_referrals_status on public.referrals(status);

create or replace function public.set_referral_number()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.referral_number is null then
    new.referral_number := 'REF-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.referral_seq')::text, 6, '0');
  end if;
  return new;
end; $$;
create trigger trg_referral_number before insert on public.referrals
  for each row execute function public.set_referral_number();
create trigger trg_referrals_updated before update on public.referrals
  for each row execute function public.update_updated_at_column();

-- =========================
-- REFERRAL ATTACHMENTS / MESSAGES / HISTORY
-- =========================
create table public.referral_attachments (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.referral_messages (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);
create index idx_messages_referral on public.referral_messages(referral_id);

create table public.referral_status_history (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referrals(id) on delete cascade,
  from_status public.referral_status,
  to_status public.referral_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index idx_history_referral on public.referral_status_history(referral_id);

create or replace function public.log_referral_status_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.referral_status_history(referral_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif (new.status is distinct from old.status) then
    insert into public.referral_status_history(referral_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end; $$;
create trigger trg_log_referral_insert after insert on public.referrals
  for each row execute function public.log_referral_status_change();
create trigger trg_log_referral_update after update on public.referrals
  for each row execute function public.log_referral_status_change();

-- =========================
-- AUDIT LOGS
-- =========================
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- =========================
-- SECURITY DEFINER HELPERS (avoid recursive RLS)
-- =========================
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.current_clinic_id()
returns uuid language sql stable security definer set search_path = public as $$
  select clinic_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_hospital_id()
returns uuid language sql stable security definer set search_path = public as $$
  select hospital_id from public.profiles where id = auth.uid();
$$;

-- =========================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'phone'
  );
  -- default role: clinic_user (admin will reassign as needed)
  insert into public.user_roles(user_id, role) values (new.id, 'clinic_user');
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- ENABLE RLS
-- =========================
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.clinics enable row level security;
alter table public.hospitals enable row level security;
alter table public.doctors enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_attachments enable row level security;
alter table public.referral_messages enable row level security;
alter table public.referral_status_history enable row level security;
alter table public.audit_logs enable row level security;

-- PROFILES
create policy "view own profile" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin insert profiles" on public.profiles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));

-- USER_ROLES (only admins manage; users see their own)
create policy "view own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- CLINICS: all authenticated can read; only admin write
create policy "auth read clinics" on public.clinics for select to authenticated using (true);
create policy "admin write clinics" on public.clinics for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- HOSPITALS
create policy "auth read hospitals" on public.hospitals for select to authenticated using (true);
create policy "admin write hospitals" on public.hospitals for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- DOCTORS
create policy "view doctors of my hospital" on public.doctors for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or hospital_id = public.current_hospital_id()
    or hospital_id in (select hospital_id from public.referrals where clinic_id = public.current_clinic_id())
  );
create policy "hospital admin manage doctors" on public.doctors for all to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'hospital_admin') and hospital_id = public.current_hospital_id())
  )
  with check (
    public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'hospital_admin') and hospital_id = public.current_hospital_id())
  );

-- REFERRALS
create policy "view referrals scoped" on public.referrals for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or (clinic_id is not null and clinic_id = public.current_clinic_id())
    or (hospital_id is not null and hospital_id = public.current_hospital_id())
  );
create policy "clinic create referrals" on public.referrals for insert to authenticated
  with check (
    public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'clinic_user') and clinic_id = public.current_clinic_id() and created_by = auth.uid())
  );
create policy "update referrals scoped" on public.referrals for update to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or (clinic_id = public.current_clinic_id() and status in ('draft','submitted','info_requested'))
    or (hospital_id = public.current_hospital_id())
  )
  with check (
    public.has_role(auth.uid(),'admin')
    or clinic_id = public.current_clinic_id()
    or hospital_id = public.current_hospital_id()
  );

-- ATTACHMENTS/MESSAGES/HISTORY: gated by parent referral visibility
create policy "view attachments via referral" on public.referral_attachments for select to authenticated
  using (exists (select 1 from public.referrals r where r.id = referral_id and (
    public.has_role(auth.uid(),'admin')
    or r.clinic_id = public.current_clinic_id()
    or r.hospital_id = public.current_hospital_id()
  )));
create policy "insert attachments via referral" on public.referral_attachments for insert to authenticated
  with check (exists (select 1 from public.referrals r where r.id = referral_id and (
    public.has_role(auth.uid(),'admin')
    or r.clinic_id = public.current_clinic_id()
    or r.hospital_id = public.current_hospital_id()
  )));

create policy "view messages via referral" on public.referral_messages for select to authenticated
  using (exists (select 1 from public.referrals r where r.id = referral_id and (
    public.has_role(auth.uid(),'admin')
    or r.clinic_id = public.current_clinic_id()
    or r.hospital_id = public.current_hospital_id()
  )));
create policy "send messages via referral" on public.referral_messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from public.referrals r where r.id = referral_id and (
    public.has_role(auth.uid(),'admin')
    or r.clinic_id = public.current_clinic_id()
    or r.hospital_id = public.current_hospital_id()
  )));

create policy "view history via referral" on public.referral_status_history for select to authenticated
  using (exists (select 1 from public.referrals r where r.id = referral_id and (
    public.has_role(auth.uid(),'admin')
    or r.clinic_id = public.current_clinic_id()
    or r.hospital_id = public.current_hospital_id()
  )));

-- AUDIT LOGS: admin only
create policy "admin read audit" on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "auth insert audit" on public.audit_logs for insert to authenticated with check (true);

-- =========================
-- STORAGE BUCKET
-- =========================
insert into storage.buckets (id, name, public) values ('referral-attachments','referral-attachments', false)
  on conflict (id) do nothing;

create policy "auth read referral files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'referral-attachments'
    and exists (
      select 1 from public.referrals r
      where r.id::text = (storage.foldername(name))[1]
        and (
          public.has_role(auth.uid(),'admin')
          or r.clinic_id = public.current_clinic_id()
          or r.hospital_id = public.current_hospital_id()
        )
    )
  );

create policy "clinic upload referral files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'referral-attachments'
    and exists (
      select 1 from public.referrals r
      where r.id::text = (storage.foldername(name))[1]
        and (
          public.has_role(auth.uid(),'admin')
          or r.clinic_id = public.current_clinic_id()
          or r.hospital_id = public.current_hospital_id()
        )
    )
  );

-- =========================
-- REALTIME
-- =========================
alter publication supabase_realtime add table public.referrals;
alter publication supabase_realtime add table public.referral_messages;
alter publication supabase_realtime add table public.referral_status_history;
