-- ==========================================
-- WAYSIDE APP SCHEMA FIXES
-- ==========================================

-- 1. Fix client_touchpoints missing columns
ALTER TABLE public.client_touchpoints ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.client_touchpoints ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.client_touchpoints ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.client_touchpoints ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE public.client_touchpoints ADD COLUMN IF NOT EXISTS campaign_type TEXT;
ALTER TABLE public.client_touchpoints ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- 2. Add updated_at columns and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.service_agreements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_agreements_updated_at ON public.service_agreements;
CREATE TRIGGER update_service_agreements_updated_at BEFORE UPDATE ON public.service_agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_tickets_updated_at ON public.service_tickets;
CREATE TRIGGER update_service_tickets_updated_at BEFORE UPDATE ON public.service_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. Add follow_up_status columns
ALTER TABLE public.d2d_leads ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending';
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending';

-- 4. Fix service_tickets CHECK constraint
ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_status_check;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled'));

ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_type_check;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_type_check CHECK (type IN ('initial', 'recurring', 'reservice', 'seasonal', 'repair'));
