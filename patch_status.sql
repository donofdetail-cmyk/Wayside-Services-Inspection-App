ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_status_check;
ALTER TABLE public.service_tickets ADD CONSTRAINT service_tickets_status_check CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'skipped', 'cancelled'));
NOTIFY pgrst, 'reload schema';
