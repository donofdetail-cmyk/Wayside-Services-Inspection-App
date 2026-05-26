ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS edited_by_admin BOOLEAN DEFAULT false;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS admin_notes TEXT;
