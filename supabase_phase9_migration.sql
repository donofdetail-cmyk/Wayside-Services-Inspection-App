-- ==============================================================================
-- PHASE 9 MIGRATION: ENTERPRISE SUITE
-- ==============================================================================

-- 1. Add Scheduling columns to d2d_leads
ALTER TABLE public.d2d_leads
ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;

-- 2. Add Follow-Up CRM Tracking
ALTER TABLE public.d2d_leads
ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending'; -- 'pending', 'sent', 'responded'

ALTER TABLE public.inspections
ADD COLUMN IF NOT EXISTS follow_up_status TEXT DEFAULT 'pending';

-- 3. Create Price Book Table
CREATE TABLE IF NOT EXISTS public.price_book (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed basic price book items
INSERT INTO public.price_book (service_name, description, price) VALUES
('HVAC Maintenance Package', 'Full system flush, filter replacement, and chemical cleaning.', 249.99),
('Plumbing Leak Repair', 'Fix localized leaks, replace washers and seals on main fixtures.', 149.00),
('Electrical Diagnostic', 'Full panel diagnostic and receptacle safety check.', 99.00);

-- 4. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  total_amount DECIMAL(10, 2) NOT NULL,
  line_items JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'paid', 'void')),
  stripe_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Realtime for new tables
alter publication supabase_realtime add table public.price_book;
alter publication supabase_realtime add table public.invoices;
