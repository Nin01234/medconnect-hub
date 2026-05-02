-- Normalize the known admin account reported in support:
-- innocentgh10@gmail.com should be a clean active admin profile.

with target as (
  select id
  from auth.users
  where lower(email) = lower('innocentgh10@gmail.com')
)
update public.profiles p
set role = 'admin'::public.app_role,
    status = 'active',
    clinic_id = null,
    hospital_id = null,
    department_id = null
from target t
where p.id = t.id;

with target as (
  select id
  from auth.users
  where lower(email) = lower('innocentgh10@gmail.com')
)
delete from public.user_roles ur
using target t
where ur.user_id = t.id
  and ur.role <> 'admin'::public.app_role;

insert into public.user_roles(user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = lower('innocentgh10@gmail.com')
on conflict (user_id, role) do nothing;
