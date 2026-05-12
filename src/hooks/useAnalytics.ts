import { useEffect, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useActivityScope } from './useActivityScope';
import { ActivityItem, AnalyticsFilters, DonutData, EvolutionData, KPIData } from '../types/analytics';

const initialKpis: KPIData = {
  totalAnnonces: 0,
  totalAnnoncesVariation: 0,
  totalAnnoncesPro: 0,
  totalAnnoncesProVariation: 0,
  totalOnlineAnnonces: 0,
  totalOnlineAnnoncesVariation: 0,
  propertiesProcessed: 0,
  propertiesProcessedVariation: 0,
  appelsPasses: 0,
  appelsPassesVariation: 0,
  rappelsAFaire: 0,
  rappelsAFaireVariation: 0,
  toProcessReminders: 0,
  toProcessRemindersVariation: 0,
  surveillancesActives: 0,
  surveillancesActivesVariation: 0,
  newPropertiesParticulierToday: 0,
  newPropertiesParticulierTodayVariation: 0,
  newPropertiesProToday: 0,
  newPropertiesProTodayVariation: 0,
  conversionRate: 0,
  conversionRateVariation: 0,
};

type ErrorSection = 'kpis' | 'evolution' | 'propertyTypes' | 'statusDistribution' | 'recentActivity';
type ErrorBySection = Partial<Record<ErrorSection, string>>;
type CountStrategy = 'exact' | 'planned' | 'estimated';
type PigeActionType = 'to_call' | 'called' | 'reminder' | 'rdv' | 'hidden' | 'viewed';

