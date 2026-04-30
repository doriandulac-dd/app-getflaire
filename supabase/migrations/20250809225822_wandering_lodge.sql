/*
  # Create agencies table and refactor users table

  1. New Tables
    - `agencies`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `siren` (text, unique)
      - `address` (text)
      - `phone` (text)
      - `email` (text)
      - `subscription_plan` (text, default 'basic')
      - `max_users` (integer, default 5)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Data Migration
    - Extract unique agencies from existing users table
    - Create agency records for each unique nom_agence/siren combination
    - Update users table to reference agencies via agency_id

  3. Table Modifications
    - Add `agency_id` column to users table
    - Remove `nom_agence` and `siren` columns from users table
    - Add foreign key constraint

  4. Security
    - Enable RLS on `agencies` table
    - Add policies for agencies access
    - Update users policies to work with new schema
*/

-- Step 1: Create the agencies table
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  siren text UNIQUE,
  address text,
  phone text,
  email text,
  subscription_plan text DEFAULT 'basic',
  max_users integer DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Add agency_id column to users table (nullable for now)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'agency_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN agency_id uuid;
  END IF;
END $$;

-- Step 3: Migrate existing agency data
-- Create agencies from unique nom_agence/siren combinations
INSERT INTO public.agencies (name, siren, created_at)
SELECT DISTINCT 
  COALESCE(nom_agence, 'Agence sans nom') as name,
  siren,
  MIN(created_at) as created_at
FROM public.users 
WHERE nom_agence IS NOT NULL
GROUP BY nom_agence, siren
ON CONFLICT (name) DO NOTHING;

-- Handle users without nom_agence by creating a default agency if needed
INSERT INTO public.agencies (name, siren, created_at)
SELECT 'Agence par défaut', NULL, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.agencies WHERE name = 'Agence par défaut'
);

-- Step 4: Update users to reference agencies
UPDATE public.users 
SET agency_id = agencies.id
FROM public.agencies
WHERE users.nom_agence = agencies.name
  AND (users.siren = agencies.siren OR (users.siren IS NULL AND agencies.siren IS NULL));

-- Update users without nom_agence to reference default agency
UPDATE public.users 
SET agency_id = agencies.id
FROM public.agencies
WHERE users.nom_agence IS NULL 
  AND agencies.name = 'Agence par défaut'
  AND users.agency_id IS NULL;

-- Step 5: Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_agency_id_fkey'
  ) THEN
    ALTER TABLE public.users 
    ADD CONSTRAINT users_agency_id_fkey 
    FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 6: Remove old columns (after data migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nom_agence'
  ) THEN
    ALTER TABLE public.users DROP COLUMN nom_agence;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'siren'
  ) THEN
    ALTER TABLE public.users DROP COLUMN siren;
  END IF;
END $$;

-- Step 7: Enable RLS on agencies table
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for agencies

-- Users can read their own agency
CREATE POLICY "Users can read own agency"
ON public.agencies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.agency_id = agencies.id
  )
);

-- Admins can update their own agency
CREATE POLICY "Admins can update own agency"
ON public.agencies FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() 
      AND users.agency_id = agencies.id 
      AND users."Role" = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() 
      AND users.agency_id = agencies.id 
      AND users."Role" = 'admin'
  )
);

-- Step 9: Update users RLS policies to work with new schema

-- Drop existing policies that reference nom_agence
DROP POLICY IF EXISTS "Admins can read agency members" ON public.users;
DROP POLICY IF EXISTS "Admins can add new members to their agency" ON public.users;
DROP POLICY IF EXISTS "Admins can update agency members" ON public.users;
DROP POLICY IF EXISTS "Admins can delete agency members" ON public.users;

-- Recreate policies using agency_id
CREATE POLICY "Admins can read agency members"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE admin_user.id = auth.uid() 
      AND admin_user."Role" = 'admin' 
      AND admin_user.agency_id IS NOT NULL 
      AND admin_user.agency_id = users.agency_id
  )
);

CREATE POLICY "Admins can add new members to their agency"
ON public.users FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE admin_user.id = auth.uid() 
      AND admin_user."Role" = 'admin' 
      AND admin_user.agency_id IS NOT NULL 
      AND admin_user.agency_id = agency_id
  )
);

CREATE POLICY "Admins can update agency members"
ON public.users FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE admin_user.id = auth.uid() 
      AND admin_user."Role" = 'admin' 
      AND admin_user.agency_id IS NOT NULL 
      AND admin_user.agency_id = users.agency_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE admin_user.id = auth.uid() 
      AND admin_user."Role" = 'admin' 
      AND admin_user.agency_id IS NOT NULL 
      AND admin_user.agency_id = agency_id
  )
);

CREATE POLICY "Admins can delete agency members"
ON public.users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users AS admin_user
    WHERE admin_user.id = auth.uid() 
      AND admin_user."Role" = 'admin' 
      AND admin_user.agency_id IS NOT NULL 
      AND admin_user.agency_id = users.agency_id
  )
);

-- Step 10: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_agency_id ON public.users(agency_id);
CREATE INDEX IF NOT EXISTS idx_agencies_name ON public.agencies(name);
CREATE INDEX IF NOT EXISTS idx_agencies_siren ON public.agencies(siren);

-- Step 11: Add trigger to update agencies.updated_at
CREATE OR REPLACE FUNCTION update_agencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_agencies_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_agencies_updated_at_trigger
      BEFORE UPDATE ON public.agencies
      FOR EACH ROW
      EXECUTE FUNCTION update_agencies_updated_at();
  END IF;
END $$;