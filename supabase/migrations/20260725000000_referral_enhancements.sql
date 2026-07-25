-- Migration: referral_enhancements
-- Adds support for MRN, DOB, Allergies, Medications, Chief Complaint, HPI, Provisional Diagnosis, Imaging, Checklist & Categories to Referrals table.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS mrn text UNIQUE,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS allergies text[],
  ADD COLUMN IF NOT EXISTS current_medications text[];

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS chief_complaint text,
  ADD COLUMN IF NOT EXISTS hpi text,
  ADD COLUMN IF NOT EXISTS provisional_diagnosis text,
  ADD COLUMN IF NOT EXISTS referral_category text DEFAULT 'Specialist Consultation',
  ADD COLUMN IF NOT EXISTS referral_category_other text,
  ADD COLUMN IF NOT EXISTS assigned_specialist text,
  ADD COLUMN IF NOT EXISTS preferred_appointment_date date,
  ADD COLUMN IF NOT EXISTS imaging_results jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist_completed jsonb DEFAULT '[]'::jsonb;

-- Create table for admin-configurable department checklists
CREATE TABLE IF NOT EXISTS public.department_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_label text NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(department_id, item_key)
);

ALTER TABLE public.department_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read department checklists"
  ON public.department_checklists FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow hospital/department admins to manage department checklists"
  ON public.department_checklists FOR ALL TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'hospital_admin')
    OR public.has_role((SELECT auth.uid()), 'clinic_admin')
    OR public.has_role((SELECT auth.uid()), 'admin')
  );
