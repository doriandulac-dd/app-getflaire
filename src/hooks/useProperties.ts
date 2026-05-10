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

const DEPARTMENT_LABELS: Record<string, string[]> = {
  '01': ['Ain'],
  '02': ['Aisne'],
  '03': ['Allier'],
  '04': ['Alpes-de-Haute-Provence'],
  '05': ['Hautes-Alpes'],
  '06': ['Alpes-Maritimes'],
  '07': ['Ardeche', 'Ardèche'],
  '08': ['Ardennes'],
  '09': ['Ariege', 'Ariège'],
  '10': ['Aube'],
  '11': ['Aude'],
  '12': ['Aveyron'],
  '13': ['Bouches-du-Rhone', 'Bouches-du-Rhône'],
  '14': ['Calvados'],
  '15': ['Cantal'],
  '16': ['Charente'],
  '17': ['Charente-Maritime'],
  '18': ['Cher'],
  '19': ['Correze', 'Corrèze'],
  '21': ['Cote-d Or', "Cote-d'Or", "Côte-d'Or"],
  '22': ['Cotes-d Armor', "Cotes-d'Armor", "Côtes-d'Armor"],
  '23': ['Creuse'],
  '24': ['Dordogne'],
  '25': ['Doubs'],
  '26': ['Drome', 'Drôme'],
  '27': ['Eure'],
  '28': ['Eure-et-Loir'],
  '29': ['Finistere', 'Finistère'],
  '30': ['Gard'],
  '31': ['Haute-Garonne'],
  '32': ['Gers'],
  '33': ['Gironde'],
  '34': ['Herault', 'Hérault'],
  '35': ['Ille-et-Vilaine'],
  '36': ['Indre'],
  '37': ['Indre-et-Loire'],
  '38': ['Isere', 'Isère'],
  '39': ['Jura'],
  '40': ['Landes'],
  '41': ['Loir-et-Cher'],
  '42': ['Loire'],
  '43': ['Haute-Loire'],
  '44': ['Loire-Atlantique'],
  '45': ['Loiret'],
  '46': ['Lot'],
  '47': ['Lot-et-Garonne'],
  '48': ['Lozere', 'Lozère'],
  '49': ['Maine-et-Loire'],
  '50': ['Manche'],
  '51': ['Marne'],
  '52': ['Haute-Marne'],
  '53': ['Mayenne'],
  '54': ['Meurthe-et-Moselle'],
  '55': ['Meuse'],
  '56': ['Morbihan'],
  '57': ['Moselle'],
  '58': ['Nievre', 'Nièvre'],
  '59': ['Nord'],
  '60': ['Oise'],
  '61': ['Orne'],
  '62': ['Pas-de-Calais'],
  '63': ['Puy-de-Dome', 'Puy-de-Dôme'],
  '64': ['Pyrenees-Atlantiques', 'Pyrénées-Atlantiques'],
  '65': ['Hautes-Pyrenees', 'Hautes-Pyrénées'],
  '66': ['Pyrenees-Orientales', 'Pyrénées-Orientales'],
  '67': ['Bas-Rhin'],
  '68': ['Haut-Rhin'],
  '69': ['Rhone', 'Rhône'],
  '70': ['Haute-Saone', 'Haute-Saône'],
  '71': ['Saone-et-Loire', 'Saône-et-Loire'],
  '72': ['Sarthe'],
  '73': ['Savoie'],
  '74': ['Haute-Savoie'],
  '75': ['Paris'],
  '76': ['Seine-Maritime'],
  '77': ['Seine-et-Marne'],
  '78': ['Yvelines'],
  '79': ['Deux-Sevres', 'Deux-Sèvres'],
  '80': ['Somme'],
  '81': ['Tarn'],
  '82': ['Tarn-et-Garonne'],
  '83': ['Var'],
  '84': ['Vaucluse'],
  '85': ['Vendee', 'Vendée'],
  '86': ['Vienne'],
  '87': ['Haute-Vienne'],
  '88': ['Vosges'],
  '89': ['Yonne'],
  '90': ['Territoire de Belfort'],
  '91': ['Essonne'],
  '92': ['Hauts-de-Seine'],
  '93': ['Seine-Saint-Denis'],
  '94': ['Val-de-Marne'],
  '95': ["Val-d Oise", "Val-d'Oise"],
  '971': ['Guadeloupe'],
  '972': ['Martinique'],
  '973': ['Guyane'],
  '974': ['La Reunion', 'La Réunion'],
  '976': ['Mayotte'],
  '2A': ['Corse-du-Sud'],
  '2B': ['Haute-Corse'],
};

const normalizePropertyType = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

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

