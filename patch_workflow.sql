DO $$ 
DECLARE 
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint 
  WHERE conrelid = 'public.d2d_leads'::regclass 
    AND contype = 'c' 
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.d2d_leads DROP CONSTRAINT ' || constraint_name;
  END IF;

  ALTER TABLE public.d2d_leads ADD CONSTRAINT d2d_leads_status_check 
    CHECK (status IN ('new', 'not_home', 'not_interested', 'interested', 'contract', 'scheduled', 'completed', 'closed_won', 'closed_lost'));
END $$;

NOTIFY pgrst, 'reload schema';
