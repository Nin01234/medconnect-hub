-- =============================================================================
-- Department-scoped patient access
-- Problem: patients table is clinic-scoped (clinic_id). Department-linked
--          users (clinic_admin, clinic_staff) have clinic_id = NULL so every
--          RLS check "clinic_id = current_clinic_id()" evaluates to NULL = NULL
--          which is always false in SQL → 403/RLS violation on patient insert.
-- Fix:
--   1. Add department_id column to patients.
--   2. Add current_department_id() helper.
--   3. Update patients RLS to accept department-scoped rows.
--   4. Add upsert_patient_for_department() RPC for dept users.
-- =============================================================================

-- 1. Add department_id to patients (nullable, backward-compatible)
alter table public.patients
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_patients_department on public.patients(department_id);

-- 2. current_department_id() helper (mirrors current_clinic_id pattern)
create or replace function public.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_department_id() from public, anon;
grant execute on function public.current_department_id() to authenticated;

-- 3. RLS policies — drop & recreate to add department scope
drop policy if exists "clinic insert patients" on public.patients;
create policy "clinic insert patients" on public.patients
for insert to authenticated
with check (
  -- Super-admin
  public.has_role(auth.uid(), 'admin')
  -- Clinic-linked users (clinic_user, clinic_admin, clinic_staff with clinic_id)
  or (
    clinic_id is not null
    and clinic_id = public.current_clinic_id()
    and (
      public.has_role(auth.uid(), 'clinic_user')
      or public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
  -- Department-linked users (clinic_admin, clinic_staff with department_id, no clinic_id)
  or (
    clinic_id is null
    and department_id is not null
    and department_id = public.current_department_id()
    and (
      public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
);

drop policy if exists "clinic update patients" on public.patients;
create policy "clinic update patients" on public.patients
for update to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    clinic_id is not null
    and clinic_id = public.current_clinic_id()
    and (
      public.has_role(auth.uid(), 'clinic_user')
      or public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
  or (
    clinic_id is null
    and department_id is not null
    and department_id = public.current_department_id()
    and (
      public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (
    clinic_id is not null
    and clinic_id = public.current_clinic_id()
    and (
      public.has_role(auth.uid(), 'clinic_user')
      or public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
  or (
    clinic_id is null
    and department_id is not null
    and department_id = public.current_department_id()
    and (
      public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
);

-- Also extend the SELECT policy so dept users can see their own patients
drop policy if exists "view patients scoped" on public.patients;
create policy "view patients scoped" on public.patients
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  -- Clinic-linked
  or (clinic_id is not null and clinic_id = public.current_clinic_id())
  -- Department-linked
  or (
    clinic_id is null
    and department_id is not null
    and department_id = public.current_department_id()
  )
  -- Hospital staff / admin can see via referrals
  or exists (
    select 1 from public.referrals r
    where r.patient_id = patients.id
      and (
        r.hospital_id = public.current_hospital_id()
        or r.department_id = public.current_department_id()
      )
  )
);

-- 4. upsert_patient_for_department RPC
create or replace function public.upsert_patient_for_department(
  p_department_id uuid,
  p_full_name    text,
  p_age          int  default null,
  p_gender       public.gender_type default null,
  p_phone        text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_full_name  text;
  v_phone      text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Only clinic_admin / clinic_staff whose department matches
  if not (
    public.has_role(auth.uid(), 'admin')
    or (
      p_department_id = public.current_department_id()
      and (
        public.has_role(auth.uid(), 'clinic_admin')
        or public.has_role(auth.uid(), 'clinic_staff')
      )
    )
  ) then
    raise exception 'Not allowed to manage patients for this department';
  end if;

  v_full_name := trim(coalesce(p_full_name, ''));
  if v_full_name = '' then
    raise exception 'Patient name is required';
  end if;
  v_phone := nullif(trim(coalesce(p_phone, '')), '');

  -- Try to find an existing patient in this department
  select id into v_patient_id
  from public.patients
  where department_id = p_department_id
    and clinic_id is null
    and lower(trim(full_name)) = lower(v_full_name)
    and coalesce(nullif(trim(phone), ''), '') = coalesce(v_phone, '')
  order by updated_at desc
  limit 1;

  if v_patient_id is null then
    insert into public.patients (clinic_id, department_id, full_name, age, gender, phone, created_by)
    values (null, p_department_id, v_full_name, p_age, p_gender, v_phone, auth.uid())
    returning id into v_patient_id;
  else
    update public.patients
    set
      full_name  = v_full_name,
      age        = coalesce(p_age, age),
      gender     = coalesce(p_gender, gender),
      phone      = coalesce(v_phone, phone),
      updated_at = now()
    where id = v_patient_id;
  end if;

  return v_patient_id;
end;
$$;

grant execute on function public.upsert_patient_for_department(uuid, text, int, public.gender_type, text) to authenticated;
