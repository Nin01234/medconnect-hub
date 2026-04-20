alter table public.referrals
add column if not exists assigned_department text;

comment on column public.referrals.assigned_department is
'Hospital department assigned to handle the referral.';
