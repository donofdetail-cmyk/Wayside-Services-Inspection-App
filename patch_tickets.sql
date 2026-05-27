ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2);
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS notes TEXT;
NOTIFY pgrst, 'reload schema';
