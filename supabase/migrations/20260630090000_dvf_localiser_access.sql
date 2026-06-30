-- Secure and expose localized DVF rows for authenticated prospection map reads.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public."DVF Localiser" FROM anon, authenticated;
REVOKE SELECT ON public."DVF Localiser" FROM anon;
GRANT SELECT ON public."DVF Localiser" TO authenticated;

DROP POLICY IF EXISTS "dvf_authenticated_read" ON public."DVF Localiser";
CREATE POLICY "dvf_authenticated_read" ON public."DVF Localiser"
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS dvf_localiser_department_idx
  ON public."DVF Localiser" (code_departement);

CREATE INDEX IF NOT EXISTS dvf_localiser_date_idx
  ON public."DVF Localiser" (date_mutation);

CREATE INDEX IF NOT EXISTS dvf_localiser_coordinates_idx
  ON public."DVF Localiser" (
    (replace(longitude, ',', '.')::double precision),
    (replace(latitude, ',', '.')::double precision)
  )
  WHERE longitude ~ '^-?[0-9]+([,.][0-9]+)?$'
    AND latitude ~ '^-?[0-9]+([,.][0-9]+)?$';

CREATE OR REPLACE FUNCTION public.get_dvf_mutations_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  department_codes text[] DEFAULT NULL,
  limit_count integer DEFAULT 500
) RETURNS TABLE (
  mutation_key text,
  id_mutation text,
  date_mutation date,
  nature_mutation text,
  valeur_fonciere numeric,
  adresse text,
  code_postal text,
  code_commune text,
  nom_commune text,
  code_departement text,
  id_parcelle text,
  type_local text,
  surface_reelle_bati numeric,
  surface_terrain numeric,
  nombre_pieces_principales integer,
  longitude double precision,
  latitude double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT
      md5(concat_ws('|',
        id_mutation,
        date_mutation,
        numero_disposition::text,
        id_parcelle,
        code_type_local,
        lot1_numero,
        longitude,
        latitude
      )) AS mutation_key,
      id_mutation,
      CASE WHEN date_mutation ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN date_mutation::date ELSE NULL END AS date_mutation,
      nature_mutation,
      CASE WHEN valeur_fonciere ~ '^[0-9]+([,.][0-9]+)?$' THEN replace(valeur_fonciere, ',', '.')::numeric ELSE NULL END AS valeur_fonciere,
      concat_ws(' ', nullif(adresse_numero, ''), nullif(adresse_suffixe, ''), nullif(adresse_nom_voie, '')) AS adresse,
      code_postal,
      code_commune,
      nom_commune,
      code_departement,
      id_parcelle,
      type_local,
      CASE WHEN surface_reelle_bati ~ '^[0-9]+([,.][0-9]+)?$' THEN replace(surface_reelle_bati, ',', '.')::numeric ELSE NULL END AS surface_reelle_bati,
      CASE WHEN surface_terrain ~ '^[0-9]+([,.][0-9]+)?$' THEN replace(surface_terrain, ',', '.')::numeric ELSE NULL END AS surface_terrain,
      CASE WHEN nombre_pieces_principales ~ '^[0-9]+$' THEN nombre_pieces_principales::integer ELSE NULL END AS nombre_pieces_principales,
      replace(longitude, ',', '.')::double precision AS longitude,
      replace(latitude, ',', '.')::double precision AS latitude
    FROM public."DVF Localiser"
    WHERE longitude ~ '^-?[0-9]+([,.][0-9]+)?$'
      AND latitude ~ '^-?[0-9]+([,.][0-9]+)?$'
      AND (department_codes IS NULL OR code_departement = ANY(department_codes))
  )
  SELECT *
  FROM cleaned
  WHERE longitude BETWEEN min_lng AND max_lng
    AND latitude BETWEEN min_lat AND max_lat
  ORDER BY date_mutation DESC NULLS LAST, valeur_fonciere DESC NULLS LAST
  LIMIT least(greatest(coalesce(limit_count, 500), 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.get_dvf_mutations_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  text[],
  integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dvf_mutations_in_bbox(
  double precision,
  double precision,
  double precision,
  double precision,
  text[],
  integer
) TO authenticated;
