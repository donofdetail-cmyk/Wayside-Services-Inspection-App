-- Make the existing 'reports' bucket private to prevent PII exposure
UPDATE storage.buckets 
SET public = false 
WHERE id = 'reports';

-- Ensure authenticated users have insert/select access to their own uploads or all reports
-- This assumes the policies might need tweaking, but setting it private is the first step.
-- We can add a policy to ensure they can select if authenticated
CREATE POLICY "Allow authenticated users to read reports" 
ON storage.objects FOR SELECT 
TO authenticated 
USING ( bucket_id = 'reports' );
