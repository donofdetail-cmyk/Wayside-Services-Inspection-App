ALTER TABLE public.territory_zones ADD COLUMN IF NOT EXISTS polygon_coordinates JSONB DEFAULT '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
