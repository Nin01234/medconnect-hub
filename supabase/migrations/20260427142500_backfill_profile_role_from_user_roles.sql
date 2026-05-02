-- Backfill profile.role from canonical user_roles table.
-- This prevents login routing issues when profile.role drifted out of sync.
with latest_roles as (
  select distinct on (r.user_id)
    r.user_id,
    r.role
  from public.user_roles r
  order by r.user_id, r.created_at desc
)
update public.profiles p
set role = lr.role
from latest_roles lr
where p.id = lr.user_id
  and p.role is distinct from lr.role;
