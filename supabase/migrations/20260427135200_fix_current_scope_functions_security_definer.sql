-- Prevent recursive RLS on profiles by ensuring scope helpers run as definer.
alter function public.current_clinic_id() security definer;
alter function public.current_hospital_id() security definer;
alter function public.current_department_id() security definer;

revoke all on function public.current_clinic_id() from public, anon;
revoke all on function public.current_hospital_id() from public, anon;
revoke all on function public.current_department_id() from public, anon;

grant execute on function public.current_clinic_id() to authenticated, service_role;
grant execute on function public.current_hospital_id() to authenticated, service_role;
grant execute on function public.current_department_id() to authenticated, service_role;
