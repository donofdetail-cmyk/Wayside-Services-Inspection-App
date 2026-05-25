-- ==============================================================================
-- WAYSIDE MASTER DATABASE SCHEMA (ALL PHASES COMBINED)
-- ==============================================================================
-- Running this script on a fresh Supabase project will instantly set up 
-- the entire Wayside database architecture perfectly.

-- 1. Profiles Table (Employees)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('technician', 'rep', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Auto-Profile Trigger for New Signups
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'role'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 3. D2D Leads Table
CREATE TABLE IF NOT EXISTS public.d2d_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES auth.users(id),
  rep_name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('not_home', 'not_interested', 'scheduled', 'completed')),
  address TEXT NOT NULL,
  contact_name TEXT,
  notes TEXT,
  assigned_tech_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Inspections Table (Fully expanded with all Phase 6 data)
CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES auth.users(id),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  property_address TEXT NOT NULL,
  duration_seconds INTEGER,
  checklist_data JSONB NOT NULL,
  client_info JSONB,
  client_signature TEXT,
  technician_signature TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Company Settings Table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Wayside Services',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.company_settings (company_name)
SELECT 'Wayside Services'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);


-- 6. Dynamic Checklists Table
CREATE TABLE IF NOT EXISTS public.inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the exact 10 items
DELETE FROM public.inspection_templates;
INSERT INTO public.inspection_templates (order_index, question_text) VALUES 
(1, 'HVAC Air Filter Inspection & Replacement'),
(2, 'Visual Plumbing Inspection'),
(3, 'Faucet & Fixture Performance Check'),
(4, 'Light Switch & Receptacle Safety Check'),
(5, 'Smoke & Carbon Monoxide Detector Status Check'),
(6, 'Door & Window Operation Check'),
(7, 'Garage Door Seal & Functionality Check'),
(8, 'Exterior Visual Walk-Around'),
(9, 'Weather Seal Inspection'),
(10, '+ One Rotating Seasonal Preventative Task');


-- 7. Realtime Enablement (for Admin Dashboard)
-- Allows the tables to broadcast changes instantly
alter publication supabase_realtime add table public.d2d_leads;
alter publication supabase_realtime add table public.inspections;


-- 8. Storage Bucket Setup (for PDFs)
insert into storage.buckets (id, name, public) 
values ('reports', 'reports', true)
on conflict (id) do nothing;
