/*
  # Correction des politiques RLS pour alertes_resultats

  1. Politique RLS
    - Permet aux utilisateurs authentifiés d'insérer des résultats pour leurs propres alertes
    - Maintient la sécurité en vérifiant que l'alerte appartient bien à l'utilisateur

  2. Sécurité
    - Vérification que l'utilisateur est propriétaire de l'alerte
    - Lecture limitée aux résultats des alertes de l'utilisateur
*/

-- Supprimer l'ancienne politique d'écriture restrictive
DROP POLICY IF EXISTS "Résultats alertes : écriture système" ON alertes_resultats;

-- Créer une nouvelle politique permettant aux utilisateurs d'insérer des résultats pour leurs alertes
CREATE POLICY "Résultats alertes : insertion personnelle"
  ON alertes_resultats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM alertes 
      WHERE alertes.id = alertes_resultats.alerte_id 
      AND alertes.user_id = auth.uid()
    )
  );

-- Créer une politique pour la mise à jour (consultation des résultats)
CREATE POLICY "Résultats alertes : mise à jour personnelle"
  ON alertes_resultats
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM alertes 
      WHERE alertes.id = alertes_resultats.alerte_id 
      AND alertes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM alertes 
      WHERE alertes.id = alertes_resultats.alerte_id 
      AND alertes.user_id = auth.uid()
    )
  );

-- Maintenir la politique système pour les opérations automatiques
CREATE POLICY "Résultats alertes : écriture système"
  ON alertes_resultats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);