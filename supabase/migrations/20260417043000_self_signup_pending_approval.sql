create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_from_self_signup boolean;
begin
  requested_from_self_signup := coalesce(new.raw_user_meta_data->>'signup_source', '') = 'self';

  insert into public.profiles (id, full_name, email, phone, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    case when requested_from_self_signup then 'pending_approval' else 'active' end
  );

  insert into public.user_roles(user_id, role) values (new.id, 'clinic_user');
  return new;
end; $$;
