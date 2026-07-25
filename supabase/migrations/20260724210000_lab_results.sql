-- Migration: lab_results
-- Laboratory results table for patient-level test tracking with referral linking.

CREATE TABLE IF NOT EXISTS public.lab_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  referral_id     uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  test_name       text NOT NULL CHECK (char_length(test_name) > 0 AND char_length(test_name) <= 200),
  result          text NOT NULL,
  normal_range    text,
  unit            text,
  status          text NOT NULL DEFAULT 'normal'
                    CHECK (status IN ('normal','high','low','critical')),
  date_performed  date NOT NULL DEFAULT CURRENT_DATE,
  ordering_doctor text,
  department_id   uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  hospital_id     uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Attachment tracking
  is_attached_to_referral boolean NOT NULL DEFAULT false,
  attached_at     timestamptz,
  attached_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lab_results_patient  ON public.lab_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_referral ON public.lab_results(referral_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_hospital ON public.lab_results(hospital_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_date     ON public.lab_results(date_performed DESC);
CREATE INDEX IF NOT EXISTS idx_lab_results_status   ON public.lab_results(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_lab_result_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lab_results_updated_at ON public.lab_results;
CREATE TRIGGER trg_lab_results_updated_at
  BEFORE UPDATE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.set_lab_result_updated_at();

-- RLS
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

-- Policy: dept/hospital staff can read lab results for their hospital
DROP POLICY IF EXISTS "hospital_users_read_lab_results" ON public.lab_results;
CREATE POLICY "hospital_users_read_lab_results"
  ON public.lab_results
  FOR SELECT
  TO authenticated
  USING (
    (
      public.has_role((SELECT auth.uid()), 'clinic_admin')
      OR public.has_role((SELECT auth.uid()), 'clinic_staff')
      OR public.has_role((SELECT auth.uid()), 'hospital_admin')
      OR public.has_role((SELECT auth.uid()), 'hospital_staff')
    )
    AND hospital_id = public.current_user_hospital_id_fn()
  );

-- Policy: dept/hospital staff can insert lab results for their hospital
DROP POLICY IF EXISTS "hospital_users_insert_lab_results" ON public.lab_results;
CREATE POLICY "hospital_users_insert_lab_results"
  ON public.lab_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.has_role((SELECT auth.uid()), 'clinic_admin')
      OR public.has_role((SELECT auth.uid()), 'clinic_staff')
      OR public.has_role((SELECT auth.uid()), 'hospital_admin')
      OR public.has_role((SELECT auth.uid()), 'hospital_staff')
    )
    AND hospital_id = public.current_user_hospital_id_fn()
    AND created_by = (SELECT auth.uid())
  );

-- Policy: dept/hospital staff can update lab results (to attach to referral)
DROP POLICY IF EXISTS "hospital_users_update_lab_results" ON public.lab_results;
CREATE POLICY "hospital_users_update_lab_results"
  ON public.lab_results
  FOR UPDATE
  TO authenticated
  USING (
    (
      public.has_role((SELECT auth.uid()), 'clinic_admin')
      OR public.has_role((SELECT auth.uid()), 'clinic_staff')
      OR public.has_role((SELECT auth.uid()), 'hospital_admin')
      OR public.has_role((SELECT auth.uid()), 'hospital_staff')
    )
    AND hospital_id = public.current_user_hospital_id_fn()
  )
  WITH CHECK (
    hospital_id = public.current_user_hospital_id_fn()
  );

-- Policy: system admin full access
DROP POLICY IF EXISTS "admin_all_lab_results" ON public.lab_results;
CREATE POLICY "admin_all_lab_results"
  ON public.lab_results
  FOR ALL
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

COMMENT ON TABLE public.lab_results IS
  'Patient laboratory test results. Can be linked to referrals and attached as part of a referral record.';
