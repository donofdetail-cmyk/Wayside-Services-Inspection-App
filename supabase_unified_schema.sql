-- ==============================================================================
-- WAYSIDE MASTER DATABASE SCHEMA (GOD-MODE + CRM + ROUTE OPTIMIZATION)
-- Run this entire script in your Supabase SQL Editor
-- ==============================================================================

-- 0) UUID helper
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 1) Profiles Table (Employees)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('technician', 'rep', 'admin', 'owner')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 2) Auto-Profile Trigger for New Signups
-- (Bulletproof logic to prevent transaction rollbacks)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
-- 4) Customers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  agreed_to_tos BOOLEAN DEFAULT false,
  tos_agreed_at TIMESTAMPTZ,
  sms_consent_granted BOOLEAN DEFAULT false,
  sms_consent_at TIMESTAMPTZ,
  opted_out_of_sale BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 5) Properties
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  territory_zone_id UUID REFERENCES public.territory_zones(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 6) Inspections Table (PII Centralized)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  checklist_data JSONB NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7) Company Settings Table
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
-- 8) Dynamic Checklists Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
-- 9) Territory Zones
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.territory_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#1D3B34',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
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
  deleted_at TIMESTAMPTZ DEFAULT NULL,
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
  is_time_locked BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 12) CRM Tables (Notes, Touchpoints, Logs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.client_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
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

-- ==============================================================================
-- 13) Time Tracking Schema
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
  edited_by_admin BOOLEAN DEFAULT false,
  admin_notes TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 14) Universal Audit Logger (GOD MODE)
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

-- Attach Triggers to Core Tables
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['customers', 'properties', 'service_tickets', 'service_agreements', 'time_entries', 'client_notes', 'territory_zones', 'profiles'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON public.%I', t);
        EXECUTE format('CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()', t);
    END LOOP;
END;
$$;


-- ==============================================================================
-- RLS POLICIES (God-Mode + Public Enablement)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Base Tables (Accessible by all authenticated users, filtered by soft-deletes in UI)
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['profiles', 'territory_zones', 'customers', 'properties', 'service_agreements', 'service_tickets', 'client_notes', 'client_touchpoints', 'communication_logs'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable all for authenticated users" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END;
$$;

-- Restricted Tables: Audit Logs (Admins/Owners Only)
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner'))
);

-- Restricted Tables: Time Entries (Own records OR Admin/Owner Override)
DROP POLICY IF EXISTS "Users can insert their own time entries OR Admin override" ON public.time_entries;
CREATE POLICY "Users can insert their own time entries OR Admin override" ON public.time_entries FOR INSERT WITH CHECK (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

DROP POLICY IF EXISTS "Users can update their own time entries OR Admin override" ON public.time_entries;
CREATE POLICY "Users can update their own time entries OR Admin override" ON public.time_entries FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

DROP POLICY IF EXISTS "Admins can delete time entries" ON public.time_entries;
CREATE POLICY "Admins can delete time entries" ON public.time_entries FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'owner'))
);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['d2d_leads', 'inspections', 'time_entries', 'client_notes', 'client_touchpoints', 'communication_logs', 'audit_logs'])
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END;
$$;

-- ==============================================================================
-- STORAGE BUCKETS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false) ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Allow authenticated users to read reports" 
ON storage.objects FOR SELECT 
TO authenticated 
USING ( bucket_id = 'reports' );

CREATE POLICY "Allow authenticated users to insert reports" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'reports' );
