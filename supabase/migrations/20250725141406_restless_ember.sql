/*
  # Module Surveillance - Tables et politiques

  1. Nouvelles tables
    - `surveillances` - Annonces mises sous surveillance par utilisateur
    - `surveillance_historique` - Historique des modifications des annonces surveillées
    - `surveillance_notifications` - Notifications de changements
    - `surveillance_settings` - Paramètres de notification par utilisateur

  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques pour lecture/écriture personnelle
*/

-- Table des surveillances (annonces suivies par utilisateur)
CREATE TABLE IF NOT EXISTS surveillances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  annonce_id uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  date_surveillance timestamptz DEFAULT now(),
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, annonce_id)
);

-- Table historique des modifications des annonces surveillées
CREATE TABLE IF NOT EXISTS surveillance_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surveillance_id uuid NOT NULL REFERENCES surveillances(id) ON DELETE CASCADE,
  annonce_id uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  type_modification text NOT NULL CHECK (type_modification IN (
    'prix_change', 'description_change', 'title_change', 'status_change', 
    'images_change', 'mise_en_ligne', 'mise_hors_ligne', 'suppression'
  )),
  ancienne_valeur text,
  nouvelle_valeur text,
  date_modification timestamptz DEFAULT now(),
  detecte_le timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Table des notifications de surveillance
CREATE TABLE IF NOT EXISTS surveillance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  surveillance_id uuid NOT NULL REFERENCES surveillances(id) ON DELETE CASCADE,
  annonce_id uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  type_notification text NOT NULL CHECK (type_notification IN ('email', 'in_app', 'sms')),
  contenu jsonb NOT NULL,
  envoye boolean DEFAULT false,
  date_envoi timestamptz,
  erreur_envoi text,
  created_at timestamptz DEFAULT now()
);

-- Table des paramètres de surveillance par utilisateur
CREATE TABLE IF NOT EXISTS surveillance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  notifications_email boolean DEFAULT true,
  notifications_app boolean DEFAULT true,
  notifications_sms boolean DEFAULT false,
  frequence_email text DEFAULT 'immediate' CHECK (frequence_email IN ('immediate', 'daily', 'weekly')),
  types_modifications text[] DEFAULT ARRAY['prix_change', 'status_change', 'mise_hors_ligne'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_surveillances_user_id ON surveillances(user_id);
CREATE INDEX IF NOT EXISTS idx_surveillances_annonce_id ON surveillances(annonce_id);
CREATE INDEX IF NOT EXISTS idx_surveillances_active ON surveillances(active);
CREATE INDEX IF NOT EXISTS idx_surveillance_historique_surveillance_id ON surveillance_historique(surveillance_id);
CREATE INDEX IF NOT EXISTS idx_surveillance_historique_annonce_id ON surveillance_historique(annonce_id);
CREATE INDEX IF NOT EXISTS idx_surveillance_historique_date ON surveillance_historique(date_modification DESC);
CREATE INDEX IF NOT EXISTS idx_surveillance_notifications_user_id ON surveillance_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_surveillance_notifications_envoye ON surveillance_notifications(envoye);

-- Activer RLS
ALTER TABLE surveillances ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveillance_historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveillance_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveillance_settings ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour surveillances
CREATE POLICY "Surveillances : lecture/écriture personnelle"
  ON surveillances
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Politiques RLS pour surveillance_historique
CREATE POLICY "Historique surveillance : lecture personnelle"
  ON surveillance_historique
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveillances 
      WHERE surveillances.id = surveillance_historique.surveillance_id 
      AND surveillances.user_id = auth.uid()
    )
  );

CREATE POLICY "Historique surveillance : écriture système"
  ON surveillance_historique
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Politiques RLS pour surveillance_notifications
CREATE POLICY "Notifications surveillance : lecture personnelle"
  ON surveillance_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Notifications surveillance : écriture système"
  ON surveillance_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Politiques RLS pour surveillance_settings
CREATE POLICY "Paramètres surveillance : lecture/écriture personnelle"
  ON surveillance_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Vue pour les surveillances avec détails des annonces
CREATE OR REPLACE VIEW surveillances_with_details AS
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
  -- Compter les modifications depuis la surveillance
  (
    SELECT COUNT(*) 
    FROM surveillance_historique sh 
    WHERE sh.surveillance_id = s.id
  ) as nb_modifications,
  -- Dernière modification
  (
    SELECT sh.date_modification 
    FROM surveillance_historique sh 
    WHERE sh.surveillance_id = s.id 
    ORDER BY sh.date_modification DESC 
    LIMIT 1
  ) as derniere_modification,
  -- Type de dernière modification
  (
    SELECT sh.type_modification 
    FROM surveillance_historique sh 
    WHERE sh.surveillance_id = s.id 
    ORDER BY sh.date_modification DESC 
    LIMIT 1
  ) as type_derniere_modification
FROM surveillances s
JOIN annonces a ON s.annonce_id = a.id
WHERE s.active = true;