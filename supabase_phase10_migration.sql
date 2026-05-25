-- ==============================================================================
-- PHASE 10 MIGRATION: CRM NURTURING ENGINE
-- ==============================================================================

-- 1. Create Touchpoints Queue
CREATE TABLE IF NOT EXISTS public.client_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  property_address TEXT NOT NULL,
  campaign_type TEXT NOT NULL, -- '30_day_nurture', '60_day_nurture', '6_month_seasonal'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent'
  scheduled_for TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Realtime Enablement
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'client_touchpoints') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.client_touchpoints';
  END IF;
END $$;
