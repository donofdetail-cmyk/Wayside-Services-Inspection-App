-- ==============================================================================
-- PHASE 5: DEEP INSPECTION ANALYTICS
-- ==============================================================================

-- Add duration column to inspections so we can permanently track how long services take
ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
