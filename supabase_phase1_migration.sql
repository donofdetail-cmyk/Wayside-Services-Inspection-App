-- ==============================================================================
-- PHASE 1: SUPABASE MIGRATION SCRIPT
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ==============================================================================

-- 1. Create custom enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'technician', 'rep');

-- 2. Create Profiles table (links to Supabase Auth)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role user_role NOT NULL DEFAULT 'technician',
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Inspections table
CREATE TABLE public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID REFERENCES auth.users(id) NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  property_address TEXT NOT NULL,
  checklist_data JSONB NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Update existing D2D Leads table
-- We add rep_id to properly link doors to authenticated users
ALTER TABLE public.d2d_leads 
ADD COLUMN IF NOT EXISTS rep_id UUID REFERENCES auth.users(id);

-- 5. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- (d2d_leads already had RLS enabled in the previous migration, 
-- but we will update the policies to use auth.uid() instead of trusting the client)

-- ==============================================================================
-- 6. RLS POLICIES
-- ==============================================================================

-- Profiles: Users can read their own profile. Admins can read all.
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Inspections: Techs can insert/read their own.
CREATE POLICY "Techs can insert own inspections" ON public.inspections
  FOR INSERT WITH CHECK (auth.uid() = technician_id);

CREATE POLICY "Techs can read own inspections" ON public.inspections
  FOR SELECT USING (auth.uid() = technician_id);

-- D2D Leads: Reps can insert/read their own.
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.d2d_leads;
DROP POLICY IF EXISTS "Anyone can view leads" ON public.d2d_leads;

CREATE POLICY "Reps can insert own leads" ON public.d2d_leads
  FOR INSERT WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can read own leads" ON public.d2d_leads
  FOR SELECT USING (auth.uid() = rep_id);

-- Note: We will add Admin-specific policies in Phase 3.

-- ==============================================================================
-- 7. AUTO-CREATE PROFILE TRIGGER
-- Automatically creates a profile row when a new user signs up.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'technician'::user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
