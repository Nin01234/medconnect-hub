alter table public.referrals
  add column if not exists vitals_bp text,
  add column if not exists vitals_hr text,
  add column if not exists vitals_temp text,
  add column if not exists vitals_rr text,
  add column if not exists vitals_spo2 text;
