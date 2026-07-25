-- Migration: referral_templates
-- Department admins create templates; dept staff can use them when creating referrals.

CREATE TABLE IF NOT EXISTS public.referral_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 200),
  referral_reason text NOT NULL DEFAULT '',
  diagnosis     text,
  notes         text,
  urgency_level text NOT NULL DEFAULT 'medium' CHECK (urgency_level IN ('low','medium','high','critical')),
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  hospital_id   uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_global     boolean NOT NULL DEFAULT false,
  required_documents text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast per-department lookups
CREATE INDEX IF NOT EXISTS idx_referral_templates_dept    ON public.referral_templates(department_id);
CREATE INDEX IF NOT EXISTS idx_referral_templates_hospital ON public.referral_templates(hospital_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_referral_template_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_templates_updated_at ON public.referral_templates;
CREATE TRIGGER trg_referral_templates_updated_at
  BEFORE UPDATE ON public.referral_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_template_updated_at();

-- RLS
ALTER TABLE public.referral_templates ENABLE ROW LEVEL SECURITY;

-- Helper: current user's department_id from profiles
CREATE OR REPLACE FUNCTION public.current_user_department_id()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_department_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_department_id() FROM public, anon;

-- Helper: current user's hospital_id from profiles
CREATE OR REPLACE FUNCTION public.current_user_hospital_id_fn()
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hospital_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_hospital_id_fn() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_hospital_id_fn() FROM public, anon;

-- Policy: dept admin can manage templates for their department
DROP POLICY IF EXISTS "dept_admin_manage_templates" ON public.referral_templates;
CREATE POLICY "dept_admin_manage_templates"
  ON public.referral_templates
  FOR ALL
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'clinic_admin')
    AND department_id = public.current_user_department_id()
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'clinic_admin')
    AND department_id = public.current_user_department_id()
  );

-- Policy: dept staff can read templates for their own department OR global templates for their hospital
DROP POLICY IF EXISTS "dept_staff_read_templates" ON public.referral_templates;
CREATE POLICY "dept_staff_read_templates"
  ON public.referral_templates
  FOR SELECT
  TO authenticated
  USING (
    (
      public.has_role((SELECT auth.uid()), 'clinic_staff')
      OR public.has_role((SELECT auth.uid()), 'clinic_admin')
    )
    AND (
      department_id = public.current_user_department_id()
      OR (
        is_global = true
        AND hospital_id = public.current_user_hospital_id_fn()
      )
    )
  );

-- Policy: hospital admin/staff can read all templates for their hospital
DROP POLICY IF EXISTS "hospital_staff_read_templates" ON public.referral_templates;
CREATE POLICY "hospital_staff_read_templates"
  ON public.referral_templates
  FOR SELECT
  TO authenticated
  USING (
    (
      public.has_role((SELECT auth.uid()), 'hospital_admin')
      OR public.has_role((SELECT auth.uid()), 'hospital_staff')
    )
    AND hospital_id = public.current_user_hospital_id_fn()
  );

-- Policy: system admin sees all
DROP POLICY IF EXISTS "admin_all_templates" ON public.referral_templates;
CREATE POLICY "admin_all_templates"
  ON public.referral_templates
  FOR ALL
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

COMMENT ON TABLE public.referral_templates IS
  'Referral templates created by department admins for use by department staff during referral creation.';
