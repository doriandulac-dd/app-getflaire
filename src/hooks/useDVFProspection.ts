import { useCallback, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeDepartmentCodes } from '../utils/pigeScope';

export type DVFBbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type DVFMutation = {
  mutation_key: string;
  id_mutation: string | null;
  date_mutation: string | null;
  nature_mutation: string | null;
  valeur_fonciere: number | null;
  adresse: string | null;
  code_postal: string | null;
  code_commune: string | null;
  nom_commune: string | null;
  code_departement: string | null;
  id_parcelle: string | null;
  type_local: string | null;
  surface_reelle_bati: number | null;
  surface_terrain: number | null;
  nombre_pieces_principales: number | null;
  longitude: number;
  latitude: number;
};

type UseDVFProspectionOptions = {
  authorizedDepartments?: string[];
};

export const useDVFProspection = ({ authorizedDepartments = [] }: UseDVFProspectionOptions = {}) => {
  const [mutations, setMutations] = useState<DVFMutation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBbox, setLastBbox] = useState<DVFBbox | null>(null);

  const scopedDepartments = useMemo(
    () => normalizeDepartmentCodes(authorizedDepartments),
    [authorizedDepartments]
  );

  const loadDVF = useCallback(
    async (bbox: DVFBbox) => {
      if (scopedDepartments.length === 0) {
        setMutations([]);
        setLastBbox(bbox);
        return;
      }

      setLoading(true);
      setError(null);
      setLastBbox(bbox);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_dvf_mutations_in_bbox', {
          min_lng: bbox.minLng,
          min_lat: bbox.minLat,
          max_lng: bbox.maxLng,
          max_lat: bbox.maxLat,
          department_codes: scopedDepartments,
          limit_count: 500,
        });

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        setMutations((data || []) as DVFMutation[]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Impossible de charger les mutations DVF';
        setError(message);
        setMutations([]);
      } finally {
        setLoading(false);
      }
    },
    [scopedDepartments]
  );

  return {
    mutations,
    loading,
    error,
    lastBbox,
    loadDVF,
  };
};
