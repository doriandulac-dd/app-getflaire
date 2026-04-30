import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Annonce, PropertyFilters, SortOption } from '../types';
import { useAuth } from './useAuth';

export const useAnnonces = (
  filters: PropertyFilters = {},
  sort: SortOption = { field: 'publication_date', direction: 'desc' },
  limit: number = 20
) => {
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const { appUser } = useAuth();

  const fetchAnnonces = async (reset: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('annonces_with_relative_date')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
      }

      if (filters.property_types?.length) {
        query = query.or(filters.property_types.map(type => `type_de_bien.eq.${type}`).join(','));
      }

      if (filters.cities?.length) {
        query = query.or(filters.cities.map(city => `city.ilike.%${city}%`).join(','));
      }


      if (filters.price_min !== undefined) {
        query = query.gte('price', filters.price_min);
      }

      if (filters.price_max !== undefined) {
        query = query.lte('price', filters.price_max);
      }

      if (filters.surface_min !== undefined) {
        query = query.gte('size', filters.surface_min);
      }

      if (filters.surface_max !== undefined) {
        query = query.lte('size', filters.surface_max);
      }

      if (filters.rooms_min !== undefined) {
        query = query.gte('rooms', filters.rooms_min);
      }

      if (filters.urgent_only) {
        query = query.or('urgence.eq.true,urgence_detectee.eq.true');
      }

      if (filters.has_phone) {
        query = query.not('phone', 'is', null).neq('phone', '');
      }

      if (filters.online_status !== undefined) {
        query = query.eq('en_ligne', filters.online_status);
      }

      if (filters.owner_type) {
        query = query.eq('owner_type', filters.owner_type);
      }

      if (filters.url_search) {
        query = query.eq('url', filters.url_search);
      }

      // Filter only non-deleted and online listings (unless include_all_statuses is true)
      if (!filters.include_all_statuses) {
        query = query.eq('supprimee', false);
        query = query.neq('en_ligne', false);
      }
      
      // Apply sorting
      query = query.order(sort.field, { ascending: sort.direction === 'asc' });

      // Apply pagination
      const from = reset ? 0 : (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      let newAnnonces = data || [];

      // Fetch user statuses for all annonces (for filtering)
      let userFavoritedIds: Set<string> = new Set();
      let userSuiviStatusMap: Map<string, string> = new Map();
      
      if (appUser && newAnnonces.length > 0) {
        const annonceIds = newAnnonces.map(a => a.id);
        
        // Fetch all user favorites and statuses
        const [favoritesResult, suiviResult] = await Promise.all([
          supabase
            .from('favoris')
            .select('annonce_id')
            .eq('user_id', appUser.id)
            .in('annonce_id', annonceIds),
          supabase
            .from('suivi_annonce')
            .select('annonce_id, statut')
            .eq('user_id', appUser.id)
            .in('annonce_id', annonceIds)
        ]);

        // Build data structures for quick lookup
        userFavoritedIds = new Set(favoritesResult.data?.map(f => f.annonce_id) || []);
        userSuiviStatusMap = new Map(
          suiviResult.data?.map(s => [s.annonce_id, s.statut]) || []
        );
      }

      // Exclude hidden annonces by default (unless explicitly showing hidden or include_all_statuses is true)
      if (appUser && (!filters.status?.includes('hidden')) && !filters.include_all_statuses) {
        newAnnonces = newAnnonces.filter(annonce => {
          const status = userSuiviStatusMap.get(annonce.id);
          return status !== 'hidden';
        });
      }

      // Filter by status actions (client-side filtering)
      if (filters.status?.length && appUser && !filters.include_all_statuses) {
        // Filter annonces based on selected statuses
        newAnnonces = newAnnonces.filter(annonce => {
          return filters.status!.some(status => {
            if (status === 'favorite') {
              return userFavoritedIds.has(annonce.id);
            } else {
              return userSuiviStatusMap.get(annonce.id) === status;
            }
          });
        });
      }

      // Filter non-processed annonces (client-side filtering)
      if (filters.non_processed && appUser && !filters.include_all_statuses) {
        // Keep only annonces that are NOT in the processed list
        newAnnonces = newAnnonces.filter(annonce => {
          const isFavorited = userFavoritedIds.has(annonce.id);
          const hasStatus = userSuiviStatusMap.has(annonce.id);
          return !isFavorited && !hasStatus;
        });
      }
      
      // Deduplicate annonces based on ID
      const uniqueAnnoncesMap = new Map<string, Annonce>();
      newAnnonces.forEach(annonce => {
        // Use id_annnoce as primary deduplication key, fallback to internal id
        const dedupeKey = (annonce.id_annnoce && annonce.id_annnoce.trim()) ? annonce.id_annnoce : annonce.id;
        if (!uniqueAnnoncesMap.has(dedupeKey)) {
          uniqueAnnoncesMap.set(dedupeKey, annonce);
        }
      });
      newAnnonces = Array.from(uniqueAnnoncesMap.values());

      if (reset) {
        setAnnonces(newAnnonces);
        setPage(2);
      } else {
        // When adding more annonces, ensure no duplicates with existing ones
        setAnnonces(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newUniqueAnnonces = newAnnonces.filter(a => !existingIds.has(a.id));

          const finalAnnonces = [...prev, ...newUniqueAnnonces];
          
          // Update hasMore based on total unique annonces vs total count
          setHasMore(finalAnnonces.length < (count || 0));
          
          return finalAnnonces;
        });
        setPage(prev => prev + 1);
      }

      // For reset case, set hasMore based on current annonces vs total count
      if (reset) {
        setHasMore(newAnnonces.length < (count || 0));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchAnnonces(false);
    }
  };

  const refresh = () => {
    setPage(1);
    fetchAnnonces(true);
  };

  useEffect(() => {
    refresh();
  }, [filters, sort, limit]);

  return {
    annonces,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
};
