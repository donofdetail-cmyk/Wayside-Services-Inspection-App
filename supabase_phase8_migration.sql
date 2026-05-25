-- ==============================================================================
-- PHASE 8: ENTERPRISE ADMIN CONTROL
-- ==============================================================================

-- 1. Add Employee Kill-Switch
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Create Company Settings Table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Wayside Services',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial company settings
INSERT INTO public.company_settings (company_name)
SELECT 'Wayside Services'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- 3. Create Dynamic Checklists Table
CREATE TABLE IF NOT EXISTS public.inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the initial hardcoded questions so the app doesn't break
INSERT INTO public.inspection_templates (order_index, question_text)
SELECT 0, 'Roof / Shingles Check' WHERE NOT EXISTS (SELECT 1 FROM public.inspection_templates WHERE order_index = 0);
INSERT INTO public.inspection_templates (order_index, question_text)
SELECT 1, 'Gutters & Downspouts' WHERE NOT EXISTS (SELECT 1 FROM public.inspection_templates WHERE order_index = 1);
INSERT INTO public.inspection_templates (order_index, question_text)
SELECT 2, 'Exterior Siding / Paint' WHERE NOT EXISTS (SELECT 1 FROM public.inspection_templates WHERE order_index = 2);
INSERT INTO public.inspection_templates (order_index, question_text)
SELECT 3, 'Foundation Inspection' WHERE NOT EXISTS (SELECT 1 FROM public.inspection_templates WHERE order_index = 3);
INSERT INTO public.inspection_templates (order_index, question_text)
SELECT 4, 'Windows & Seals' WHERE NOT EXISTS (SELECT 1 FROM public.inspection_templates WHERE order_index = 4);
INSERT INTO public.inspection_templates (order_index, question_text)
SELECT 5, 'HVAC Unit Check' WHERE NOT EXISTS (SELECT 1 FROM public.inspection_templates WHERE order_index = 5);

-- 4. Enable RLS and Policies for new tables
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_templates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings and templates
CREATE POLICY "Anyone can view settings" ON public.company_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can view templates" ON public.inspection_templates FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can modify settings and templates
CREATE POLICY "Admins can modify settings" ON public.company_settings FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can modify templates" ON public.inspection_templates FOR ALL USING (public.is_admin());

-- Allow Admins to delete inspections and leads
DROP POLICY IF EXISTS "Admins can update leads" ON public.d2d_leads;
CREATE POLICY "Admins can manage leads" ON public.d2d_leads FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view inspections" ON public.inspections;
CREATE POLICY "Admins can manage inspections" ON public.inspections FOR ALL USING (public.is_admin());
