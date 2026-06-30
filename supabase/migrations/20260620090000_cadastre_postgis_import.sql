/*
  # Import cadastre PostGIS

  Production-ready storage and RPC layer for French cadastral data.
  Geometries are stored as SRID 4326 multipolygons and imported through
  service-role-only batch functions that accept streamed GeoJSON features.
*/

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.geo_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_code text NOT NULL,
  vintage_date date NOT NULL,
  layer_name text NOT NULL,
  source_dir text NOT NULL,
  source_file text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  processed_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  deleted_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  last_feature_index integer NOT NULL DEFAULT 0,
  last_batch_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_code, vintage_date, layer_name)
);

CREATE TABLE IF NOT EXISTS public.geo_communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text NOT NULL,
  name text NOT NULL,
  source_created_on date,
  source_updated_on date,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE (department_code, commune_code)
);

CREATE TABLE IF NOT EXISTS public.geo_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text NOT NULL,
  prefix_code text NOT NULL,
  section_code text NOT NULL,
  source_created_on date,
  source_updated_on date,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE (department_code, commune_code, prefix_code, section_code)
);

CREATE TABLE IF NOT EXISTS public.geo_parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text NOT NULL,
  prefix_code text NOT NULL,
  section_code text NOT NULL,
  parcel_number text NOT NULL,
  parcel_code text NOT NULL,
  area_cadastre integer,
  is_surveyed boolean,
  source_created_on date,
  source_updated_on date,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE (department_code, parcel_code)
);

CREATE TABLE IF NOT EXISTS public.geo_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text NOT NULL,
  building_type text,
  name text,
  source_created_on date,
  source_updated_on date,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE (department_code, commune_code, source_hash)
);

CREATE TABLE IF NOT EXISTS public.geo_cadastral_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text NOT NULL,
  prefix_code text NOT NULL,
  section_code text NOT NULL,
  sheet_number text NOT NULL,
  quality_code text,
  confection_mode text,
  scale integer,
  source_created_on date,
  source_updated_on date,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE (department_code, source_id)
);

CREATE TABLE IF NOT EXISTS public.geo_localities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text NOT NULL,
  name text,
  source_created_on date,
  source_updated_on date,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE (department_code, commune_code, source_hash)
);

CREATE TABLE IF NOT EXISTS public.geo_section_prefixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text NOT NULL,
  prefix_code text NOT NULL,
  old_commune_code text,
  name text,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE (department_code, commune_code, prefix_code)
);

CREATE TABLE IF NOT EXISTS public.geo_fiscal_subdivisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text,
  department_code text NOT NULL,
  commune_code text,
  parcel_code text,
  fiscal_letter text,
  source_created_on date,
  source_updated_on date,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  source_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  UNIQUE NULLS NOT DISTINCT (department_code, parcel_code, fiscal_letter, source_hash)
);

CREATE TABLE IF NOT EXISTS public.geo_parcel_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_code text NOT NULL,
  parcel_id uuid NOT NULL REFERENCES public.geo_parcels(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.geo_buildings(id) ON DELETE CASCADE,
  parcel_code text NOT NULL,
  intersection_area_m2 double precision,
  overlap_ratio double precision,
  vintage_date date NOT NULL,
  import_job_id uuid REFERENCES public.geo_import_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parcel_id, building_id)
);

CREATE INDEX IF NOT EXISTS idx_geo_import_jobs_status ON public.geo_import_jobs(status, department_code, vintage_date);

CREATE INDEX IF NOT EXISTS idx_geo_communes_geom ON public.geo_communes USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_sections_geom ON public.geo_sections USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_parcels_geom ON public.geo_parcels USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_buildings_geom ON public.geo_buildings USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_cadastral_sheets_geom ON public.geo_cadastral_sheets USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_localities_geom ON public.geo_localities USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_section_prefixes_geom ON public.geo_section_prefixes USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_geo_fiscal_subdivisions_geom ON public.geo_fiscal_subdivisions USING gist (geom);

