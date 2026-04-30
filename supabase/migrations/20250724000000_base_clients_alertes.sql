/*
  # Base CRM clients et alertes

  This idempotent base migration makes later alert migrations safe on a fresh database.
*/

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active_search',
  budget_min numeric,
  budget_max numeric,
  property_types text[] DEFAULT '{}',
  locations text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  nom_alerte text NOT NULL,
  type_recherche text NOT NULL DEFAULT 'recherche_agence',
  statut text NOT NULL DEFAULT 'active',
  priorite text NOT NULL DEFAULT 'normal',
  ville text,
  postal_codes text[] DEFAULT '{}',
  radius_km integer NOT NULL DEFAULT 10,
  type_de_bien text,
  prix_min numeric,
  prix_max numeric,
  surface_min numeric,
  surface_max numeric,
  rooms_min integer,
  bedrooms_min integer,
  matching_threshold integer NOT NULL DEFAULT 65,
  frequence_analyse text NOT NULL DEFAULT 'realtime',
  options_avancees jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_matching_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertes ENABLE ROW LEVEL SECURITY;
