/*
  # Visibilité agence pour l'activité commerciale

  - Ajoute agency_id / updated_by sur les tables d'activité si elles existent.
  - Backfill agency_id depuis users.agency_id.
  - Rend suivi_annonce partagé au niveau agence avec une seule ligne active par annonce/agence.
  - Ouvre la lecture RLS aux membres de la même agence, tout en gardant les indépendants isolés.
*/

ALTER TABLE IF EXISTS public.suivi_annonce
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.favoris
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.surveillances
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.rappels
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.current_user_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "Role"::text FROM public.users WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "users_select_agency_members" ON public.users;
CREATE POLICY "users_select_agency_members"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      agency_id IS NOT NULL
      AND agency_id = public.current_user_agency_id()
      AND public.current_user_role() IN ('admin', 'agent')
    )
  );

DO $$
BEGIN
  IF to_regclass('public.suivi_annonce') IS NOT NULL THEN
    UPDATE public.suivi_annonce sa
    SET agency_id = u.agency_id,
        updated_by = COALESCE(sa.updated_by, sa.user_id)
    FROM public.users u
    WHERE sa.user_id = u.id
      AND sa.agency_id IS NULL
      AND u.agency_id IS NOT NULL;
  END IF;

  IF to_regclass('public.favoris') IS NOT NULL THEN
    UPDATE public.favoris f
    SET agency_id = u.agency_id
    FROM public.users u
    WHERE f.user_id = u.id
      AND f.agency_id IS NULL
      AND u.agency_id IS NOT NULL;
  END IF;

  IF to_regclass('public.surveillances') IS NOT NULL THEN
    UPDATE public.surveillances s
    SET agency_id = u.agency_id
    FROM public.users u
    WHERE s.user_id = u.id
      AND s.agency_id IS NULL
      AND u.agency_id IS NOT NULL;
  END IF;

  IF to_regclass('public.rappels') IS NOT NULL THEN
    UPDATE public.rappels r
    SET agency_id = u.agency_id,
        updated_by = COALESCE(r.updated_by, r.user_id)
    FROM public.users u
    WHERE r.user_id = u.id
      AND r.agency_id IS NULL
      AND u.agency_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.suivi_annonce') IS NOT NULL THEN
    DELETE FROM public.suivi_annonce sa
    USING public.suivi_annonce newer
    WHERE sa.agency_id IS NOT NULL
      AND newer.agency_id = sa.agency_id
      AND newer.annonce_id = sa.annonce_id
      AND COALESCE(newer.date_suivi, newer.created_at, now()) > COALESCE(sa.date_suivi, sa.created_at, now());

    DELETE FROM public.suivi_annonce sa
    USING public.suivi_annonce newer
    WHERE sa.agency_id IS NULL
      AND newer.agency_id IS NULL
      AND newer.user_id = sa.user_id
      AND newer.annonce_id = sa.annonce_id
      AND COALESCE(newer.date_suivi, newer.created_at, now()) > COALESCE(sa.date_suivi, sa.created_at, now());
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.suivi_annonce') IS NOT NULL THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_suivi_annonce_agency_annonce_unique ON public.suivi_annonce(agency_id, annonce_id) WHERE agency_id IS NOT NULL';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_suivi_annonce_user_annonce_unique ON public.suivi_annonce(user_id, annonce_id) WHERE agency_id IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_suivi_annonce_agency_statut ON public.suivi_annonce(agency_id, statut)';
    EXECUTE 'DROP POLICY IF EXISTS "suivi_annonce_activity_select_scope" ON public.suivi_annonce';
    EXECUTE 'CREATE POLICY "suivi_annonce_activity_select_scope" ON public.suivi_annonce FOR SELECT TO authenticated USING (user_id = auth.uid() OR (agency_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = suivi_annonce.agency_id AND u."Role" IN (''admin'', ''agent''))))';
    EXECUTE 'DROP POLICY IF EXISTS "suivi_annonce_activity_mutate_scope" ON public.suivi_annonce';
    EXECUTE 'CREATE POLICY "suivi_annonce_activity_mutate_scope" ON public.suivi_annonce FOR ALL TO authenticated USING (user_id = auth.uid() OR (agency_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = suivi_annonce.agency_id AND u."Role" IN (''admin'', ''agent'')))) WITH CHECK (user_id = auth.uid() AND (agency_id IS NULL OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = suivi_annonce.agency_id AND u."Role" IN (''admin'', ''agent''))))';
  END IF;

  IF to_regclass('public.favoris') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_favoris_agency_annonce ON public.favoris(agency_id, annonce_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_favoris_user_annonce ON public.favoris(user_id, annonce_id)';
    EXECUTE 'DROP POLICY IF EXISTS "favoris_activity_select_scope" ON public.favoris';
    EXECUTE 'CREATE POLICY "favoris_activity_select_scope" ON public.favoris FOR SELECT TO authenticated USING (user_id = auth.uid() OR (agency_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = favoris.agency_id AND u."Role" IN (''admin'', ''agent''))))';
    EXECUTE 'DROP POLICY IF EXISTS "favoris_activity_mutate_own" ON public.favoris';
    EXECUTE 'CREATE POLICY "favoris_activity_mutate_own" ON public.favoris FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND (agency_id IS NULL OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = favoris.agency_id AND u."Role" IN (''admin'', ''agent''))))';
  END IF;

  IF to_regclass('public.surveillances') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_surveillances_agency_active ON public.surveillances(agency_id, active)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_surveillances_agency_annonce ON public.surveillances(agency_id, annonce_id)';
    EXECUTE 'DROP POLICY IF EXISTS "surveillances_activity_select_scope" ON public.surveillances';
    EXECUTE 'CREATE POLICY "surveillances_activity_select_scope" ON public.surveillances FOR SELECT TO authenticated USING (user_id = auth.uid() OR (agency_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = surveillances.agency_id AND u."Role" IN (''admin'', ''agent''))))';
    EXECUTE 'DROP POLICY IF EXISTS "surveillances_activity_mutate_scope" ON public.surveillances';
    EXECUTE 'CREATE POLICY "surveillances_activity_mutate_scope" ON public.surveillances FOR ALL TO authenticated USING (user_id = auth.uid() OR (agency_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = surveillances.agency_id AND u."Role" IN (''admin'', ''agent'')))) WITH CHECK (user_id = auth.uid() AND (agency_id IS NULL OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = surveillances.agency_id AND u."Role" IN (''admin'', ''agent''))))';
  END IF;

  IF to_regclass('public.rappels') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_rappels_agency_status_date ON public.rappels(agency_id, status, date_rappel)';
    EXECUTE 'DROP POLICY IF EXISTS "rappels_activity_select_scope" ON public.rappels';
    EXECUTE 'CREATE POLICY "rappels_activity_select_scope" ON public.rappels FOR SELECT TO authenticated USING (user_id = auth.uid() OR (agency_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = rappels.agency_id AND u."Role" IN (''admin'', ''agent''))))';
    EXECUTE 'DROP POLICY IF EXISTS "rappels_activity_mutate_scope" ON public.rappels';
    EXECUTE 'CREATE POLICY "rappels_activity_mutate_scope" ON public.rappels FOR ALL TO authenticated USING (user_id = auth.uid() OR (agency_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = rappels.agency_id AND u."Role" IN (''admin'', ''agent'')))) WITH CHECK (user_id = auth.uid() AND (agency_id IS NULL OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.agency_id = rappels.agency_id AND u."Role" IN (''admin'', ''agent''))))';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.surveillances_with_details
WITH (security_invoker = true) AS
SELECT 
  s.*,
  a.title,
  a.price,
  a.city,
  a.type_de_bien,
  a.size,
  a.rooms,
  a.en_ligne,
  a.supprimee,
  a.image_urls,
  a.url as annonce_url,
  a.source,
  (
    SELECT COUNT(*) 
    FROM public.surveillance_historique sh 
    WHERE sh.surveillance_id = s.id
  ) as nb_modifications,
  (
    SELECT sh.date_modification 
    FROM public.surveillance_historique sh 
    WHERE sh.surveillance_id = s.id 
    ORDER BY sh.date_modification DESC 
    LIMIT 1
  ) as derniere_modification,
  (
    SELECT sh.type_modification 
    FROM public.surveillance_historique sh 
    WHERE sh.surveillance_id = s.id 
    ORDER BY sh.date_modification DESC 
    LIMIT 1
  ) as type_derniere_modification
FROM public.surveillances s
JOIN public.annonces a ON s.annonce_id = a.id
WHERE s.active = true;
