/*
  # Add INSERT policy for agencies table

  1. Security Changes
    - Add policy to allow authenticated users to create agencies
    - This enables the signup process for agency users

  Note: This policy allows any authenticated user to create an agency.
  In a production environment, you might want to add additional checks
  or move agency creation to a server-side function for better security.
*/

-- Add INSERT policy for agencies table
CREATE POLICY "Allow authenticated users to create agencies"
  ON public.agencies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);