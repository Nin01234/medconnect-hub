-- Make patients.clinic_id nullable so department-linked patients
-- (who have no clinic) can be inserted with clinic_id = NULL.
-- Department patients are instead scoped via patients.department_id.
alter table public.patients
  alter column clinic_id drop not null;
