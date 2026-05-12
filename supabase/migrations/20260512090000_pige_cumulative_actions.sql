/*
  # Actions cumulables pour la pige

  - Ajoute une table d'actions commerciales cumulables par annonce.
  - Ajoute une table de notes multiples horodatées.
  - Garde l'auteur réel de chaque action et la visibilité agence.
*/

CREATE TABLE IF NOT EXISTS public.pige_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id uuid NOT NULL REFERENCES public.annonces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('to_call', 'called', 'reminder', 'rdv', 'hidden', 'viewed')),
  active boolean NOT NULL DEFAULT true,
  scheduled_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pige_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id uuid NOT NULL REFERENCES public.annonces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pige_actions_agency_annonce ON public.pige_actions(agency_id, annonce_id);
CREATE INDEX IF NOT EXISTS idx_pige_actions_user_annonce ON public.pige_actions(user_id, annonce_id);
CREATE INDEX IF NOT EXISTS idx_pige_actions_type_active ON public.pige_actions(action_type, active);
CREATE INDEX IF NOT EXISTS idx_pige_actions_scheduled_at ON public.pige_actions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_pige_notes_agency_annonce ON public.pige_notes(agency_id, annonce_id);
CREATE INDEX IF NOT EXISTS idx_pige_notes_user_annonce ON public.pige_notes(user_id, annonce_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pige_actions_agency_unique_active
  ON public.pige_actions(agency_id, annonce_id, action_type)
  WHERE agency_id IS NOT NULL AND active = true AND action_type <> 'called';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pige_actions_user_unique_active
  ON public.pige_actions(user_id, annonce_id, action_type)
  WHERE agency_id IS NULL AND active = true AND action_type <> 'called';

ALTER TABLE public.pige_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pige_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pige_actions_select_scope" ON public.pige_actions;
CREATE POLICY "pige_actions_select_scope"
  ON public.pige_actions
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      agency_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.agency_id = pige_actions.agency_id
          AND u."Role" IN ('admin', 'agent')
      )
    )
  );

DROP POLICY IF EXISTS "pige_actions_mutate_own" ON public.pige_actions;
CREATE POLICY "pige_actions_mutate_own"
  ON public.pige_actions
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      agency_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.agency_id = pige_actions.agency_id
          AND u."Role" IN ('admin', 'agent')
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      agency_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.agency_id = pige_actions.agency_id
          AND u."Role" IN ('admin', 'agent')
      )
    )
  );

DROP POLICY IF EXISTS "pige_notes_select_scope" ON public.pige_notes;
CREATE POLICY "pige_notes_select_scope"
  ON public.pige_notes
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      agency_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.agency_id = pige_notes.agency_id
          AND u."Role" IN ('admin', 'agent')
      )
    )
  );

DROP POLICY IF EXISTS "pige_notes_mutate_own" ON public.pige_notes;
CREATE POLICY "pige_notes_mutate_own"
  ON public.pige_notes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      agency_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.agency_id = pige_notes.agency_id
          AND u."Role" IN ('admin', 'agent')
      )
    )
  );

INSERT INTO public.pige_actions (annonce_id, user_id, agency_id, action_type, active, scheduled_at, note, created_at, updated_at)
SELECT
  sa.annonce_id,
  COALESCE(sa.updated_by, sa.user_id),
  sa.agency_id,
  CASE
    WHEN sa.statut = 'to_process' THEN 'to_call'
    WHEN sa.statut = 'to_call' THEN 'reminder'
    ELSE sa.statut
  END,
  true,
  sa.date_suivi,
  sa.note,
  COALESCE(sa.created_at, sa.date_suivi, now()),
  COALESCE(sa.date_suivi, sa.created_at, now())
FROM public.suivi_annonce sa
WHERE sa.statut IN ('to_process', 'to_call', 'called', 'rdv', 'hidden')
  AND NOT EXISTS (
    SELECT 1 FROM public.pige_actions pa
    WHERE pa.annonce_id = sa.annonce_id
      AND pa.action_type = CASE
        WHEN sa.statut = 'to_process' THEN 'to_call'
        WHEN sa.statut = 'to_call' THEN 'reminder'
        ELSE sa.statut
      END
      AND (
        (pa.agency_id IS NOT NULL AND pa.agency_id = sa.agency_id)
        OR (pa.agency_id IS NULL AND pa.user_id = sa.user_id)
      )
  );

INSERT INTO public.pige_notes (annonce_id, user_id, agency_id, content, created_at, updated_at)
SELECT
  sa.annonce_id,
  COALESCE(sa.updated_by, sa.user_id),
  sa.agency_id,
  sa.note,
  COALESCE(sa.date_suivi, sa.created_at, now()),
  COALESCE(sa.date_suivi, sa.created_at, now())
FROM public.suivi_annonce sa
WHERE sa.note IS NOT NULL
  AND btrim(sa.note) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.pige_notes pn
    WHERE pn.annonce_id = sa.annonce_id
      AND pn.content = sa.note
      AND (
        (pn.agency_id IS NOT NULL AND pn.agency_id = sa.agency_id)
        OR (pn.agency_id IS NULL AND pn.user_id = sa.user_id)
      )
  );
