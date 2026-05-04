-- Align patient RPC + RLS with clinic referral permissions.
-- Clinic admins and clinic staff should be able to create/update
-- patient records within their own clinic.

create or replace function public.upsert_patient_for_clinic(
  p_clinic_id uuid,
  p_full_name text,
  p_age int default null,
  p_gender public.gender_type default null,
  p_phone text default null
)
returns uuid
language plpgsql
security invoker
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
    or (
      p_clinic_id = public.current_clinic_id()
      and (
        public.has_role(auth.uid(), 'clinic_user')
        or public.has_role(auth.uid(), 'clinic_admin')
        or public.has_role(auth.uid(), 'clinic_staff')
      )
    )
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

drop policy if exists "clinic insert patients" on public.patients;
create policy "clinic insert patients" on public.patients
for insert
to authenticated
with check (
  public.has_role(auth.uid(), 'admin')
  or (
    clinic_id = public.current_clinic_id()
    and (
      public.has_role(auth.uid(), 'clinic_user')
      or public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
);

drop policy if exists "clinic update patients" on public.patients;
create policy "clinic update patients" on public.patients
for update
to authenticated
using (
  public.has_role(auth.uid(), 'admin')
  or (
    clinic_id = public.current_clinic_id()
    and (
      public.has_role(auth.uid(), 'clinic_user')
      or public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
)
with check (
  public.has_role(auth.uid(), 'admin')
  or (
    clinic_id = public.current_clinic_id()
    and (
      public.has_role(auth.uid(), 'clinic_user')
      or public.has_role(auth.uid(), 'clinic_admin')
      or public.has_role(auth.uid(), 'clinic_staff')
    )
  )
);
