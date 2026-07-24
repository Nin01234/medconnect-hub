-- Add source_department_id to referrals
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS source_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Update select and insert policies to support internal referrals within same hospital
DROP POLICY IF EXISTS "referrals_select_policy" ON public.referrals;
DROP POLICY IF EXISTS "referrals_insert_policy" ON public.referrals;
DROP POLICY IF EXISTS "referrals_update_policy" ON public.referrals;

CREATE POLICY "referrals_select_policy" ON public.referrals
  FOR SELECT USING (
    auth.uid() = created_by OR
    hospital_id = (SELECT hospital_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "referrals_insert_policy" ON public.referrals
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

CREATE POLICY "referrals_update_policy" ON public.referrals
  FOR UPDATE USING (
    hospital_id = (SELECT hospital_id FROM public.profiles WHERE id = auth.uid())
  );
