/*
  # Système d'alertes complet

  1. Nouvelles tables
    - `alertes_resultats` - Stocke les associations entre alertes et annonces avec scores
    - `alertes_notifications` - Historique des notifications envoyées
    
  2. Modifications des tables existantes
    - Ajout de colonnes manquantes dans `alertes`
    - Amélioration des contraintes
    
  3. Sécurité
    - Politiques RLS pour toutes les nouvelles tables
    - Restrictions d'accès par utilisateur
*/

-- Mise à jour de la table alertes existante
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS rooms_min integer;
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS postal_codes text[];
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS radius_km integer DEFAULT 10;
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS options_avancees jsonb DEFAULT '{}';
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS last_matching_date timestamptz;
ALTER TABLE alertes ADD COLUMN IF NOT EXISTS matching_threshold integer DEFAULT 80;

-- Table des résultats d'alertes
CREATE TABLE IF NOT EXISTS alertes_resultats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerte_id uuid NOT NULL REFERENCES alertes(id) ON DELETE CASCADE,
  annonce_id uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  score_pertinence integer NOT NULL CHECK (score_pertinence >= 0 AND score_pertinence <= 100),
  criteres_matches jsonb DEFAULT '{}',
  date_matching timestamptz DEFAULT now(),
  consulte boolean DEFAULT false,
  date_consultation timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(alerte_id, annonce_id)
);

-- Table des notifications d'alertes
CREATE TABLE IF NOT EXISTS alertes_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerte_id uuid NOT NULL REFERENCES alertes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_notification text NOT NULL CHECK (type_notification IN ('email', 'in_app', 'sms')),
  contenu jsonb NOT NULL,
  envoye boolean DEFAULT false,
  date_envoi timestamptz,
  erreur_envoi text,
  created_at timestamptz DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_alertes_resultats_alerte_id ON alertes_resultats(alerte_id);
CREATE INDEX IF NOT EXISTS idx_alertes_resultats_annonce_id ON alertes_resultats(annonce_id);
CREATE INDEX IF NOT EXISTS idx_alertes_resultats_score ON alertes_resultats(score_pertinence DESC);
CREATE INDEX IF NOT EXISTS idx_alertes_resultats_consulte ON alertes_resultats(consulte);
CREATE INDEX IF NOT EXISTS idx_alertes_notifications_user_id ON alertes_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_alertes_notifications_alerte_id ON alertes_notifications(alerte_id);

-- Politiques RLS pour alertes_resultats
ALTER TABLE alertes_resultats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Résultats alertes : lecture personnelle"
  ON alertes_resultats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM alertes 
      WHERE alertes.id = alertes_resultats.alerte_id 
      AND alertes.user_id = auth.uid()
    )
  );

CREATE POLICY "Résultats alertes : écriture système"
  ON alertes_resultats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Politiques RLS pour alertes_notifications
ALTER TABLE alertes_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notifications alertes : lecture personnelle"
  ON alertes_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Notifications alertes : écriture système"
  ON alertes_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Vue pour les statistiques d'alertes
CREATE OR REPLACE VIEW alertes_stats AS
SELECT 
  a.id,
  a.nom_alerte,
  a.user_id,
  COUNT(ar.id) as total_resultats,
  COUNT(CASE WHEN ar.consulte = false THEN 1 END) as nouveaux_resultats,
  MAX(ar.date_matching) as derniere_correspondance,
  AVG(ar.score_pertinence) as score_moyen
FROM alertes a
LEFT JOIN alertes_resultats ar ON a.id = ar.alerte_id
GROUP BY a.id, a.nom_alerte, a.user_id;

-- Fonction pour calculer le score de pertinence
CREATE OR REPLACE FUNCTION calculate_alert_score(
  alert_criteria jsonb,
  annonce_data jsonb
) RETURNS integer AS $$
DECLARE
  score integer := 0;
  max_score integer := 0;
BEGIN
  -- Type de bien (20 points)
  max_score := max_score + 20;
  IF alert_criteria->>'type_de_bien' IS NOT NULL AND 
     annonce_data->>'type_de_bien' = alert_criteria->>'type_de_bien' THEN
    score := score + 20;
  END IF;
  
  -- Prix (25 points)
  max_score := max_score + 25;
  IF (alert_criteria->>'prix_min')::numeric IS NULL OR 
     (annonce_data->>'price')::numeric >= (alert_criteria->>'prix_min')::numeric THEN
    IF (alert_criteria->>'prix_max')::numeric IS NULL OR 
       (annonce_data->>'price')::numeric <= (alert_criteria->>'prix_max')::numeric THEN
      score := score + 25;
    END IF;
  END IF;
  
  -- Surface (20 points)
  max_score := max_score + 20;
  IF (alert_criteria->>'surface_min')::numeric IS NULL OR 
     (annonce_data->>'size')::numeric >= (alert_criteria->>'surface_min')::numeric THEN
    IF (alert_criteria->>'surface_max')::numeric IS NULL OR 
       (annonce_data->>'size')::numeric <= (alert_criteria->>'surface_max')::numeric THEN
      score := score + 20;
    END IF;
  END IF;
  
  -- Localisation (20 points)
  max_score := max_score + 20;
  IF alert_criteria->>'ville' IS NULL OR 
     annonce_data->>'city' ILIKE '%' || alert_criteria->>'ville' || '%' THEN
    score := score + 20;
  END IF;
  
  -- Nombre de pièces (15 points)
  max_score := max_score + 15;
  IF (alert_criteria->>'rooms_min')::integer IS NULL OR 
     (annonce_data->>'rooms')::integer >= (alert_criteria->>'rooms_min')::integer THEN
    score := score + 15;
  END IF;
  
  -- Calculer le pourcentage
  IF max_score > 0 THEN
    RETURN (score * 100) / max_score;
  ELSE
    RETURN 0;
  END IF;
END;
$$ LANGUAGE plpgsql;