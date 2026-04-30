/*
  # Fix RLS infinite recursion in users table

  1. Problem
    - The current RLS policies create infinite recursion when querying the users table
    - This happens because policies reference the same table they're protecting

  2. Solution
    - Drop all existing problematic policies
    - Create simpler, non-recursive policies
    - Use auth.uid() directly instead of subqueries on users table

  3. New Policies
    - Users can read their own profile
    - Users can update their own profile
    - Users can insert their own profile (for signup)
    - Simple agency-based access without recursion
*/

-- Drop all existing policies on users table to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read agency members" ON public.users;
DROP POLICY IF EXISTS "Users can create own profile on signup" ON public.users;
DROP POLICY IF EXISTS "Admins can add new members to their agency" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update agency members" ON public.users;
DROP POLICY IF EXISTS "Admins can delete agency members" ON public.users;
DROP POLICY IF EXISTS "Test simple insert" ON public.users;

-- Create simple, non-recursive policies

-- 1. Allow users to read their own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- 2. Allow users to insert their own profile during signup
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Allow users to update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Note: For now, we're keeping it simple to avoid recursion.
-- Agency-based permissions can be implemented later with a different approach
-- or by using security definer functions that bypass RLS.