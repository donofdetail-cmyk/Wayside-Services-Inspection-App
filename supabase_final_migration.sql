-- ==============================================================================
-- WAYSIDE APP - FINAL SECURITY & COMPLIANCE MIGRATION
-- Copy and paste this entire script into your Supabase SQL Editor and run it.
-- ==============================================================================

-- 1. ADD COMPLIANCE & PRIVACY COLUMNS TO CUSTOMERS
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS agreed_to_tos BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tos_agreed_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sms_consent_granted BOOLEAN DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opted_out_of_sale BOOLEAN DEFAULT false;

-- ==============================================================================

-- 2. PII CENTRALIZATION (Remove duplicate PII columns and add foreign keys)

-- Add foreign keys to inspections
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- Drop raw text columns from inspections
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_name;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_email;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_phone;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS property_address;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_info;

-- Drop raw text columns from client_touchpoints
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS client_name;
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS client_email;
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS client_phone;
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS property_address;

-- Link client_notes to properties
ALTER TABLE public.client_notes ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
ALTER TABLE public.client_notes DROP COLUMN IF EXISTS property_address;

-- ==============================================================================

-- 3. SECURE BUCKETS
UPDATE storage.buckets 
SET public = false 
WHERE id = 'reports';

-- Allow authenticated users to securely fetch their signed URLs
CREATE POLICY "Allow authenticated users to read reports" 
ON storage.objects FOR SELECT 
TO authenticated 
USING ( bucket_id = 'reports' );
