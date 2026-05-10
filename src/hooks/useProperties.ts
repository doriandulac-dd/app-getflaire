import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Annonce, PropertyFilters, SortOption } from '../types';
import { useAuth } from './useAuth';
import { useActivityScope } from './useActivityScope';

const PROPERTY_TYPE_ALIASES: Record<string, string[]> = {
  Appartement: ['appartement', 'studio', 't1', 't2', 't3', 't4', 't5'],
  Maison: ['maison', 'villa', 'pavillon'],
  Terrain: ['terrain'],
  Commercial: ['commercial', 'commerce', 'local', 'bureau', 'bureaux'],
};

const normalizePropertyType = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const getPropertyTypeAliases = (type: string) => {
  const aliases = PROPERTY_TYPE_ALIASES[type] || [type];
  return aliases.map(normalizePropertyType);
};

const matchesPropertyTypeFilter = (annonce: Annonce, selectedTypes?: string[]) => {
  if (!selectedTypes?.length) return true;

  const haystack = normalizePropertyType(`${annonce.type_de_bien || ''} ${annonce.title || ''}`);
  const knownAliases = Object.keys(PROPERTY_TYPE_ALIASES).flatMap(getPropertyTypeAliases);

  return selectedTypes.some((type) => {
    if (type === 'Autre') {
      return !knownAliases.some((alias) => haystack.includes(alias));
    }

    return getPropertyTypeAliases(type).some((alias) => haystack.includes(alias));
  });
};

export const useAnnonces = (
  filters: PropertyFilters = {},
  sort: SortOption = { field: 'publication_date', direction: 'desc' },
  limit: number = 20,
  options: { ownerType?: string } = {}
) => {
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const requestIdRef = useRef(0);

  const fetchAnnonces = async (reset: boolean = false) => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);
      if (reset) {
        setPage(1);
        setHasMore(true);
      }

      let query = supabase
        .from('annonces_with_relative_date')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
      }

      if (filters.property_types?.length && !filters.property_types.includes('Autre')) {
        const typeTerms = filters.property_types.flatMap(getPropertyTypeAliases);
        query = query.or(typeTerms.map(term => `type_de_bien.ilike.%${term}%`).join(','));
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

      if (options.ownerType) {
        query = query.eq('owner_type', options.ownerType);
      } else if (filters.owner_type) {
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

      if (appUser && activityScope.userIds.length > 0 && !filters.include_all_statuses && (filters.status?.length || filters.non_processed)) {
        const [allFavoritesResult, allSuiviResult] = await Promise.all([
          supabase
            .from('favoris')
            .select('annonce_id')
            .in('user_id', activityScope.userIds),
          supabase
            .from('suivi_annonce')
            .select('annonce_id, statut')
            .in('user_id', activityScope.userIds),
        ]);

        if (allFavoritesResult.error) throw allFavoritesResult.error;
        if (allSuiviResult.error) throw allSuiviResult.error;
        if (requestId !== requestIdRef.current) return;

        const favoriteIds = new Set(allFavoritesResult.data?.map(item => item.annonce_id) || []);
        const suiviRows = allSuiviResult.data || [];
        const suiviIds = new Set(suiviRows.map(item => item.annonce_id));

        if (filters.status?.length) {
          const matchingIds = new Set<string>();
          filters.status.forEach(status => {
            if (status === 'favorite') {
              favoriteIds.forEach(id => matchingIds.add(id));
            } else {
              suiviRows
                .filter(row => row.statut === status)
                .forEach(row => matchingIds.add(row.annonce_id));
            }
          });

          const ids = Array.from(matchingIds);
          query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
        }

        if (filters.non_processed) {
          const processedIds = Array.from(new Set([...favoriteIds, ...suiviIds]));
          if (processedIds.length) {
            query = query.not('id', 'in', `(${processedIds.join(',')})`);
          }
        }
      }
      
      // Apply sorting
      query = query.order(sort.field, { ascending: sort.direction === 'asc' });

      // Apply pagination
      const from = reset ? 0 : (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;
      if (requestId !== requestIdRef.current) return;

      let newAnnonces = data || [];

      if (filters.property_types?.length) {
        newAnnonces = newAnnonces.filter(annonce =>
          matchesPropertyTypeFilter(annonce, filters.property_types)
        );
      }

      // Fetch user statuses for all annonces (for filtering)
      let userFavoritedIds: Set<string> = new Set();
      let userSuiviStatusMap: Map<string, string> = new Map();
      let userSuiviMetaMap: Map<string, { user_id: string; note?: string; date_suivi?: string }> = new Map();
      let favoriteUserIdsMap: Map<string, string[]> = new Map();
      let favoriteActorsMap: Map<string, string[]> = new Map();
      
      if (appUser && activityScope.userIds.length > 0 && newAnnonces.length > 0) {
        const annonceIds = newAnnonces.map(a => a.id);
        
        // Fetch all user favorites and statuses
        const [favoritesResult, suiviResult] = await Promise.all([
          supabase
            .from('favoris')
            .select('annonce_id, user_id')
            .in('user_id', activityScope.userIds)
            .in('annonce_id', annonceIds),
          supabase
            .from('suivi_annonce')
            .select('annonce_id, statut, user_id, note, date_suivi')
            .in('user_id', activityScope.userIds)
            .in('annonce_id', annonceIds)
            .order('date_suivi', { ascending: false })
        ]);
        if (requestId !== requestIdRef.current) return;

        // Build data structures for quick lookup
        userFavoritedIds = new Set(favoritesResult.data?.map(f => f.annonce_id) || []);
        favoriteUserIdsMap = (favoritesResult.data || []).reduce((map, favorite) => {
          const ids = map.get(favorite.annonce_id) || [];
          ids.push(favorite.user_id);
          map.set(favorite.annonce_id, ids);
          return map;
        }, new Map<string, string[]>());
        favoriteActorsMap = (favoritesResult.data || []).reduce((map, favorite) => {
          const actors = map.get(favorite.annonce_id) || [];
          actors.push(activityScope.formatActor(favorite.user_id));
          map.set(favorite.annonce_id, actors);
          return map;
        }, new Map<string, string[]>());

        (suiviResult.data || []).forEach(suivi => {
          if (userSuiviStatusMap.has(suivi.annonce_id)) return;
          userSuiviStatusMap.set(suivi.annonce_id, suivi.statut);
          userSuiviMetaMap.set(suivi.annonce_id, {
            user_id: suivi.user_id,
            note: suivi.note,
            date_suivi: suivi.date_suivi,
          });
        });
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
      newAnnonces = newAnnonces.map(annonce => {
        const suiviMeta = userSuiviMetaMap.get(annonce.id);
        const favoriteUserIds = favoriteUserIdsMap.get(annonce.id) || [];
        const favoriteActors = favoriteActorsMap.get(annonce.id) || [];
        return {
          ...annonce,
          activity_status: userSuiviStatusMap.get(annonce.id),
          activity_user_id: suiviMeta?.user_id,
          activity_actor: suiviMeta ? activityScope.formatActor(suiviMeta.user_id) : undefined,
          activity_note: suiviMeta?.note,
          activity_date: suiviMeta?.date_suivi,
          favorite_user_ids: favoriteUserIds.length ? favoriteUserIds : undefined,
          favorite_actors: favoriteActors.length ? favoriteActors : undefined,
        };
      });

      if (requestId !== requestIdRef.current) return;

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
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
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
    if (activityScope.loading) return;
    refresh();
  }, [filters, sort, limit, options.ownerType, activityScope.loading, activityScope.userIds.join('|')]);

  return {
    annonces,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
};
