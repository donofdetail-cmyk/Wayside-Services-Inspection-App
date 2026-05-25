-- Create a helper function to securely check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'::public.user_role 
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant Admins access to view all inspections
DROP POLICY IF EXISTS "Admins can view all inspections" ON public.inspections;
CREATE POLICY "Admins can view all inspections" ON public.inspections
  FOR SELECT
  USING (public.is_admin());

-- Grant Admins access to view all leads
DROP POLICY IF EXISTS "Admins can view all leads" ON public.d2d_leads;
CREATE POLICY "Admins can view all leads" ON public.d2d_leads
  FOR SELECT
  USING (public.is_admin());