type UseAnnoncesOptions = {
  ownerType?: string;
  departments?: string[];
  requireDepartments?: boolean;
};

const QUERY_TIMEOUT_MS = 12000;

const normalizeDepartment = (value?: string | null) => {
  const raw = (value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === '2A' || raw === '2B') return raw;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(2, '0').slice(0, 3);
};

const DEPARTMENT_NAME_TO_CODE = Object.entries(DEPARTMENT_LABELS).reduce((map, [code, labels]) => {
  labels.forEach(label => map.set(normalizeText(label), code));
  return map;
}, new Map<string, string>());

const normalizeDepartments = (departments?: string[]) =>
  Array.from(new Set((departments || []).map(department => {
    const code = normalizeDepartment(department);
    if (code) return code;
    return DEPARTMENT_NAME_TO_CODE.get(normalizeText(department)) || '';
  }).filter(Boolean)));

const getDepartmentLabels = (department: string) => DEPARTMENT_LABELS[department] || [];

const getDepartmentFromPostalCode = (postalCode?: string | null) => {
  const normalized = (postalCode || '').trim();
  if (normalized.startsWith('20')) return '2A';
  return normalizeDepartment(normalized.slice(0, 2));
};

const matchesDepartmentScope = (annonce: Annonce, departments?: string[]) => {
  const allowedDepartments = normalizeDepartments(departments);
  if (!allowedDepartments.length) return true;

  const annonceDepartment = normalizeDepartment(annonce.departement)
    || DEPARTMENT_NAME_TO_CODE.get(normalizeText(annonce.departement))
    || '';
  const postalDepartment = getDepartmentFromPostalCode(annonce.postal_code);

  return allowedDepartments.some(department =>
    department === annonceDepartment || department === postalDepartment
  );
};

