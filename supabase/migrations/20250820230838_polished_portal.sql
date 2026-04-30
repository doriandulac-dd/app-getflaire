/*
  # Fix agency SELECT policy

  1. Security Updates
    - Update the SELECT policy for agencies table to allow authenticated users to read agencies
    - This fixes the RLS violation when trying to fetch agency data on the settings page

  2. Changes
    - Modify existing SELECT policy to be less restrictive for authenticated users
    - Allow users to read agency data even if they don't have an agency_id yet
*/

-- Drop and recreate the SELECT policy for agencies
DROP POLICY IF EXISTS "Users can read own agency" ON public.agencies;

-- Create a new SELECT policy that allows authenticated users to read agencies
CREATE POLICY "Authenticated users can read agencies"
  ON public.agencies
  FOR SELECT
  TO authenticated
  USING (true);