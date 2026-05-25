-- ==============================================================================
-- WAYSIDE MASTER DATABASE SCHEMA (ALL PHASES + ROUTE OPTIMIZATION)
-- ==============================================================================

-- 0) UUID helper
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 1) Profiles Table (Employees)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('technician', 'rep', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 2) Auto-Profile Trigger for New Signups
-- (Single definition: safe defaults + idempotent trigger)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
      COALESCE(new.raw_user_meta_data->>'role', 'technician')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for new user %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 3) D2D Leads Table
-- ==============================================================================
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

-- ==============================================================================
-- 4) Inspections Table
-- ==============================================================================
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

-- ==============================================================================
-- 5) Company Settings Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Wayside Services',
  logo_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.company_settings (company_name)
SELECT 'Wayside Services'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings);

-- ==============================================================================
-- 6) Dynamic Checklists Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: destructive on re-run
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

-- ==============================================================================
-- 7) Territory Zones
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.territory_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#1D3B34',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 8) Customers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 9) Properties
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  territory_zone_id UUID REFERENCES public.territory_zones(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 10) Service Agreements
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.service_agreements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  originated_by_rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recurring_price DECIMAL(10, 2) NOT NULL,
  frequency TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 11) Service Tickets
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.service_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agreement_id UUID REFERENCES public.service_agreements(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  assigned_tech_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'recurring' CHECK (type IN ('initial', 'recurring', 'reservice')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'cancelled')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- RLS POLICIES (enable + replace)
-- ==============================================================================
ALTER TABLE public.territory_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.territory_zones;
CREATE POLICY "Enable all for authenticated users"
ON public.territory_zones
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.customers;
CREATE POLICY "Enable all for authenticated users"
ON public.customers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.properties;
CREATE POLICY "Enable all for authenticated users"
ON public.properties
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.service_agreements;
CREATE POLICY "Enable all for authenticated users"
ON public.service_agreements
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.service_tickets;
CREATE POLICY "Enable all for authenticated users"
ON public.service_tickets
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- Realtime Enablement (idempotent)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'd2d_leads'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.d2d_leads';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'inspections'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.inspections';
  END IF;
END $$;

-- ==============================================================================
-- Storage Bucket Setup (for PDFs) (idempotent)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- WAYSIDE APP - TIME TRACKING SCHEMA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clock_in_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out_time TIMESTAMPTZ,
  duration_minutes INT,
  location_in TEXT,
  location_out TEXT,
  status TEXT NOT NULL CHECK (status IN ('clocked_in', 'clocked_out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own time entries" ON public.time_entries;
CREATE POLICY "Users can insert their own time entries"
ON public.time_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own time entries" ON public.time_entries;
CREATE POLICY "Users can view their own time entries"
ON public.time_entries
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Users can update their own time entries" ON public.time_entries;
CREATE POLICY "Users can update their own time entries"
ON public.time_entries
FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete time entries" ON public.time_entries;
CREATE POLICY "Admins can delete time entries"
ON public.time_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- Realtime: add time_entries idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'time_entries'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries';
  END IF;
END $$;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.profiles;
CREATE POLICY "Enable all for authenticated users"
ON public.profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- 12) CRM Tables (Notes, Touchpoints, Logs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_address TEXT NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.client_touchpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.client_notes;
CREATE POLICY "Enable all for authenticated users" ON public.client_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.client_touchpoints;
CREATE POLICY "Enable all for authenticated users" ON public.client_touchpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.communication_logs;
CREATE POLICY "Enable all for authenticated users" ON public.communication_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'client_notes') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.client_notes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'client_touchpoints') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.client_touchpoints';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'communication_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs';
  END IF;
END $$;
-- ==============================================================================
-- PHASE 1: GOD MODE ARCHITECTURE
-- Run this in the Supabase SQL Editor
-- ==============================================================================

-- 1) UPDATE PROFILES TO SUPPORT 'owner' ROLE
-- ==============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('technician', 'rep', 'admin', 'owner'));

-- 2) UNIVERSAL AUDIT LOGGER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit_logs (Only owners/admins can view)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Trigger Function
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_old_data := row_to_json(OLD)::JSONB;
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME::TEXT, OLD.id, TG_OP, v_old_data, auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := row_to_json(OLD)::JSONB;
    v_new_data := row_to_json(NEW)::JSONB;
    
    -- Distinguish SOFT_DELETE vs RESTORE vs UPDATE
    -- Check if deleted_at column exists in the row before trying to access it dynamically
    IF (v_old_data ? 'deleted_at' AND v_new_data ? 'deleted_at') THEN
        IF (v_old_data->>'deleted_at' IS NULL AND v_new_data->>'deleted_at' IS NOT NULL) THEN
            INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
            VALUES (TG_TABLE_NAME::TEXT, NEW.id, 'SOFT_DELETE', v_old_data, v_new_data, auth.uid());
            RETURN NEW;
        ELSIF (v_old_data->>'deleted_at' IS NOT NULL AND v_new_data->>'deleted_at' IS NULL) THEN
            INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
            VALUES (TG_TABLE_NAME::TEXT, NEW.id, 'RESTORE', v_old_data, v_new_data, auth.uid());
            RETURN NEW;
        END IF;
    END IF;

    -- Standard Update
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME::TEXT, NEW.id, TG_OP, v_old_data, v_new_data, auth.uid());
    RETURN NEW;
    
  ELSIF (TG_OP = 'INSERT') THEN
    v_new_data := row_to_json(NEW)::JSONB;
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME::TEXT, NEW.id, TG_OP, v_new_data, auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3) SOFT DELETE ARCHITECTURE
-- ==============================================================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.service_agreements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.client_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.territory_zones ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 4) APPLY TRIGGERS
-- ==============================================================================
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['customers', 'properties', 'service_tickets', 'service_agreements', 'time_entries', 'client_notes', 'territory_zones', 'profiles'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON public.%I', t);
        EXECUTE format('CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()', t);
    END LOOP;
END;
$$;


-- 5) GOD MODE RLS FOR TIME ENTRIES (OVERRIDING THE RESTRICTIONS)
-- ==============================================================================
-- We explicitly grant admins/owners full control over time entries (Insert, Update, Delete)
DROP POLICY IF EXISTS "Users can insert their own time entries" ON public.time_entries;
CREATE POLICY "Users can insert their own time entries OR Admin override"
ON public.time_entries FOR INSERT WITH CHECK (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

DROP POLICY IF EXISTS "Users can update their own time entries" ON public.time_entries;
CREATE POLICY "Users can update their own time entries OR Admin override"
ON public.time_entries FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

DROP POLICY IF EXISTS "Admins can delete time entries" ON public.time_entries;
CREATE POLICY "Admins can delete time entries"
ON public.time_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

-- Realtime for audit_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs';
  END IF;
END $$;
