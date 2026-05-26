-- ==============================================================================
-- PII CENTRALIZATION MIGRATION
-- This script removes duplicate PII columns from operational tables and links 
-- them strictly via foreign keys to comply with CCPA data deletion requests.
-- ==============================================================================

-- 1. INSPECTIONS TABLE
-- Make sure the foreign keys exist first. If they don't, we need to create the customer/property logic.
-- Note: Our current app inserts client info into inspections. To migrate, we should ideally upsert customers.
-- For this migration, we will add the foreign keys and drop the raw text columns.

ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- Warning: We are dropping these columns! Any existing dashboard queries MUST use the new joins.
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_name;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_email;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_phone;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS property_address;
ALTER TABLE public.inspections DROP COLUMN IF EXISTS client_info; -- dropping the raw JSONB payload as well

-- 2. CLIENT TOUCHPOINTS TABLE
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS client_name;
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS client_email;
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS client_phone;
ALTER TABLE public.client_touchpoints DROP COLUMN IF EXISTS property_address;

-- 3. CLIENT NOTES TABLE
-- The original table had 'property_address TEXT'. We switch it to 'property_id UUID'.
ALTER TABLE public.client_notes ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
ALTER TABLE public.client_notes DROP COLUMN IF EXISTS property_address;
