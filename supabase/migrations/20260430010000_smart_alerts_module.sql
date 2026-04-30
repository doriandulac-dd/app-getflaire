/*
  # Alertes intelligentes GetFlaire

  Adds a non-destructive smart matching layer for client searches.
*/

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active_search'
    CHECK (status IN ('active_search', 'signature', 'follow_up', 'inactive')),
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
  statut text NOT NULL DEFAULT 'active'
    CHECK (statut IN ('active', 'paused', 'archived', 'project', 'abandoned')),
  priorite text NOT NULL DEFAULT 'normal'
    CHECK (priorite IN ('low', 'normal', 'high', 'urgent')),
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
  matching_threshold integer NOT NULL DEFAULT 65 CHECK (matching_threshold >= 0 AND matching_threshold <= 100),
  frequence_analyse text NOT NULL DEFAULT 'realtime'
    CHECK (frequence_analyse IN ('realtime', 'hourly', 'twice_daily', 'daily', 'manual')),
  options_avancees jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_matching_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE CASCADE;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS type_recherche text DEFAULT 'recherche_agence';
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS statut text DEFAULT 'active';
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS priorite text DEFAULT 'normal';
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS ville text;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS type_de_bien text;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS prix_min numeric;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS prix_max numeric;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS surface_min numeric;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS surface_max numeric;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS bedrooms_min integer;
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS frequence_analyse text DEFAULT 'realtime';
ALTER TABLE public.alertes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.alertes_resultats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerte_id uuid NOT NULL REFERENCES public.alertes(id) ON DELETE CASCADE,
  annonce_id uuid NOT NULL REFERENCES public.annonces(id) ON DELETE CASCADE,
  score_pertinence integer NOT NULL CHECK (score_pertinence >= 0 AND score_pertinence <= 100),
  criteres_matches jsonb DEFAULT '{}',
  score_breakdown jsonb NOT NULL DEFAULT '{}',
  points_forts text[] NOT NULL DEFAULT '{}',
  points_faibles text[] NOT NULL DEFAULT '{}',
  resume text,
  statut_commercial text NOT NULL DEFAULT 'new'
    CHECK (statut_commercial IN ('new', 'viewed', 'sent', 'ignored', 'favorite', 'followed')),
  date_matching timestamptz DEFAULT now(),
  consulte boolean DEFAULT false,
  date_consultation timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(alerte_id, annonce_id)
);

ALTER TABLE public.alertes_resultats ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.alertes_resultats ADD COLUMN IF NOT EXISTS points_forts text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.alertes_resultats ADD COLUMN IF NOT EXISTS points_faibles text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.alertes_resultats ADD COLUMN IF NOT EXISTS resume text;
ALTER TABLE public.alertes_resultats ADD COLUMN IF NOT EXISTS statut_commercial text NOT NULL DEFAULT 'new';
ALTER TABLE public.alertes_resultats ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.alertes_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerte_id uuid NOT NULL REFERENCES public.alertes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type_notification text NOT NULL DEFAULT 'in_app' CHECK (type_notification IN ('email', 'in_app', 'sms')),
  contenu jsonb NOT NULL,
  envoye boolean DEFAULT false,
  date_envoi timestamptz,
  read_at timestamptz,
  erreur_envoi text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.alertes_notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE TABLE IF NOT EXISTS public.alertes_matching_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerte_id uuid REFERENCES public.alertes(id) ON DELETE CASCADE,
  annonce_id uuid REFERENCES public.annonces(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'new_annonce',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON public.clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_alertes_user_id ON public.alertes(user_id);
CREATE INDEX IF NOT EXISTS idx_alertes_agency_status ON public.alertes(agency_id, statut);
CREATE INDEX IF NOT EXISTS idx_alertes_active_threshold ON public.alertes(is_active, matching_threshold);
CREATE INDEX IF NOT EXISTS idx_alertes_resultats_alerte_score ON public.alertes_resultats(alerte_id, score_pertinence DESC);
CREATE INDEX IF NOT EXISTS idx_alertes_resultats_statut ON public.alertes_resultats(statut_commercial);
CREATE INDEX IF NOT EXISTS idx_alertes_notifications_user_read ON public.alertes_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_alertes_matching_jobs_status ON public.alertes_matching_jobs(status, created_at);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertes_resultats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertes_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertes_matching_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_own_agency" ON public.clients;
CREATE POLICY "clients_select_own_agency" ON public.clients
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.agency_id IS NOT NULL
      AND u.agency_id = clients.agency_id
    )
  );

DROP POLICY IF EXISTS "clients_mutate_own_agency" ON public.clients;
CREATE POLICY "clients_mutate_own_agency" ON public.clients
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.agency_id IS NOT NULL
      AND u.agency_id = clients.agency_id
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.agency_id IS NOT NULL
      AND u.agency_id = clients.agency_id
    )
  );

DROP POLICY IF EXISTS "alertes_select_own_agency" ON public.alertes;
CREATE POLICY "alertes_select_own_agency" ON public.alertes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.agency_id IS NOT NULL
      AND u.agency_id = alertes.agency_id
    )
  );

DROP POLICY IF EXISTS "alertes_mutate_own" ON public.alertes;
CREATE POLICY "alertes_mutate_own" ON public.alertes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "alertes_resultats_select_own_alertes" ON public.alertes_resultats;
CREATE POLICY "alertes_resultats_select_own_alertes" ON public.alertes_resultats
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.alertes a
      WHERE a.id = alertes_resultats.alerte_id
      AND (
        a.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND u.agency_id IS NOT NULL
          AND u.agency_id = a.agency_id
        )
      )
    )
  );

DROP POLICY IF EXISTS "alertes_resultats_mutate_own_alertes" ON public.alertes_resultats;
CREATE POLICY "alertes_resultats_mutate_own_alertes" ON public.alertes_resultats
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alertes a WHERE a.id = alertes_resultats.alerte_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.alertes a WHERE a.id = alertes_resultats.alerte_id AND a.user_id = auth.uid()));

DROP POLICY IF EXISTS "alertes_notifications_select_own" ON public.alertes_notifications;
CREATE POLICY "alertes_notifications_select_own" ON public.alertes_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "alertes_notifications_update_own" ON public.alertes_notifications;
CREATE POLICY "alertes_notifications_update_own" ON public.alertes_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "alertes_matching_jobs_service" ON public.alertes_matching_jobs;
CREATE POLICY "alertes_matching_jobs_service" ON public.alertes_matching_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.enqueue_smart_alert_jobs_for_annonce()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.alertes_matching_jobs (alerte_id, annonce_id, reason)
  SELECT a.id, NEW.id, TG_OP || '_annonce'
  FROM public.alertes a
  WHERE a.is_active = true
    AND a.statut = 'active'
    AND a.frequence_analyse = 'realtime'
    AND (a.type_de_bien IS NULL OR NEW.type_de_bien IS NULL OR a.type_de_bien = NEW.type_de_bien)
    AND (a.ville IS NULL OR NEW.city ILIKE '%' || a.ville || '%')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enqueue_smart_alert_jobs_for_annonce ON public.annonces;
CREATE TRIGGER trg_enqueue_smart_alert_jobs_for_annonce
AFTER INSERT OR UPDATE OF price, size, rooms, bedrooms, type_de_bien, city, description, en_ligne, supprimee
ON public.annonces
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_smart_alert_jobs_for_annonce();
