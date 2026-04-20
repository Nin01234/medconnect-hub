alter table public.profiles
  add column if not exists username text;

update public.profiles
set username = lower(
  coalesce(
    nullif(regexp_replace(split_part(coalesce(email, ''), '@', 1), '[^a-z0-9._-]', '', 'g'), ''),
    'user_' || substr(replace(id::text, '-', ''), 1, 12)
  )
)
where username is null;

with ranked as (
  select
    id,
    username,
    row_number() over (partition by username order by created_at, id) as rn
  from public.profiles
  where username is not null
)
update public.profiles p
set username = left(p.username, 24) || '_' || ranked.rn::text
from ranked
where p.id = ranked.id
  and ranked.rn > 1;

alter table public.profiles
  add constraint profiles_username_format
  check (
    username is null
    or username ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'
  );

create unique index if not exists uq_profiles_username_ci
  on public.profiles (lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username text;
  candidate_username text;
  suffix int := 0;
begin
  desired_username := lower(
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      nullif(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-z0-9._-]', '', 'g'), ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 12)
    )
  );

  if length(desired_username) < 3 then
    desired_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  candidate_username := desired_username;
  while exists (
    select 1
    from public.profiles
    where lower(username) = lower(candidate_username)
  ) loop
    suffix := suffix + 1;
    candidate_username := left(desired_username, 24) || '_' || suffix::text;
  end loop;

  insert into public.profiles (id, full_name, email, phone, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    candidate_username
  );

  -- default role: clinic_user (admin will reassign as needed)
  insert into public.user_roles(user_id, role) values (new.id, 'clinic_user');
  return new;
end; $$;

create or replace function public.resolve_login_identifier(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
  matched_email text;
begin
  normalized := lower(trim(coalesce(p_identifier, '')));
  if normalized = '' then
    return null;
  end if;

  if position('@' in normalized) > 0 then
    select p.email
    into matched_email
    from public.profiles p
    where lower(p.email) = normalized
    limit 1;
  else
    select p.email
    into matched_email
    from public.profiles p
    where lower(p.username) = normalized
    limit 1;
  end if;

  return matched_email;
end;
$$;

grant execute on function public.resolve_login_identifier(text) to anon, authenticated;
