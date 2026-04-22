do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'approved_by'
  ) then
    alter table public.profiles
      drop constraint if exists profiles_approved_by_fkey;

    alter table public.profiles
      add constraint profiles_approved_by_fkey
      foreign key (approved_by)
      references auth.users(id)
      on delete set null;
  end if;
end;
$$;
