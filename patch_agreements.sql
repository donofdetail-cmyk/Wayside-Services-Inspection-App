ALTER TABLE public.service_agreements ADD COLUMN IF NOT EXISTS territory_zone_id UUID REFERENCES public.territory_zones(id) ON DELETE SET NULL;
ALTER TABLE public.service_agreements ADD COLUMN IF NOT EXISTS contract_start_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.service_agreements ADD COLUMN IF NOT EXISTS contract_end_date DATE;
NOTIFY pgrst, 'reload schema';
