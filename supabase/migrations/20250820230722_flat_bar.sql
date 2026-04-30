/*
  # Fix agency creation RLS policy

  1. Security Changes
    - Drop existing restrictive INSERT policy on agencies table
    - Create new INSERT policy allowing authenticated users to create agencies
    - Ensure users can create agencies when setting up their account

  This resolves the "new row violates row-level security policy" error
  when users try to create agencies from the settings page.
*/

-- Drop the existing INSERT policy that might be too restrictive
DROP POLICY IF EXISTS "Allow users to create agencies" ON public.agencies;
DROP POLICY IF EXISTS "Allow authenticated users to create agencies" ON public.agencies;

-- Create a new INSERT policy that allows authenticated users to create agencies
CREATE POLICY "Enable INSERT for authenticated users" 
ON public.agencies 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Ensure the existing SELECT policy is correct
DROP POLICY IF EXISTS "Users can read own agency" ON public.agencies;
CREATE POLICY "Users can read own agency"
ON public.agencies
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = auth.uid() 
    AND users.agency_id = agencies.id
  )
);

-- Fix the malformed UPDATE policy
DROP POLICY IF EXISTS "Admins can update own agency" ON public.agencies;
CREATE POLICY "Admins can update own agency"
ON public.agencies
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = auth.uid() 
    AND users.agency_id = agencies.id 
    AND users."Role" = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = auth.uid() 
    AND users.agency_id = agencies.id 
    AND users."Role" = 'admin'
  )
);