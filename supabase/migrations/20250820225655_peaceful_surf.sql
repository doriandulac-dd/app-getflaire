/*
  # Fix agency creation RLS policy

  1. Security Changes
    - Update the INSERT policy for agencies table to allow authenticated users to create agencies
    - The policy now properly handles the case where a user is creating an agency during signup
    
  2. Notes
    - This fixes the RLS violation error that occurs when users try to sign up as an agency
    - The policy allows any authenticated user to create an agency record
*/

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Allow authenticated users to create agencies" ON public.agencies;

-- Create a new policy that allows authenticated users to insert agencies
CREATE POLICY "Allow authenticated users to create agencies"
  ON public.agencies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);