-- ==========================================
-- WAYSIDE APP SECURITY MIGRATION
-- Fixes wide-open RLS and unauthenticated access
-- ==========================================

-- 1. Enable RLS on previously unprotected tables
ALTER TABLE public.d2d_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- 2. Drop the dangerous "Enable all for authenticated users" policies
DO $$ 
DECLARE 
    r record;
BEGIN
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.%I', r.tablename);
    END LOOP;
END $$;

-- 3. Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins/Owners can do all to profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- 4. Customers & Properties & Agreements (Technicians: Read, Reps: Read, Admins: All)
CREATE POLICY "Authenticated users can read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/Owners can modify customers" ON public.customers FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "Authenticated users can read properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/Owners can modify properties" ON public.properties FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "Authenticated users can read service_agreements" ON public.service_agreements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/Owners can modify service_agreements" ON public.service_agreements FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "Authenticated users can read service_tickets" ON public.service_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins/Owners can modify service_tickets" ON public.service_tickets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

-- 5. Inspections (Customers read own, Techs read/write own, Admins read/write all)
CREATE POLICY "Customers can view their own inspections" ON public.inspections 
  FOR SELECT TO authenticated 
  USING (client_email = auth.jwt()->>'email');

CREATE POLICY "Techs can manage own inspections" ON public.inspections 
  FOR ALL TO authenticated 
  USING (
    technician_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- 6. D2D Leads (Reps read/write own, Admins read/write all)
CREATE POLICY "Reps can manage own leads" ON public.d2d_leads 
  FOR ALL TO authenticated 
  USING (
    rep_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- 7. Time Entries (SELECT policy was missing)
CREATE POLICY "Users can view own time entries" ON public.time_entries 
  FOR SELECT TO authenticated 
  USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

-- 8. Client Touchpoints & Notes (Admins only for write)
CREATE POLICY "Authenticated can read touchpoints" ON public.client_touchpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage touchpoints" ON public.client_touchpoints FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);

CREATE POLICY "Authenticated can read notes" ON public.client_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage notes" ON public.client_notes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
);
