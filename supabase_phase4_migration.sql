-- ==============================================================================
-- PHASE 4: CUSTOMER PORTAL & REALTIME
-- ==============================================================================

-- 1. Grant Customers (any authenticated user) the ability to view their own inspections
DROP POLICY IF EXISTS "Customers can view their own inspections" ON public.inspections;
CREATE POLICY "Customers can view their own inspections" ON public.inspections
  FOR SELECT
  USING (auth.jwt()->>'email' = client_email OR auth.email() = client_email);

-- 2. Enable Realtime on the d2d_leads table
-- This allows the Technician app to subscribe to updates and show push notifications
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.d2d_leads;
