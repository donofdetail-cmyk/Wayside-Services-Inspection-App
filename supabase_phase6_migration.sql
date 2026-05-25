-- ==============================================================================
-- PHASE 6: FULL DATA CAPTURE
-- ==============================================================================

-- Add columns to capture absolutely every piece of data from the inspection
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS client_phone TEXT,
ADD COLUMN IF NOT EXISTS client_info JSONB,
ADD COLUMN IF NOT EXISTS client_signature TEXT,
ADD COLUMN IF NOT EXISTS technician_signature TEXT;
