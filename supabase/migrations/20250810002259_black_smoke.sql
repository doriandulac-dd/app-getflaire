/*
  # Allow admin user creation

  1. Security Policy Updates
    - Update INSERT policy on `users` table to allow admins to create users for their agency
    - Keep existing self-creation capability
    - Ensure new users can only be created within the same agency as the admin

  2. Changes
    - Replace existing INSERT policy with one that allows both self-creation and admin creation
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "users_insert_own" ON users;

-- Create new policy that allows both self-creation and admin creation
CREATE POLICY "users_insert_policy" 
  ON users 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    -- Allow self-creation (user creating their own profile)
    auth.uid() = id 
    OR 
    -- Allow admin to create users for their agency
    EXISTS (
      SELECT 1 FROM users admin_user 
      WHERE admin_user.id = auth.uid() 
      AND admin_user."Role" = 'admin' 
      AND admin_user.agency_id = users.agency_id
    )
  );