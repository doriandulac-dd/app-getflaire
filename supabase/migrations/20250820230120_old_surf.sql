/*
  # Fix agency creation policy for anonymous users

  1. Security Changes
    - Update existing policy to allow both authenticated and anon users to create agencies
    - This is necessary because during signup, users have anon role when creating agencies
  
  2. Notes
    - The policy allows agency creation during the signup process
    - Once created, other policies control access to the agency data
*/

-- Drop the existing policy and recreate it to include anon users
DROP POLICY IF EXISTS "Allow authenticated users to create agencies" ON public.agencies;

-- Create new policy that allows both authenticated and anon users to insert
CREATE POLICY "Allow users to create agencies"
  ON public.agencies
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);