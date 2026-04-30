/*
  # Extension de la table rappels pour la page Rappels

  1. Nouvelles colonnes
    - `annonce_id` (uuid, nullable) - Lien vers une annonce spécifique
    - `status` (text, default 'pending') - Statut du rappel (pending, completed, postponed, overdue, cancelled)
    - `title` (text, nullable) - Titre concis du rappel
    - `assigned_to_user_id` (uuid, nullable) - Utilisateur assigné au rappel
    - `completed_at` (timestamptz, nullable) - Date de complétion du rappel
    - `original_date_rappel` (timestamptz, nullable) - Date originale avant report

  2. Contraintes
    - Clé étrangère vers annonces(id) avec ON DELETE SET NULL
    - Clé étrangère vers users(id) avec ON DELETE SET NULL
    - Contrainte CHECK pour status
    - Contrainte CHECK pour type_rappel (étendue)

  3. Sécurité
    - Les politiques RLS existantes s'appliquent automatiquement
*/

-- Ajouter la colonne annonce_id pour lier les rappels aux annonces
ALTER TABLE public.rappels
ADD COLUMN IF NOT EXISTS annonce_id uuid;

-- Ajouter la contrainte de clé étrangère pour annonce_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rappels_annonce_id'
    AND table_name = 'rappels'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.rappels
    ADD CONSTRAINT fk_rappels_annonce_id
    FOREIGN KEY (annonce_id) REFERENCES public.annonces(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ajouter la colonne status avec valeur par défaut
ALTER TABLE public.rappels
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- Ajouter la contrainte CHECK pour status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_rappels_status'
    AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE public.rappels
    ADD CONSTRAINT chk_rappels_status
    CHECK (status IN ('pending', 'completed', 'postponed', 'overdue', 'cancelled'));
  END IF;
END $$;

-- Ajouter la colonne title
ALTER TABLE public.rappels
ADD COLUMN IF NOT EXISTS title text;

-- Ajouter la colonne assigned_to_user_id
ALTER TABLE public.rappels
ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid;

-- Ajouter la contrainte de clé étrangère pour assigned_to_user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_rappels_assigned_to_user_id'
    AND table_name = 'rappels'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.rappels
    ADD CONSTRAINT fk_rappels_assigned_to_user_id
    FOREIGN KEY (assigned_to_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ajouter la colonne completed_at
ALTER TABLE public.rappels
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Ajouter la colonne original_date_rappel
ALTER TABLE public.rappels
ADD COLUMN IF NOT EXISTS original_date_rappel timestamp with time zone;

-- Supprimer l'ancienne contrainte type_rappel si elle existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_rappels_type_rappel'
    AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE public.rappels DROP CONSTRAINT chk_rappels_type_rappel;
  END IF;
END $$;

-- Ajouter la nouvelle contrainte CHECK pour type_rappel avec les nouveaux types
ALTER TABLE public.rappels
ADD CONSTRAINT chk_rappels_type_rappel
CHECK (type_rappel IN ('Appel', 'SMS', 'Mail', 'RDV', 'Visite', 'Traitement', 'Autre'));

-- Créer un index sur annonce_id pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_rappels_annonce_id ON public.rappels(annonce_id);

-- Créer un index sur assigned_to_user_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_rappels_assigned_to_user_id ON public.rappels(assigned_to_user_id);

-- Créer un index sur status pour améliorer les performances des filtres
CREATE INDEX IF NOT EXISTS idx_rappels_status ON public.rappels(status);

-- Créer un index composé pour les requêtes fréquentes (user_id + status + date_rappel)
CREATE INDEX IF NOT EXISTS idx_rappels_user_status_date ON public.rappels(user_id, status, date_rappel);

-- Créer un index pour les rappels liés aux annonces d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_rappels_annonce_user ON public.rappels(annonce_id, user_id) WHERE annonce_id IS NOT NULL;