const withTimeout = async <T,>(promise: PromiseLike<T>, label: string, timeoutMs = 6500): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} a pris trop de temps`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Erreur inconnue';

const isPerfDebugEnabled = () =>
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_DASHBOARD === 'true';

const measure = async <T,>(label: string, task: () => Promise<T>) => {
  const start = performance.now();
  try {
    return await task();
  } finally {
    if (isPerfDebugEnabled()) {
      console.info(`[dashboard] ${label}: ${Math.round(performance.now() - start)}ms`);
    }
  }
};

const safeCount = async (query: PromiseLike<{ count: number | null; error: unknown }>, label: string) => {
  const result = await withTimeout(query, label);
  if (result.error) throw result.error;
  return result.count || 0;
};

const safeCountOrDefault = async (
  query: PromiseLike<{ count: number | null; error: unknown }>,
  label: string,
  fallback = 0
) => {
  try {
    return await safeCount(query, label);
  } catch (error) {
    if (isPerfDebugEnabled()) {
      console.warn(`[dashboard] ${label}: ${getErrorMessage(error)}`);
    }
    return fallback;
  }
};

const isMissingActivityTableError = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || (error.message || '').includes('pige_actions');

export const useAnalytics = (filters: AnalyticsFilters) => {
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const [kpis, setKpis] = useState<KPIData>(initialKpis);
  const [evolution, setEvolution] = useState<EvolutionData[]>([]);
  const [propertyTypesPro, setPropertyTypesPro] = useState<DonutData[]>([]);
  const [propertyTypesParticulier, setPropertyTypesParticulier] = useState<DonutData[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<DonutData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [errorBySection, setErrorBySection] = useState<ErrorBySection>({});

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    const endDate: Date = now;

    if (filters.period === 'custom' && filters.startDate && filters.endDate) {
      startDate = parseISO(filters.startDate);
    } else {
      startDate = subDays(now, parseInt(filters.period) || 7);
    }

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      previousStartDate: format(subDays(startDate, parseInt(filters.period) || 7), 'yyyy-MM-dd'),
      previousEndDate: format(subDays(startDate, 1), 'yyyy-MM-dd'),
    };
  };

  const setSectionError = (section: ErrorSection, error: unknown) => {
    const message = getErrorMessage(error);
    setErrorBySection(prev => ({ ...prev, [section]: message }));
    if (isPerfDebugEnabled()) console.warn(`[dashboard] ${section}: ${message}`);
  };

  const clearSectionError = (section: ErrorSection) => {
    setErrorBySection(prev => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  };

  const applyCity = <T extends { ilike: (column: string, pattern: string) => T }>(query: T): T => {
    return filters.city ? query.ilike('city', `%${filters.city}%`) : query;
  };

  const applyActivityScope = <T extends { eq: (column: string, value: unknown) => T; in: (column: string, values: unknown[]) => T }>(query: T): T => {
    if (activityScope.isAgencyScope && activityScope.agencyId) {
      return query.eq('agency_id', activityScope.agencyId);
    }
    return query.in('user_id', activityScope.userIds);
  };

  const countPigeActions = async ({
    actionTypes,
    from,
    to,
  }: {
    actionTypes?: PigeActionType[];
    from?: string;
    to?: string;
  }) => {
    try {
      let query = applyActivityScope(
        supabase
          .from('pige_actions')
          .select('id', { count: 'exact', head: true })
          .eq('active', true)
      );

      if (actionTypes?.length) query = query.in('action_type', actionTypes);
      if (from) query = query.gte('updated_at', from);
      if (to) query = query.lte('updated_at', to);

      const result = await withTimeout(query, 'comptage actions pige');
      if (result.error) throw result.error;
      return result.count || 0;
    } catch (error: any) {
      if (!isMissingActivityTableError(error)) throw error;

      let legacyQuery = applyActivityScope(
        supabase
          .from('suivi_annonce')
          .select('id', { count: 'exact', head: true })
      );

      const legacyStatuses = (actionTypes || []).map((actionType) => {
        if (actionType === 'to_call') return 'to_process';
        if (actionType === 'reminder') return 'to_call';
        return actionType;
      });

      if (legacyStatuses.length) legacyQuery = legacyQuery.in('statut', legacyStatuses);
      if (from) legacyQuery = legacyQuery.gte('date_suivi', from);
      if (to) legacyQuery = legacyQuery.lte('date_suivi', to);

      const result = await withTimeout(legacyQuery, 'comptage suivi legacy');
      if (result.error) throw result.error;
      return result.count || 0;
    }
  };

  const fetchPigeActionRows = async ({
    actionTypes,
    limit,
    from,
    to,
  }: {
    actionTypes?: PigeActionType[];
    limit?: number;
    from?: string;
    to?: string;
  }) => {
    try {
      let query = applyActivityScope(
        supabase
          .from('pige_actions')
          .select('id, action_type, updated_at, scheduled_at, annonce_id, annonces(title)')
          .eq('active', true)
      )
        .order('updated_at', { ascending: false });

      if (actionTypes?.length) query = query.in('action_type', actionTypes);
      if (from) query = query.gte('updated_at', from);
      if (to) query = query.lte('updated_at', to);
      if (limit) query = query.limit(limit);

      const result = await withTimeout(query, 'lecture actions pige');
      if (result.error) throw result.error;
      return (result.data || []) as any[];
    } catch (error: any) {
      if (!isMissingActivityTableError(error)) throw error;

      let legacyQuery = applyActivityScope(
        supabase
          .from('suivi_annonce')
          .select('id, statut, date_suivi, annonce_id, annonces(title)')
      )
        .order('date_suivi', { ascending: false });

      const legacyStatuses = (actionTypes || []).map((actionType) => {
        if (actionType === 'to_call') return 'to_process';
        if (actionType === 'reminder') return 'to_call';
        return actionType;
      });

      if (legacyStatuses.length) legacyQuery = legacyQuery.in('statut', legacyStatuses);
      if (from) legacyQuery = legacyQuery.gte('date_suivi', from);
      if (to) legacyQuery = legacyQuery.lte('date_suivi', to);
      if (limit) legacyQuery = legacyQuery.limit(limit);

      const result = await withTimeout(legacyQuery, 'lecture suivi legacy');
      if (result.error) throw result.error;
      return (result.data || []).map((item: any) => ({
        ...item,
        action_type: item.statut === 'to_process' ? 'to_call' : item.statut === 'to_call' ? 'reminder' : item.statut,
        updated_at: item.date_suivi,
        scheduled_at: item.date_suivi,
      }));
    }
  };

  const countAnnonces = (
    ownerType?: string,
    from?: string,
    to?: string,
    count: CountStrategy = 'estimated'
  ) => {
    let query = supabase
      .from('annonces')
      .select('id', { count, head: true })
      .eq('en_ligne', true)
      .eq('supprimee', false);

    if (ownerType) query = query.eq('owner_type', ownerType);
    if (from) query = query.gte('publication_date', from);
    if (to) query = query.lte('publication_date', to);

    return applyCity(query);
  };

  const fetchKPIs = async () => {
    if (!appUser || activityScope.loading || activityScope.userIds.length === 0) return;

    setKpiLoading(true);
    clearSectionError('kpis');

    try {
      await measure('kpis', async () => {
        const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange();
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const [
          totalAnnonces,
          totalAnnoncesPro,
          totalOnlineAnnonces,
          totalOnlineAnnoncesPrevious,
          propertiesProcessed,
          propertiesProcessedPrevious,
          appelsPasses,
          appelsPassesPrevious,
          rappelsAFaire,
          rappelsAFairePrevious,
          toProcessReminders,
          toProcessRemindersPrevious,
          newPropertiesParticulierToday,
          newPropertiesParticulierYesterday,
          newPropertiesProToday,
          newPropertiesProYesterday,
          surveillancesActives,
        ] = await Promise.all([
          safeCountOrDefault(countAnnonces('Particulier'), 'total particuliers'),
          safeCountOrDefault(countAnnonces('Pro'), 'total pros'),
          safeCountOrDefault(countAnnonces(undefined, `${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`), 'annonces en ligne'),
          safeCountOrDefault(countAnnonces(undefined, `${previousStartDate}T00:00:00.000Z`, `${previousEndDate}T23:59:59.999Z`), 'annonces en ligne précédent'),
          safeCountOrDefault(
            countPigeActions({
              from: `${startDate}T00:00:00.000Z`,
              to: `${endDate}T23:59:59.999Z`,
            }).then((count) => ({ count, error: null })),
            'annonces traitées'
          ),
          safeCountOrDefault(
            countPigeActions({
              from: `${previousStartDate}T00:00:00.000Z`,
              to: `${previousEndDate}T23:59:59.999Z`,
            }).then((count) => ({ count, error: null })),
            'annonces traitées précédent'
          ),
          safeCountOrDefault(
            countPigeActions({
              actionTypes: ['called'],
              from: `${startDate}T00:00:00.000Z`,
              to: `${endDate}T23:59:59.999Z`,
            }).then((count) => ({ count, error: null })),
            'appels'
          ),
          safeCountOrDefault(
            countPigeActions({
              actionTypes: ['called'],
              from: `${previousStartDate}T00:00:00.000Z`,
              to: `${previousEndDate}T23:59:59.999Z`,
            }).then((count) => ({ count, error: null })),
            'appels précédent'
          ),
          safeCountOrDefault(
            countPigeActions({ actionTypes: ['reminder', 'rdv'] }).then((count) => ({ count, error: null })),
            'rappels'
          ),
          safeCountOrDefault(
            countPigeActions({
              actionTypes: ['reminder', 'rdv'],
              from: `${previousStartDate}T00:00:00.000Z`,
              to: `${previousEndDate}T23:59:59.999Z`,
            }).then((count) => ({ count, error: null })),
            'rappels précédent'
          ),
          safeCountOrDefault(
            countPigeActions({
              actionTypes: ['to_call'],
              from: `${startDate}T00:00:00.000Z`,
              to: `${endDate}T23:59:59.999Z`,
            }).then((count) => ({ count, error: null })),
            'à traiter'
          ),
          safeCountOrDefault(
            countPigeActions({
              actionTypes: ['to_call'],
              from: `${previousStartDate}T00:00:00.000Z`,
              to: `${previousEndDate}T23:59:59.999Z`,
            }).then((count) => ({ count, error: null })),
            'à traiter précédent'
          ),
          safeCountOrDefault(countAnnonces('Particulier', `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`), 'particuliers aujourd’hui'),
          safeCountOrDefault(countAnnonces('Particulier', `${yesterdayStr}T00:00:00.000Z`, `${yesterdayStr}T23:59:59.999Z`), 'particuliers hier'),
          safeCountOrDefault(countAnnonces('Pro', `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`), 'pros aujourd’hui'),
          safeCountOrDefault(countAnnonces('Pro', `${yesterdayStr}T00:00:00.000Z`, `${yesterdayStr}T23:59:59.999Z`), 'pros hier'),
          safeCountOrDefault(
            supabase.from('surveillances').select('id', { count: 'exact', head: true }).in('user_id', activityScope.userIds).eq('active', true),
            'surveillances'
          ),
        ]);

        const variation = (current: number, previous: number) =>
          previous ? Math.round(((current - previous) / previous) * 100) : 0;
        const conversionRate = totalAnnonces ? (appelsPasses / totalAnnonces) * 100 : 0;
        const conversionRatePrevious = totalOnlineAnnoncesPrevious ? (appelsPassesPrevious / totalOnlineAnnoncesPrevious) * 100 : 0;

        setKpis({
          totalAnnonces,
          totalAnnoncesVariation: 0,
          totalAnnoncesPro,
          totalAnnoncesProVariation: 0,
          totalOnlineAnnonces,
          totalOnlineAnnoncesVariation: variation(totalOnlineAnnonces, totalOnlineAnnoncesPrevious),
          propertiesProcessed,
          propertiesProcessedVariation: variation(propertiesProcessed, propertiesProcessedPrevious),
          appelsPasses,
          appelsPassesVariation: variation(appelsPasses, appelsPassesPrevious),
          rappelsAFaire,
          rappelsAFaireVariation: variation(rappelsAFaire, rappelsAFairePrevious),
          toProcessReminders,
          toProcessRemindersVariation: variation(toProcessReminders, toProcessRemindersPrevious),
          newPropertiesParticulierToday,
          newPropertiesParticulierTodayVariation: variation(newPropertiesParticulierToday, newPropertiesParticulierYesterday),
          newPropertiesProToday,
          newPropertiesProTodayVariation: variation(newPropertiesProToday, newPropertiesProYesterday),
          conversionRate: Math.round(conversionRate * 10) / 10,
          conversionRateVariation: variation(conversionRate, conversionRatePrevious),
          surveillancesActives,
          surveillancesActivesVariation: 0,
        });
      });
    } catch (err) {
      setSectionError('kpis', err);
    } finally {
      setKpiLoading(false);
    }
  };

  const fetchEvolution = async () => {
    if (!appUser || activityScope.loading || activityScope.userIds.length === 0) return;
    clearSectionError('evolution');

    try {
      await measure('evolution', async () => {
        const { startDate, endDate } = getDateRange();
        let annoncesQuery = supabase
          .from('annonces')
          .select('publication_date, owner_type')
          .gte('publication_date', `${startDate}T00:00:00.000Z`)
          .lte('publication_date', `${endDate}T23:59:59.999Z`)
          .eq('supprimee', false)
          .eq('en_ligne', true)
          .limit(1200);

        if (filters.city) annoncesQuery = annoncesQuery.ilike('city', `%${filters.city}%`);

        const [{ data: annoncesData, error: annoncesError }, { data: appelsData, error: appelsError }] = await Promise.all([
          withTimeout(annoncesQuery, 'évolution annonces'),
          withTimeout(
            fetchPigeActionRows({
              actionTypes: ['called'],
              from: `${startDate}T00:00:00.000Z`,
              to: `${endDate}T23:59:59.999Z`,
            }),
            'évolution appels'
          ),
        ]);

        if (annoncesError) throw annoncesError;
        if (appelsError) throw appelsError;

        const evolutionMap = new Map<string, { annoncesParticulier: number; annoncesPro: number; appels: number }>();
        const currDate = parseISO(startDate);
        const endDateObj = parseISO(endDate);
        while (currDate <= endDateObj) {
          evolutionMap.set(format(currDate, 'yyyy-MM-dd'), { annoncesParticulier: 0, annoncesPro: 0, appels: 0 });
          currDate.setDate(currDate.getDate() + 1);
        }

        annoncesData?.forEach(item => {
          const date = format(parseISO(item.publication_date), 'yyyy-MM-dd');
          const existing = evolutionMap.get(date);
          if (!existing) return;
          if (item.owner_type === 'Particulier') existing.annoncesParticulier += 1;
          if (item.owner_type === 'Professionnel' || item.owner_type === 'Pro') existing.annoncesPro += 1;
        });

        appelsData?.forEach(item => {
          const rawDate = item.scheduled_at || item.updated_at;
          if (!rawDate) return;
          const date = format(parseISO(rawDate), 'yyyy-MM-dd');
          const existing = evolutionMap.get(date);
          if (existing) existing.appels += 1;
        });

        setEvolution(Array.from(evolutionMap.entries()).map(([date, data]) => ({
          date: format(parseISO(date), 'dd/MM'),
          annoncesParticulier: data.annoncesParticulier,
          annoncesPro: data.annoncesPro,
          appels: data.appels,
        })));
      });
    } catch (err) {
      setSectionError('evolution', err);
      setEvolution([]);
    }
  };

  const fetchPropertyTypes = async () => {
    clearSectionError('propertyTypes');

    try {
      await measure('propertyTypes', async () => {
        const { startDate, endDate } = getDateRange();
        const colors: Record<string, string> = {
          Maison: '#EF4444',
          Appartement: '#3B82F6',
          Parking: '#8B5CF6',
          Terrain: '#F59E0B',
          'Bureaux & Commerces': '#10B981',
          Autre: '#64748B',
        };

        const buildQuery = (ownerType: string) => {
          let query = supabase
            .from('annonces')
            .select('type_de_bien')
            .eq('owner_type', ownerType)
            .eq('en_ligne', true)
            .eq('supprimee', false)
            .gte('publication_date', `${startDate}T00:00:00.000Z`)
            .lte('publication_date', `${endDate}T23:59:59.999Z`)
            .limit(1000);
          if (filters.city) query = query.ilike('city', `%${filters.city}%`);
          return query;
        };

        const [{ data: proData, error: proError }, { data: particulierData, error: particulierError }] = await Promise.all([
          withTimeout(buildQuery('Pro'), 'types pros'),
          withTimeout(buildQuery('Particulier'), 'types particuliers'),
        ]);

        if (proError) throw proError;
        if (particulierError) throw particulierError;

        const group = (rows?: { type_de_bien?: string | null }[]) => {
          const map = new Map<string, number>();
          rows?.forEach(row => {
            const type = row.type_de_bien || 'Autre';
            map.set(type, (map.get(type) || 0) + 1);
          });
          return Array.from(map.entries()).map(([name, value]) => ({
            name,
            value,
            color: colors[name] || '#9CA3AF',
          }));
        };

        setPropertyTypesPro(group(proData || []));
        setPropertyTypesParticulier(group(particulierData || []));
      });
    } catch (err) {
      setSectionError('propertyTypes', err);
      setPropertyTypesPro([]);
      setPropertyTypesParticulier([]);
    }
  };

  const fetchStatusDistribution = async () => {
    if (!appUser || activityScope.loading || activityScope.userIds.length === 0) return;
    clearSectionError('statusDistribution');

    try {
      await measure('statusDistribution', async () => {
        const [{ count: favorisCount, error: favorisError }, pigeActions] = await Promise.all([
          withTimeout(
            supabase.from('favoris').select('id', { count: 'exact', head: true }).in('user_id', activityScope.userIds),
            'favoris'
          ),
          fetchPigeActionRows({ limit: 1000 }),
        ]);

        if (favorisError) throw favorisError;

        const statusMap = new Map<string, number>();
        statusMap.set('Favoris', favorisCount || 0);
        pigeActions?.forEach((item: any) => {
          const displayName = {
            to_call: 'À appeler',
            reminder: 'À rappeler',
            called: 'Appelé',
            rdv: 'RDV',
            hidden: 'Masqué',
            viewed: 'Déjà vu',
          }[item.action_type as string] || item.action_type;
          statusMap.set(displayName, (statusMap.get(displayName) || 0) + 1);
        });

        const chartColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
        setStatusDistribution(Array.from(statusMap.entries()).map(([name, value], index) => ({
          name,
          value,
          color: chartColors[index % chartColors.length],
        })));
      });
    } catch (err) {
      setSectionError('statusDistribution', err);
      setStatusDistribution([]);
    }
  };

  const fetchRecentActivity = async () => {
    if (!appUser || activityScope.loading || activityScope.userIds.length === 0) return;
    clearSectionError('recentActivity');

    try {
      await measure('recentActivity', async () => {
        const [actionsResult, favorisResult, surveillancesResult] = await Promise.all([
          fetchPigeActionRows({ limit: 8 }),
          withTimeout(
            supabase
              .from('favoris')
              .select('id, user_id, date_favoris, annonces!inner(title)')
              .in('user_id', activityScope.userIds)
              .order('date_favoris', { ascending: false })
              .limit(5),
            'activité favoris'
          ),
          withTimeout(
            supabase
              .from('surveillances')
              .select('id, created_at, annonces!inner(title)')
              .in('user_id', activityScope.userIds)
              .eq('active', true)
              .order('created_at', { ascending: false })
              .limit(5),
            'activité surveillances'
          ),
        ]);

        if (favorisResult.error) throw favorisResult.error;
        if (surveillancesResult.error) throw surveillancesResult.error;

        const activities: ActivityItem[] = [];
        actionsResult?.forEach((item: any) => {
          const labelMap: Record<string, { type: ActivityItem['type']; description: string; icon: string }> = {
            called: { type: 'appel', description: `Appel passé pour "${item.annonces?.title || 'Annonce'}"`, icon: '📞' },
            reminder: { type: 'rappel', description: `Rappel programmé pour "${item.annonces?.title || 'Annonce'}"`, icon: '⏰' },
            to_call: { type: 'rappel', description: `Annonce à appeler: "${item.annonces?.title || 'Annonce'}"`, icon: '☎️' },
            rdv: { type: 'rappel', description: `RDV programmé pour "${item.annonces?.title || 'Annonce'}"`, icon: '📅' },
            viewed: { type: 'annonce', description: `Annonce consultée: "${item.annonces?.title || 'Annonce'}"`, icon: '👁️' },
          };
          const meta = labelMap[item.action_type];
          if (!meta) return;
          activities.push({
            id: item.id,
            type: meta.type,
            description: meta.description,
            timestamp: item.scheduled_at || item.updated_at,
            icon: meta.icon,
          });
        });
        favorisResult.data?.forEach((item: any) => {
          activities.push({
            id: item.id,
            type: 'favori',
            description: `Favori ajouté pour "${item.annonces?.title || 'Annonce'}"`,
            timestamp: item.date_favoris,
            icon: '❤️',
          });
        });
        surveillancesResult.data?.forEach(item => {
          activities.push({
            id: item.id,
            type: 'surveillance',
            description: `Surveillance activée pour "${item.annonces.title}"`,
            timestamp: item.created_at,
            icon: '👁️',
          });
        });

        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivity(activities.slice(0, 10));
      });
    } catch (err) {
      setSectionError('recentActivity', err);
      setRecentActivity([]);
    }
  };

  useEffect(() => {
    if (!appUser || activityScope.loading) return;

    void fetchKPIs();

    window.setTimeout(() => {
      setChartLoading(true);
      Promise.allSettled([
        fetchEvolution(),
        fetchPropertyTypes(),
        fetchStatusDistribution(),
      ]).finally(() => setChartLoading(false));
    }, 80);

    window.setTimeout(() => {
      setActivityLoading(true);
      fetchRecentActivity().finally(() => setActivityLoading(false));
    }, 180);
  }, [appUser, filters, activityScope.loading, activityScope.userIds.join('|')]);

  const exportData = async () => {
    try {
      const csvContent = [
        ['Métrique', 'Valeur', 'Variation (%)'].join(','),
        ['Total annonces', kpis.totalAnnonces.toString(), kpis.totalAnnoncesVariation.toString()].join(','),
        ['Annonces traitées', String(kpis.propertiesProcessed || 0), String(kpis.propertiesProcessedVariation || 0)].join(','),
        ['Appels passés', kpis.appelsPasses.toString(), kpis.appelsPassesVariation.toString()].join(','),
        ['Rappels à venir', kpis.rappelsAFaire.toString(), kpis.rappelsAFaireVariation.toString()].join(','),
        ['Nouvelles annonces Particulier (aujourd’hui)', kpis.newPropertiesParticulierToday.toString(), kpis.newPropertiesParticulierTodayVariation.toString()].join(','),
        ['Nouvelles annonces PRO (aujourd’hui)', kpis.newPropertiesProToday.toString(), kpis.newPropertiesProTodayVariation.toString()].join(','),
        ['Taux de conversion (%)', String(kpis.conversionRate || 0), String(kpis.conversionRateVariation || 0)].join(','),
        ['Surveillances actives', kpis.surveillancesActives.toString(), kpis.surveillancesActivesVariation.toString()].join(','),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `dashboard_analytics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Données exportées avec succès');
    } catch (err) {
      console.error('Erreur lors de l\'export:', err);
      toast.error('Erreur lors de l\'export des données');
    }
  };

  const error = Object.values(errorBySection)[0] || null;

  return {
    kpis,
    evolution,
    propertyTypesPro,
    propertyTypesParticulier,
    statusDistribution,
    recentActivity,
    loading: kpiLoading || chartLoading || activityLoading,
    kpiLoading,
    chartLoading,
    activityLoading,
    error,
    errorBySection,
    exportData,
  };
};
