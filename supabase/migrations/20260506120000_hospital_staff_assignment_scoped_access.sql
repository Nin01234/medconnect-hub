-- Hospital visibility:
--   - hospital_admin (and platform admin): all referrals for the hospital, including unassigned.
--   - hospital_staff: only referrals explicitly assigned to them (assigned_staff_id = auth.uid()).
-- Fixes: unassigned referrals invisible to staff (department_id IS NULL); dual hospital_admin+hospital_staff
-- role no longer blocks admins from triage views; parent policies for messages/attachments/storage match referrals.

create or replace function public.user_can_access_referral(
  p_clinic_id uuid,
  p_hospital_id uuid,
  p_assigned_staff_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    public.has_role((select auth.uid()), 'admin')
    or (
      p_clinic_id is not null
      and p_clinic_id = public.current_clinic_id()
    )
    or (
      p_hospital_id is not null
      and p_hospital_id = public.current_hospital_id()
      and (
        public.has_role((select auth.uid()), 'hospital_admin')
        or (
          public.has_role((select auth.uid()), 'hospital_staff')
          and p_assigned_staff_id = (select auth.uid())
        )
      )
    );
$$;

grant execute on function public.user_can_access_referral(uuid, uuid, uuid) to authenticated;
revoke execute on function public.user_can_access_referral(uuid, uuid, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
drop policy if exists "view referrals scoped" on public.referrals;
create policy "view referrals scoped" on public.referrals
for select
to authenticated
using (
  public.user_can_access_referral(clinic_id, hospital_id, assigned_staff_id)
);

drop policy if exists "update referrals scoped" on public.referrals;
create policy "update referrals scoped" on public.referrals
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or (
    clinic_id = public.current_clinic_id()
    and status in ('draft', 'submitted', 'info_requested')
    and (
      public.has_role((select auth.uid()), 'clinic_user')
      or public.has_role((select auth.uid()), 'clinic_admin')
      or public.has_role((select auth.uid()), 'clinic_staff')
    )
  )
  or public.user_can_access_referral(clinic_id, hospital_id, assigned_staff_id)
)
with check (
  public.has_role((select auth.uid()), 'admin')
  or clinic_id = public.current_clinic_id()
  or public.user_can_access_referral(clinic_id, hospital_id, assigned_staff_id)
);

-- ---------------------------------------------------------------------------
-- referral_attachments, messages, status_history (same gate as referrals)
-- ---------------------------------------------------------------------------
drop policy if exists "view attachments via referral" on public.referral_attachments;
create policy "view attachments via referral" on public.referral_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.referrals r
    where r.id = referral_attachments.referral_id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
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
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
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
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
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
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
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
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
  )
);

-- ---------------------------------------------------------------------------
-- Storage: same referral gate (was overly broad for hospital_staff)
-- ---------------------------------------------------------------------------
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
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
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
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
  )
);

-- ---------------------------------------------------------------------------
-- patients: hospital visibility follows referral access (not bare hospital_id)
-- ---------------------------------------------------------------------------
drop policy if exists "view patients scoped" on public.patients;
create policy "view patients scoped" on public.patients
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin')
  or clinic_id = public.current_clinic_id()
  or exists (
    select 1
    from public.referrals r
    where r.patient_id = patients.id
      and public.user_can_access_referral(r.clinic_id, r.hospital_id, r.assigned_staff_id)
  )
);