const withTimeout = async <T>(promise: PromiseLike<T>, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} a pris trop de temps`)), QUERY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const useAnnonces = (
  filters: PropertyFilters = {},
  sort: SortOption = { field: 'publication_date', direction: 'desc' },
  limit: number = 20,
  options: UseAnnoncesOptions = {}
) => {
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
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
        setAnnonces([]);
        setTotalCount(0);
        setHasMore(false);
      }

      const scopedDepartments = normalizeDepartments(options.departments);
      if (options.requireDepartments && scopedDepartments.length === 0) {
        setAnnonces([]);
        setTotalCount(0);
        setHasMore(false);
        setPage(1);
        return;
      }

      let matchingStatusIds: string[] | null = null;
      let excludedProcessedIds: string[] = [];
      if (appUser && activityScope.userIds.length > 0 && !filters.include_all_statuses && (filters.status?.length || filters.non_processed)) {
        const [allFavoritesResult, allSuiviResult] = await Promise.all([
          withTimeout(
            supabase
              .from('favoris')
              .select('annonce_id')
              .in('user_id', activityScope.userIds),
            'favoris'
          ),
          withTimeout(
            supabase
              .from('suivi_annonce')
              .select('annonce_id, statut')
              .in('user_id', activityScope.userIds),
            'suivi'
          ),
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

          matchingStatusIds = Array.from(matchingIds);
        }

        if (filters.non_processed) {
          excludedProcessedIds = Array.from(new Set([...favoriteIds, ...suiviIds]));
        }
      }

      const applyQueryFilters = <T,>(baseQuery: T): T => {
        let scopedQuery: any = baseQuery;

        if (filters.search) {
          scopedQuery = scopedQuery.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
        }

        if (filters.property_types?.length && !filters.property_types.includes('Autre')) {
          const typeTerms = filters.property_types.flatMap(getPropertyTypeAliases);
          const typeFilters = typeTerms.flatMap(term => [
            `type_de_bien.ilike.%${term}%`,
            `title.ilike.%${term}%`,
          ]);
          scopedQuery = scopedQuery.or(typeFilters.join(','));
        }

        if (filters.cities?.length) {
          scopedQuery = scopedQuery.or(filters.cities.map(city => `city.ilike.%${city}%`).join(','));
        }

        if (filters.price_min !== undefined) {
          scopedQuery = scopedQuery.gte('price', filters.price_min);
        }

        if (filters.price_max !== undefined) {
          scopedQuery = scopedQuery.lte('price', filters.price_max);
        }

        if (filters.surface_min !== undefined) {
          scopedQuery = scopedQuery.gte('size', filters.surface_min);
        }

        if (filters.surface_max !== undefined) {
          scopedQuery = scopedQuery.lte('size', filters.surface_max);
        }

        if (filters.rooms_min !== undefined) {
          scopedQuery = scopedQuery.gte('rooms', filters.rooms_min);
        }

        if (filters.urgent_only) {
          scopedQuery = scopedQuery.or('urgence.eq.true,urgence_detectee.eq.true');
        }

        if (filters.has_phone) {
          scopedQuery = scopedQuery.not('phone', 'is', null).neq('phone', '');
        }

        if (filters.online_status !== undefined) {
          scopedQuery = scopedQuery.eq('en_ligne', filters.online_status);
        }

        if (options.ownerType) {
          scopedQuery = scopedQuery.eq('owner_type', options.ownerType);
        } else if (filters.owner_type) {
          scopedQuery = scopedQuery.eq('owner_type', filters.owner_type);
        }

        if (scopedDepartments.length > 0) {
          const departmentFilters = scopedDepartments.flatMap(department => {
            const postalPrefix = department === '2A' || department === '2B' ? '20' : department;
            return [
              `departement.eq.${department}`,
              `postal_code.like.${postalPrefix}%`,
              ...getDepartmentLabels(department).map(label => `departement.ilike.%${label}%`),
            ];
          });
          scopedQuery = scopedQuery.or(departmentFilters.join(','));
        }

        if (filters.url_search) {
          scopedQuery = scopedQuery.eq('url', filters.url_search);
        }

        // Filter only non-deleted and online listings (unless include_all_statuses is true)
        if (!filters.include_all_statuses) {
          scopedQuery = scopedQuery.eq('supprimee', false);
          scopedQuery = scopedQuery.neq('en_ligne', false);
        }

        if (matchingStatusIds) {
          scopedQuery = scopedQuery.in(
            'id',
            matchingStatusIds.length ? matchingStatusIds : ['00000000-0000-0000-0000-000000000000']
          );
        }

        if (excludedProcessedIds.length) {
          scopedQuery = scopedQuery.not('id', 'in', `(${excludedProcessedIds.join(',')})`);
        }

        return scopedQuery as T;
      };
      
      let dataQuery = applyQueryFilters(
        supabase
          .from('annonces_with_relative_date')
          .select('*')
      );
      const countQuery = applyQueryFilters(
        supabase
          .from('annonces_with_relative_date')
          .select('id', { count: 'exact', head: true })
      );

      // Apply sorting
      dataQuery = dataQuery.order(sort.field, { ascending: sort.direction === 'asc' });

      // Apply pagination
      const from = reset ? 0 : (page - 1) * limit;
      const to = from + limit - 1;
      dataQuery = dataQuery.range(from, to);

      const [dataResult, countResult] = await Promise.all([
        withTimeout(dataQuery, 'chargement des annonces'),
        withTimeout(countQuery, 'comptage des annonces'),
      ]);

      if (dataResult.error) throw dataResult.error;
      if (countResult.error) throw countResult.error;
      if (requestId !== requestIdRef.current) return;

      const nextTotalCount = countResult.count ?? 0;
      let newAnnonces = dataResult.data || [];

      if (filters.property_types?.length) {
        newAnnonces = newAnnonces.filter(annonce =>
          matchesPropertyTypeFilter(annonce, filters.property_types)
        );
      }

      newAnnonces = newAnnonces.filter(annonce =>
        matchesDepartmentScope(annonce, scopedDepartments)
      );

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
          withTimeout(
            supabase
              .from('favoris')
              .select('annonce_id, user_id')
              .in('user_id', activityScope.userIds)
              .in('annonce_id', annonceIds),
            'favoris annonces'
          ),
          withTimeout(
            supabase
              .from('suivi_annonce')
              .select('annonce_id, statut, user_id, note, date_suivi')
              .in('user_id', activityScope.userIds)
              .in('annonce_id', annonceIds)
              .order('date_suivi', { ascending: false }),
            'suivi annonces'
          ),
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
        setTotalCount(nextTotalCount);
        setHasMore(newAnnonces.length < nextTotalCount);
        setPage(2);
      } else {
        // When adding more annonces, ensure no duplicates with existing ones
        setAnnonces(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newUniqueAnnonces = newAnnonces.filter(a => !existingIds.has(a.id));

          const finalAnnonces = [...prev, ...newUniqueAnnonces];

          setTotalCount(nextTotalCount);
          setHasMore(finalAnnonces.length < nextTotalCount);
          
          return finalAnnonces;
        });
        setPage(prev => prev + 1);
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
  }, [
    filters,
    sort,
    limit,
    options.ownerType,
    options.requireDepartments,
    normalizeDepartments(options.departments).join('|'),
    activityScope.loading,
    activityScope.userIds.join('|'),
  ]);

  return {
    annonces,
    loading,
    error,
    hasMore,
    totalCount,
    loadedCount: annonces.length,
    loadMore,
    refresh,
  };
};
