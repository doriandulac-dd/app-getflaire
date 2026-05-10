/*
  # Optimize dashboard annonce counts

  Adds non-destructive indexes for the dashboard filters used by KPI counts and
  recent activity charts.
*/

CREATE INDEX IF NOT EXISTS idx_annonces_dashboard_owner_online
  ON public.annonces (owner_type, publication_date DESC)
  WHERE en_ligne IS TRUE AND supprimee IS FALSE;

CREATE INDEX IF NOT EXISTS idx_annonces_dashboard_publication_online
  ON public.annonces (publication_date DESC)
  WHERE en_ligne IS TRUE AND supprimee IS FALSE;

CREATE INDEX IF NOT EXISTS idx_annonces_dashboard_city_online
  ON public.annonces (city, publication_date DESC)
  WHERE en_ligne IS TRUE AND supprimee IS FALSE;
