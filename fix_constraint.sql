ALTER TABLE public.d2d_leads DROP CONSTRAINT IF EXISTS d2d_leads_status_check;
ALTER TABLE public.d2d_leads ADD CONSTRAINT d2d_leads_status_check CHECK (status IN ('new', 'not_home', 'not_interested', 'interested', 'scheduled', 'completed', 'closed_won', 'closed_lost'));
NOTIFY pgrst, 'reload schema';