CREATE INDEX IF NOT EXISTS idx_geo_communes_department ON public.geo_communes(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_communes_commune ON public.geo_communes(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_sections_department ON public.geo_sections(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_sections_commune ON public.geo_sections(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_sections_section ON public.geo_sections(section_code);
CREATE INDEX IF NOT EXISTS idx_geo_parcels_department ON public.geo_parcels(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_parcels_commune ON public.geo_parcels(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_parcels_section ON public.geo_parcels(section_code);
CREATE INDEX IF NOT EXISTS idx_geo_parcels_number ON public.geo_parcels(parcel_number);
CREATE INDEX IF NOT EXISTS idx_geo_parcels_code ON public.geo_parcels(parcel_code);
CREATE INDEX IF NOT EXISTS idx_geo_buildings_department ON public.geo_buildings(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_buildings_commune ON public.geo_buildings(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_cadastral_sheets_department ON public.geo_cadastral_sheets(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_cadastral_sheets_commune ON public.geo_cadastral_sheets(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_cadastral_sheets_section ON public.geo_cadastral_sheets(section_code);
CREATE INDEX IF NOT EXISTS idx_geo_localities_department ON public.geo_localities(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_localities_commune ON public.geo_localities(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_section_prefixes_department ON public.geo_section_prefixes(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_section_prefixes_commune ON public.geo_section_prefixes(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_fiscal_subdivisions_department ON public.geo_fiscal_subdivisions(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_fiscal_subdivisions_commune ON public.geo_fiscal_subdivisions(commune_code);
CREATE INDEX IF NOT EXISTS idx_geo_fiscal_subdivisions_code ON public.geo_fiscal_subdivisions(parcel_code);
CREATE INDEX IF NOT EXISTS idx_geo_parcel_buildings_department ON public.geo_parcel_buildings(department_code);
CREATE INDEX IF NOT EXISTS idx_geo_parcel_buildings_code ON public.geo_parcel_buildings(parcel_code);

CREATE INDEX IF NOT EXISTS idx_geo_communes_active ON public.geo_communes(department_code, commune_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_geo_sections_active ON public.geo_sections(department_code, commune_code, section_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_geo_parcels_active ON public.geo_parcels(department_code, parcel_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_geo_buildings_active ON public.geo_buildings(department_code, commune_code) WHERE deleted_at IS NULL;

ALTER TABLE public.geo_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cadastral_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_section_prefixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_fiscal_subdivisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_parcel_buildings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.geo_communes TO authenticated;
GRANT SELECT ON public.geo_sections TO authenticated;
GRANT SELECT ON public.geo_parcels TO authenticated;
GRANT SELECT ON public.geo_buildings TO authenticated;
GRANT SELECT ON public.geo_cadastral_sheets TO authenticated;
GRANT SELECT ON public.geo_localities TO authenticated;
GRANT SELECT ON public.geo_section_prefixes TO authenticated;
GRANT SELECT ON public.geo_fiscal_subdivisions TO authenticated;
GRANT SELECT ON public.geo_parcel_buildings TO authenticated;

GRANT ALL ON public.geo_import_jobs TO service_role;
GRANT ALL ON public.geo_communes TO service_role;
GRANT ALL ON public.geo_sections TO service_role;
GRANT ALL ON public.geo_parcels TO service_role;
GRANT ALL ON public.geo_buildings TO service_role;
GRANT ALL ON public.geo_cadastral_sheets TO service_role;
GRANT ALL ON public.geo_localities TO service_role;
GRANT ALL ON public.geo_section_prefixes TO service_role;
GRANT ALL ON public.geo_fiscal_subdivisions TO service_role;
GRANT ALL ON public.geo_parcel_buildings TO service_role;

DROP POLICY IF EXISTS "geo_public_read_communes" ON public.geo_communes;
CREATE POLICY "geo_public_read_communes" ON public.geo_communes
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_sections" ON public.geo_sections;
CREATE POLICY "geo_public_read_sections" ON public.geo_sections
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_parcels" ON public.geo_parcels;
CREATE POLICY "geo_public_read_parcels" ON public.geo_parcels
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_buildings" ON public.geo_buildings;
CREATE POLICY "geo_public_read_buildings" ON public.geo_buildings
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_cadastral_sheets" ON public.geo_cadastral_sheets;
CREATE POLICY "geo_public_read_cadastral_sheets" ON public.geo_cadastral_sheets
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_localities" ON public.geo_localities;
CREATE POLICY "geo_public_read_localities" ON public.geo_localities
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_section_prefixes" ON public.geo_section_prefixes;
CREATE POLICY "geo_public_read_section_prefixes" ON public.geo_section_prefixes
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_fiscal_subdivisions" ON public.geo_fiscal_subdivisions;
CREATE POLICY "geo_public_read_fiscal_subdivisions" ON public.geo_fiscal_subdivisions
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "geo_public_read_parcel_buildings" ON public.geo_parcel_buildings;
CREATE POLICY "geo_public_read_parcel_buildings" ON public.geo_parcel_buildings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.geo_parcels p
      WHERE p.id = geo_parcel_buildings.parcel_id
        AND p.deleted_at IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.normalize_cadastre_parcel_code(
  commune_code text,
  prefix_code text,
  section_code text,
  parcel_number text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lpad(coalesce(commune_code, ''), 5, '0')
    || lpad(coalesce(prefix_code, ''), 3, '0')
    || lpad(coalesce(section_code, ''), 2, '0')
    || lpad(coalesce(parcel_number, ''), 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.geo_clean_multipolygon(geojson text)
RETURNS geometry(MultiPolygon, 4326)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ST_Multi(
    ST_CollectionExtract(
      ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geojson), 4326)),
      3
    )
  )::geometry(MultiPolygon, 4326);
$$;

CREATE OR REPLACE FUNCTION public.geo_job_start(
  p_department_code text,
  p_vintage_date date,
  p_layer_name text,
  p_source_dir text,
  p_source_file text,
  p_metadata jsonb DEFAULT '{}'
) RETURNS public.geo_import_jobs
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_job public.geo_import_jobs;
BEGIN
  INSERT INTO public.geo_import_jobs (
    department_code, vintage_date, layer_name, source_dir, source_file,
    status, started_at, error_message, metadata, updated_at
  )
  VALUES (
    p_department_code, p_vintage_date, p_layer_name, p_source_dir, p_source_file,
    'running', now(), NULL, coalesce(p_metadata, '{}'), now()
  )
  ON CONFLICT (department_code, vintage_date, layer_name)
  DO UPDATE SET
    source_dir = EXCLUDED.source_dir,
    source_file = EXCLUDED.source_file,
    status = 'running',
    started_at = coalesce(public.geo_import_jobs.started_at, now()),
    failed_at = NULL,
    error_message = NULL,
    metadata = public.geo_import_jobs.metadata || EXCLUDED.metadata,
    updated_at = now()
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.geo_job_fail(
  p_job_id uuid,
  p_error_message text,
  p_last_feature_index integer DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.geo_import_jobs
  SET status = 'failed',
      failed_at = now(),
      error_message = p_error_message,
      last_feature_index = coalesce(p_last_feature_index, last_feature_index),
      updated_at = now()
  WHERE id = p_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_geo_batch(
  p_job_id uuid,
  p_layer_name text,
  p_rows jsonb,
  p_last_feature_index integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_count integer := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  v_affected integer := 0;
BEGIN
  IF v_count = 0 THEN
    RETURN jsonb_build_object('processed', 0, 'affected', 0);
  END IF;

  IF p_layer_name = 'communes' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, name text,
        source_created_on date, source_updated_on date, vintage_date date,
        source_hash text, geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_communes (
        source_id, department_code, commune_code, name, source_created_on,
        source_updated_on, vintage_date, import_job_id, source_hash,
        last_seen_at, deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, name, source_created_on,
        source_updated_on, vintage_date, p_job_id, source_hash, now(), NULL,
        public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, commune_code)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        name = EXCLUDED.name,
        source_created_on = EXCLUDED.source_created_on,
        source_updated_on = EXCLUDED.source_updated_on,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        source_hash = EXCLUDED.source_hash,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSIF p_layer_name = 'sections' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, prefix_code text,
        section_code text, source_created_on date, source_updated_on date,
        vintage_date date, source_hash text, geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_sections (
        source_id, department_code, commune_code, prefix_code, section_code,
        source_created_on, source_updated_on, vintage_date, import_job_id,
        source_hash, last_seen_at, deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, prefix_code, section_code,
        source_created_on, source_updated_on, vintage_date, p_job_id,
        source_hash, now(), NULL, public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, commune_code, prefix_code, section_code)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        source_created_on = EXCLUDED.source_created_on,
        source_updated_on = EXCLUDED.source_updated_on,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        source_hash = EXCLUDED.source_hash,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSIF p_layer_name = 'parcels' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, prefix_code text,
        section_code text, parcel_number text, parcel_code text, area_cadastre integer,
        is_surveyed boolean, source_created_on date, source_updated_on date,
        vintage_date date, source_hash text, geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_parcels (
        source_id, department_code, commune_code, prefix_code, section_code,
        parcel_number, parcel_code, area_cadastre, is_surveyed,
        source_created_on, source_updated_on, vintage_date, import_job_id,
        source_hash, last_seen_at, deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, prefix_code, section_code,
        parcel_number, parcel_code, area_cadastre, is_surveyed,
        source_created_on, source_updated_on, vintage_date, p_job_id,
        source_hash, now(), NULL, public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, parcel_code)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        commune_code = EXCLUDED.commune_code,
        prefix_code = EXCLUDED.prefix_code,
        section_code = EXCLUDED.section_code,
        parcel_number = EXCLUDED.parcel_number,
        area_cadastre = EXCLUDED.area_cadastre,
        is_surveyed = EXCLUDED.is_surveyed,
        source_created_on = EXCLUDED.source_created_on,
        source_updated_on = EXCLUDED.source_updated_on,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        source_hash = EXCLUDED.source_hash,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSIF p_layer_name = 'buildings' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, building_type text,
        name text, source_created_on date, source_updated_on date,
        vintage_date date, source_hash text, geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_buildings (
        source_id, department_code, commune_code, building_type, name,
        source_created_on, source_updated_on, vintage_date, import_job_id,
        source_hash, last_seen_at, deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, building_type, name,
        source_created_on, source_updated_on, vintage_date, p_job_id,
        source_hash, now(), NULL, public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, commune_code, source_hash)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        building_type = EXCLUDED.building_type,
        name = EXCLUDED.name,
        source_created_on = EXCLUDED.source_created_on,
        source_updated_on = EXCLUDED.source_updated_on,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSIF p_layer_name = 'cadastral_sheets' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, prefix_code text,
        section_code text, sheet_number text, quality_code text, confection_mode text,
        scale integer, source_created_on date, source_updated_on date,
        vintage_date date, source_hash text, geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_cadastral_sheets (
        source_id, department_code, commune_code, prefix_code, section_code,
        sheet_number, quality_code, confection_mode, scale, source_created_on,
        source_updated_on, vintage_date, import_job_id, source_hash,
        last_seen_at, deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, prefix_code, section_code,
        sheet_number, quality_code, confection_mode, scale, source_created_on,
        source_updated_on, vintage_date, p_job_id, source_hash, now(), NULL,
        public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, source_id)
      DO UPDATE SET
        commune_code = EXCLUDED.commune_code,
        prefix_code = EXCLUDED.prefix_code,
        section_code = EXCLUDED.section_code,
        sheet_number = EXCLUDED.sheet_number,
        quality_code = EXCLUDED.quality_code,
        confection_mode = EXCLUDED.confection_mode,
        scale = EXCLUDED.scale,
        source_created_on = EXCLUDED.source_created_on,
        source_updated_on = EXCLUDED.source_updated_on,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        source_hash = EXCLUDED.source_hash,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSIF p_layer_name = 'localities' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, name text,
        source_created_on date, source_updated_on date, vintage_date date,
        source_hash text, geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_localities (
        source_id, department_code, commune_code, name, source_created_on,
        source_updated_on, vintage_date, import_job_id, source_hash,
        last_seen_at, deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, name, source_created_on,
        source_updated_on, vintage_date, p_job_id, source_hash, now(), NULL,
        public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, commune_code, source_hash)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        name = EXCLUDED.name,
        source_created_on = EXCLUDED.source_created_on,
        source_updated_on = EXCLUDED.source_updated_on,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSIF p_layer_name = 'section_prefixes' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, prefix_code text,
        old_commune_code text, name text, vintage_date date, source_hash text,
        geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_section_prefixes (
        source_id, department_code, commune_code, prefix_code, old_commune_code,
        name, vintage_date, import_job_id, source_hash, last_seen_at,
        deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, prefix_code, old_commune_code,
        name, vintage_date, p_job_id, source_hash, now(), NULL,
        public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, commune_code, prefix_code)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        old_commune_code = EXCLUDED.old_commune_code,
        name = EXCLUDED.name,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        source_hash = EXCLUDED.source_hash,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSIF p_layer_name = 'fiscal_subdivisions' THEN
    WITH src AS (
      SELECT * FROM jsonb_to_recordset(p_rows) AS x(
        source_id text, department_code text, commune_code text, parcel_code text,
        fiscal_letter text, source_created_on date, source_updated_on date,
        vintage_date date, source_hash text, geometry jsonb
      )
    ), upserted AS (
      INSERT INTO public.geo_fiscal_subdivisions (
        source_id, department_code, commune_code, parcel_code, fiscal_letter,
        source_created_on, source_updated_on, vintage_date, import_job_id,
        source_hash, last_seen_at, deleted_at, geom
      )
      SELECT source_id, department_code, commune_code, parcel_code, fiscal_letter,
        source_created_on, source_updated_on, vintage_date, p_job_id,
        source_hash, now(), NULL, public.geo_clean_multipolygon(geometry::text)
      FROM src
      ON CONFLICT (department_code, parcel_code, fiscal_letter, source_hash)
      DO UPDATE SET
        source_id = EXCLUDED.source_id,
        commune_code = EXCLUDED.commune_code,
        source_created_on = EXCLUDED.source_created_on,
        source_updated_on = EXCLUDED.source_updated_on,
        vintage_date = EXCLUDED.vintage_date,
        import_job_id = EXCLUDED.import_job_id,
        last_seen_at = now(),
        deleted_at = NULL,
        geom = EXCLUDED.geom
      RETURNING 1
    )
    SELECT count(*) INTO v_affected FROM upserted;
  ELSE
    RAISE EXCEPTION 'Unsupported cadastre layer: %', p_layer_name;
  END IF;

  UPDATE public.geo_import_jobs
  SET processed_count = processed_count + v_count,
      updated_count = updated_count + v_affected,
      last_feature_index = greatest(last_feature_index, p_last_feature_index),
      last_batch_at = now(),
      updated_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('processed', v_count, 'affected', v_affected);
END;
$$;

CREATE OR REPLACE FUNCTION public.geo_job_complete(p_job_id uuid)
RETURNS public.geo_import_jobs
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_job public.geo_import_jobs;
  v_deleted integer := 0;
BEGIN
  SELECT * INTO v_job FROM public.geo_import_jobs WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown geo import job: %', p_job_id;
  END IF;

  IF v_job.layer_name = 'communes' THEN
    UPDATE public.geo_communes SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  ELSIF v_job.layer_name = 'sections' THEN
    UPDATE public.geo_sections SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  ELSIF v_job.layer_name = 'parcels' THEN
    UPDATE public.geo_parcels SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  ELSIF v_job.layer_name = 'buildings' THEN
    UPDATE public.geo_buildings SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  ELSIF v_job.layer_name = 'cadastral_sheets' THEN
    UPDATE public.geo_cadastral_sheets SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  ELSIF v_job.layer_name = 'localities' THEN
    UPDATE public.geo_localities SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  ELSIF v_job.layer_name = 'section_prefixes' THEN
    UPDATE public.geo_section_prefixes SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  ELSIF v_job.layer_name = 'fiscal_subdivisions' THEN
    UPDATE public.geo_fiscal_subdivisions SET deleted_at = now()
    WHERE department_code = v_job.department_code AND import_job_id IS DISTINCT FROM p_job_id AND deleted_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.geo_import_jobs
  SET status = 'completed',
      completed_at = now(),
      deleted_count = v_deleted,
      updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_geo_parcel_buildings(
  p_department_code text,
  p_vintage_date date,
  p_import_job_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.geo_parcel_buildings (
    department_code, parcel_id, building_id, parcel_code,
    intersection_area_m2, overlap_ratio, vintage_date, import_job_id, updated_at
  )
  SELECT
    p.department_code,
    p.id,
    b.id,
    p.parcel_code,
    ST_Area(ST_Intersection(p.geom, b.geom)::geography)::double precision,
    CASE
      WHEN ST_Area(b.geom::geography) = 0 THEN NULL
      ELSE (
        ST_Area(ST_Intersection(p.geom, b.geom)::geography)
        / ST_Area(b.geom::geography)
      )::double precision
    END,
    p_vintage_date,
    p_import_job_id,
    now()
  FROM public.geo_parcels p
  JOIN public.geo_buildings b
    ON b.department_code = p.department_code
   AND b.deleted_at IS NULL
   AND p.geom && b.geom
   AND ST_Intersects(p.geom, b.geom)
  WHERE p.department_code = p_department_code
    AND p.deleted_at IS NULL
    AND ST_Area(ST_Intersection(p.geom, b.geom)::geography) > 1
  ON CONFLICT (parcel_id, building_id)
  DO UPDATE SET
    intersection_area_m2 = EXCLUDED.intersection_area_m2,
    overlap_ratio = EXCLUDED.overlap_ratio,
    vintage_date = EXCLUDED.vintage_date,
    import_job_id = EXCLUDED.import_job_id,
    updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.geo_feature_json(
  p_geom geometry,
  p_zoom_level integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT ST_AsGeoJSON(
    CASE
      WHEN p_zoom_level IS NULL THEN p_geom
      WHEN p_zoom_level < 12 THEN ST_SimplifyPreserveTopology(p_geom, 0.00015)
      WHEN p_zoom_level < 15 THEN ST_SimplifyPreserveTopology(p_geom, 0.00005)
      ELSE p_geom
    END,
    6
  )::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.get_geo_communes_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  limit_count integer DEFAULT 1000
) RETURNS TABLE (
  commune_code text,
  name text,
  bbox jsonb,
  geometry jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH envelope AS (
    SELECT ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326) AS geom
  )
  SELECT c.commune_code, c.name, ST_AsGeoJSON(ST_Envelope(c.geom), 6)::jsonb, public.geo_feature_json(c.geom)
  FROM public.geo_communes c, envelope e
  WHERE c.deleted_at IS NULL AND c.geom && e.geom AND ST_Intersects(c.geom, e.geom)
  ORDER BY c.commune_code
  LIMIT least(greatest(limit_count, 1), 1000);
$$;

CREATE OR REPLACE FUNCTION public.get_geo_sections_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  limit_count integer DEFAULT 1000
) RETURNS TABLE (
  commune_code text,
  prefix_code text,
  section_code text,
  bbox jsonb,
  geometry jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH envelope AS (
    SELECT ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326) AS geom
  )
  SELECT s.commune_code, s.prefix_code, s.section_code,
    ST_AsGeoJSON(ST_Envelope(s.geom), 6)::jsonb,
    public.geo_feature_json(s.geom)
  FROM public.geo_sections s, envelope e
  WHERE s.deleted_at IS NULL AND s.geom && e.geom AND ST_Intersects(s.geom, e.geom)
  ORDER BY s.commune_code, s.prefix_code, s.section_code
  LIMIT least(greatest(limit_count, 1), 1000);
$$;

CREATE OR REPLACE FUNCTION public.get_geo_parcels_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  zoom_level integer DEFAULT NULL,
  limit_count integer DEFAULT 1000
) RETURNS TABLE (
  parcel_code text,
  commune_code text,
  prefix_code text,
  section_code text,
  parcel_number text,
  area_cadastre integer,
  bbox jsonb,
  geometry jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH envelope AS (
    SELECT ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326) AS geom
  )
  SELECT p.parcel_code, p.commune_code, p.prefix_code, p.section_code,
    p.parcel_number, p.area_cadastre, ST_AsGeoJSON(ST_Envelope(p.geom), 6)::jsonb,
    public.geo_feature_json(p.geom, zoom_level)
  FROM public.geo_parcels p, envelope e
  WHERE p.deleted_at IS NULL AND p.geom && e.geom AND ST_Intersects(p.geom, e.geom)
  ORDER BY p.parcel_code
  LIMIT least(greatest(limit_count, 1), 1000);
$$;

CREATE OR REPLACE FUNCTION public.get_geo_buildings_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  limit_count integer DEFAULT 1000
) RETURNS TABLE (
  id uuid,
  commune_code text,
  building_type text,
  name text,
  bbox jsonb,
  geometry jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH envelope AS (
    SELECT ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326) AS geom
  )
  SELECT b.id, b.commune_code, b.building_type, b.name,
    ST_AsGeoJSON(ST_Envelope(b.geom), 6)::jsonb,
    public.geo_feature_json(b.geom)
  FROM public.geo_buildings b, envelope e
  WHERE b.deleted_at IS NULL AND b.geom && e.geom AND ST_Intersects(b.geom, e.geom)
  ORDER BY b.commune_code, b.id
  LIMIT least(greatest(limit_count, 1), 1000);
$$;

CREATE OR REPLACE FUNCTION public.search_geo_parcel(reference text)
RETURNS TABLE (
  parcel_code text,
  commune_code text,
  prefix_code text,
  section_code text,
  parcel_number text,
  area_cadastre integer,
  bbox jsonb,
  geometry jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT p.parcel_code, p.commune_code, p.prefix_code, p.section_code,
    p.parcel_number, p.area_cadastre, ST_AsGeoJSON(ST_Envelope(p.geom), 6)::jsonb,
    public.geo_feature_json(p.geom)
  FROM public.geo_parcels p
  WHERE p.deleted_at IS NULL
    AND (
      p.parcel_code = upper(regexp_replace(reference, '[^0-9A-Za-z]', '', 'g'))
      OR p.parcel_code ILIKE upper(regexp_replace(reference, '[^0-9A-Za-z]', '', 'g')) || '%'
    )
  ORDER BY p.parcel_code
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.get_geo_parcel_details(p_parcel_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT jsonb_build_object(
    'parcel', jsonb_build_object(
      'parcel_code', p.parcel_code,
      'commune_code', p.commune_code,
      'prefix_code', p.prefix_code,
      'section_code', p.section_code,
      'parcel_number', p.parcel_number,
      'area_cadastre', p.area_cadastre,
      'is_surveyed', p.is_surveyed,
      'source_updated_on', p.source_updated_on,
      'bbox', ST_AsGeoJSON(ST_Envelope(p.geom), 6)::jsonb,
      'geometry', public.geo_feature_json(p.geom)
    ),
    'commune', (
      SELECT jsonb_build_object('commune_code', c.commune_code, 'name', c.name)
      FROM public.geo_communes c
      WHERE c.commune_code = p.commune_code AND c.deleted_at IS NULL
      LIMIT 1
    ),
    'buildings', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'type', b.building_type,
        'name', b.name,
        'intersection_area_m2', pb.intersection_area_m2,
        'overlap_ratio', pb.overlap_ratio,
        'geometry', public.geo_feature_json(b.geom)
      ))
      FROM public.geo_parcel_buildings pb
      JOIN public.geo_buildings b ON b.id = pb.building_id
      WHERE pb.parcel_id = p.id AND b.deleted_at IS NULL
    ), '[]'::jsonb),
    'fiscal_subdivisions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'letter', fs.fiscal_letter,
        'geometry', public.geo_feature_json(fs.geom)
      ))
      FROM public.geo_fiscal_subdivisions fs
      WHERE fs.parcel_code = p.parcel_code AND fs.deleted_at IS NULL
    ), '[]'::jsonb)
  )
  FROM public.geo_parcels p
  WHERE p.parcel_code = upper(regexp_replace(p_parcel_code, '[^0-9A-Za-z]', '', 'g'))
    AND p.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.geo_job_start(text, date, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.geo_job_fail(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.import_geo_batch(uuid, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.geo_job_complete(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_geo_parcel_buildings(text, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.geo_job_start(text, date, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.geo_job_fail(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.import_geo_batch(uuid, text, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.geo_job_complete(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_geo_parcel_buildings(text, date, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_geo_communes_in_bbox(double precision, double precision, double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_geo_sections_in_bbox(double precision, double precision, double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_geo_parcels_in_bbox(double precision, double precision, double precision, double precision, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_geo_buildings_in_bbox(double precision, double precision, double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_geo_parcel(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_geo_parcel_details(text) TO authenticated;
