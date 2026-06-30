import { useCallback, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type CadastreBbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom?: number;
};

export type CadastreLayerKey = 'communes' | 'sections' | 'parcels' | 'buildings';

export type CadastreFeature = {
  id?: string;
  parcel_code?: string;
  commune_code?: string;
  prefix_code?: string;
  section_code?: string;
  parcel_number?: string;
  area_cadastre?: number | null;
  building_type?: string | null;
  name?: string | null;
  bbox?: Record<string, unknown>;
  geometry?: Record<string, unknown>;
};

export type CadastreParcelDetails = {
  parcel?: CadastreFeature;
  commune?: { commune_code?: string; name?: string | null };
  buildings?: Array<CadastreFeature & { intersection_area_m2?: number; overlap_ratio?: number }>;
  fiscal_subdivisions?: Array<{ letter?: string | null; geometry?: Record<string, unknown> }>;
};

type CadastreState = Record<CadastreLayerKey, CadastreFeature[]>;

const emptyState: CadastreState = {
  communes: [],
  sections: [],
  parcels: [],
  buildings: [],
};

const RPC_BY_LAYER: Record<CadastreLayerKey, string> = {
  communes: 'get_geo_communes_in_bbox',
  sections: 'get_geo_sections_in_bbox',
  parcels: 'get_geo_parcels_in_bbox',
  buildings: 'get_geo_buildings_in_bbox',
};

const DEFAULT_LIMIT_BY_LAYER: Record<CadastreLayerKey, number> = {
  communes: 1000,
  sections: 1000,
  parcels: 350,
  buildings: 500,
};

export const useCadastreProspection = () => {
  const [features, setFeatures] = useState<CadastreState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBbox, setLastBbox] = useState<CadastreBbox | null>(null);

  const hasAnyCadastreFeature = useMemo(
    () => Object.values(features).some((items) => items.length > 0),
    [features]
  );

  const loadCadastre = useCallback(
    async (bbox: CadastreBbox, layers: CadastreLayerKey[]) => {
      const activeLayers = Array.from(new Set(layers));

      if (activeLayers.length === 0) {
        setFeatures(emptyState);
        setLastBbox(bbox);
        return;
      }

      setLoading(true);
      setError(null);
      setLastBbox(bbox);

      try {
        const entries = await Promise.all(
          activeLayers.map(async (layer) => {
            const rpcName = RPC_BY_LAYER[layer];
            const args = {
              min_lng: bbox.minLng,
              min_lat: bbox.minLat,
              max_lng: bbox.maxLng,
              max_lat: bbox.maxLat,
              limit_count: DEFAULT_LIMIT_BY_LAYER[layer],
              ...(layer === 'parcels' ? { zoom_level: Math.round(bbox.zoom || 13) } : {}),
            };

            const { data, error: rpcError } = await supabase.rpc(rpcName, args);

            if (rpcError) {
              throw new Error(`${rpcName}: ${rpcError.message}`);
            }

            return [layer, (data || []) as CadastreFeature[]] as const;
          })
        );

        setFeatures((previous) => ({
          ...previous,
          ...Object.fromEntries(entries),
          ...Object.fromEntries(
            (Object.keys(RPC_BY_LAYER) as CadastreLayerKey[])
              .filter((layer) => !activeLayers.includes(layer))
              .map((layer) => [layer, []])
          ),
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Impossible de charger les couches cadastre';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const searchParcel = useCallback(async (reference: string) => {
    const normalized = reference.trim();
    if (!normalized) return [];

    const { data, error: rpcError } = await supabase.rpc('search_geo_parcel', {
      reference: normalized,
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    return (data || []) as CadastreFeature[];
  }, []);

  const getParcelDetails = useCallback(async (parcelCode: string) => {
    const { data, error: rpcError } = await supabase.rpc('get_geo_parcel_details', {
      p_parcel_code: parcelCode,
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    return data as CadastreParcelDetails | null;
  }, []);

  return {
    features,
    loading,
    error,
    lastBbox,
    hasAnyCadastreFeature,
    loadCadastre,
    searchParcel,
    getParcelDetails,
  };
};
