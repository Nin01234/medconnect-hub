-- 1. Drop old 4-parameter user_can_access_referral function cascade
drop function if exists public.user_can_access_referral(uuid, uuid, uuid, uuid) cascade;

-- 2. Create updated 6-parameter user_can_access_referral function
create or replace function public.user_can_access_referral(
  p_clinic_id uuid,
  p_hospital_id uuid,
  p_assigned_staff_id uuid,
  p_department_id uuid,
  p_source_department_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    -- Super Admin
    public.has_role((select auth.uid()), 'admin')
    
    -- Hospital Admin (can see all referrals in their hospital)
    or (
      p_hospital_id is not null
      and p_hospital_id = public.current_hospital_id()
      and public.has_role((select auth.uid()), 'hospital_admin')
    )
    
    -- Department Admin (clinic_admin role - sees sent and received referrals of their department)
    or (
      public.has_role((select auth.uid()), 'clinic_admin')
      and (
        (p_department_id is not null and p_department_id = public.current_department_id())
        or (p_source_department_id is not null and p_source_department_id = public.current_department_id())
      )
    )
    
    -- Department Staff (clinic_staff role - sees referrals they created or those assigned to them)
    or (
      public.has_role((select auth.uid()), 'clinic_staff')
      and (
        p_created_by = (select auth.uid())
        or (p_assigned_staff_id is not null and p_assigned_staff_id = (select auth.uid()))
      )
    )
    
    -- General Hospital Staff / Doctors
    or (
      p_hospital_id is not null
      and p_hospital_id = public.current_hospital_id()
      and (
        public.has_role((select auth.uid()), 'hospital_staff')
        or public.has_role((select auth.uid()), 'doctor')
      )
      and (
        p_assigned_staff_id = (select auth.uid())
        or (p_department_id is not null and p_department_id = public.current_department_id())
      )
    );
$$;

grant execute on function public.user_can_access_referral(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;
revoke execute on function public.user_can_access_referral(uuid, uuid, uuid, uuid, uuid, uuid) from public, anon;

-- 3. Recreate referrals policies using the new 6-parameter function
drop policy if exists "view referrals scoped" on public.referrals;
create policy "view referrals scoped" on public.referrals
for select
to authenticated
using (
  public.user_can_access_referral(clinic_id, hospital_id, assigned_staff_id, department_id, source_department_id, created_by)
);

drop policy if exists "update referrals scoped" on public.referrals;
create policy "update referrals scoped" on public.referrals
for update
to authenticated
using (
  public.user_can_access_referral(clinic_id, hospital_id, assigned_staff_id, department_id, source_department_id, created_by)
)
with check (
  public.user_can_access_referral(clinic_id, hospital_id, assigned_staff_id, department_id, source_department_id, created_by)
);

-- 4. Recreate related table policies
drop policy if exists "view attachments via referral" on public.referral_attachments;
create policy "view attachments via referral" on public.referral_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.referrals r
    where r.id = referral_attachments.referral_id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);

drop policy if exists "insert attachments via referral" on public.referral_attachments;
create policy "insert attachments via referral" on public.referral_attachments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.referrals r
    where r.id = referral_attachments.referral_id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);

drop policy if exists "view messages via referral" on public.referral_messages;
create policy "view messages via referral" on public.referral_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.referrals r
    where r.id = referral_messages.referral_id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);

drop policy if exists "send messages via referral" on public.referral_messages;
create policy "send messages via referral" on public.referral_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.referrals r
    where r.id = referral_messages.referral_id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);

drop policy if exists "view history via referral" on public.referral_status_history;
create policy "view history via referral" on public.referral_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.referrals r
    where r.id = referral_status_history.referral_id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);

drop policy if exists "view patients scoped" on public.patients;
create policy "view patients scoped" on public.patients
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or exists (
    select 1
    from public.referrals r
    where r.patient_id = patients.id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);

-- 5. Recreate storage policies
drop policy if exists "auth read referral files" on storage.objects;
create policy "auth read referral files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'referral-attachments'
  and exists (
    select 1
    from public.referrals r
    where r.id::text = (storage.foldername(name))[1]
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);

drop policy if exists "clinic upload referral files" on storage.objects;
create policy "clinic upload referral files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'referral-attachments'
  and exists (
    select 1
    from public.referrals r
    where r.id::text = (storage.foldername(name))[1]
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id, r.department_id, r.source_department_id, r.created_by)
  )
);
