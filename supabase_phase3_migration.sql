-- ==============================================================================
-- PHASE 3: PIPELINE & STORAGE UPGRADE
-- ==============================================================================

-- 1. Create the Supabase Storage Bucket for PDF Reports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow technicians to upload PDFs to the reports bucket
DROP POLICY IF EXISTS "Techs can upload PDFs" ON storage.objects;
CREATE POLICY "Techs can upload PDFs" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'reports' AND auth.role() = 'authenticated');

-- Allow anyone to view public PDFs (for admin download links)
DROP POLICY IF EXISTS "Public reports are viewable by everyone" ON storage.objects;
CREATE POLICY "Public reports are viewable by everyone" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'reports');

-- 2. Update D2D Leads to support assignment
ALTER TABLE public.d2d_leads
ADD COLUMN IF NOT EXISTS assigned_tech_id UUID REFERENCES auth.users(id);

-- 3. Allow Admins to update profiles (Employee Management)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE
  USING (public.is_admin());

-- Allow Admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- 4. Allow Admins to update leads (Job Assignment)
DROP POLICY IF EXISTS "Admins can update leads" ON public.d2d_leads;
CREATE POLICY "Admins can update leads" ON public.d2d_leads
  FOR UPDATE
  USING (public.is_admin());

-- 5. Allow Techs to view leads assigned to them (Scheduled Jobs)
DROP POLICY IF EXISTS "Techs can view assigned leads" ON public.d2d_leads;
CREATE POLICY "Techs can view assigned leads" ON public.d2d_leads
  FOR SELECT
  USING (auth.uid() = assigned_tech_id);
