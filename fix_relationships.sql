ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;
ALTER TABLE public.client_notes ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;
ALTER TABLE public.client_touchpoints ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';
