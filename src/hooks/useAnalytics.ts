import { useEffect, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
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

export const useAnalytics = (filters: AnalyticsFilters) => {
  const { appUser } = useAuth();
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
    if (!appUser) return;

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
            supabase.from('suivi_annonce').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).gte('date_suivi', `${startDate}T00:00:00.000Z`).lte('date_suivi', `${endDate}T23:59:59.999Z`),
            'annonces traitées'
          ),
          safeCountOrDefault(
            supabase.from('suivi_annonce').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).gte('date_suivi', `${previousStartDate}T00:00:00.000Z`).lte('date_suivi', `${previousEndDate}T23:59:59.999Z`),
            'annonces traitées précédent'
          ),
          safeCountOrDefault(
            supabase.from('suivi_annonce').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).eq('statut', 'called').gte('date_suivi', `${startDate}T00:00:00.000Z`).lte('date_suivi', `${endDate}T23:59:59.999Z`),
            'appels'
          ),
          safeCountOrDefault(
            supabase.from('suivi_annonce').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).eq('statut', 'called').gte('date_suivi', `${previousStartDate}T00:00:00.000Z`).lte('date_suivi', `${previousEndDate}T23:59:59.999Z`),
            'appels précédent'
          ),
          safeCountOrDefault(
            supabase.from('rappels').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).eq('status', 'pending').gte('date_rappel', new Date().toISOString()),
            'rappels'
          ),
          safeCountOrDefault(
            supabase.from('rappels').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).eq('status', 'pending').gte('date_rappel', `${previousStartDate}T00:00:00.000Z`).lte('date_rappel', `${previousEndDate}T23:59:59.999Z`),
            'rappels précédent'
          ),
          safeCountOrDefault(
            supabase.from('suivi_annonce').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).eq('statut', 'to_process').gte('date_suivi', `${startDate}T00:00:00.000Z`).lte('date_suivi', `${endDate}T23:59:59.999Z`),
            'à traiter'
          ),
          safeCountOrDefault(
            supabase.from('suivi_annonce').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).eq('statut', 'to_process').gte('date_suivi', `${previousStartDate}T00:00:00.000Z`).lte('date_suivi', `${previousEndDate}T23:59:59.999Z`),
            'à traiter précédent'
          ),
          safeCountOrDefault(countAnnonces('Particulier', `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`), 'particuliers aujourd’hui'),
          safeCountOrDefault(countAnnonces('Particulier', `${yesterdayStr}T00:00:00.000Z`, `${yesterdayStr}T23:59:59.999Z`), 'particuliers hier'),
          safeCountOrDefault(countAnnonces('Pro', `${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`), 'pros aujourd’hui'),
          safeCountOrDefault(countAnnonces('Pro', `${yesterdayStr}T00:00:00.000Z`, `${yesterdayStr}T23:59:59.999Z`), 'pros hier'),
          safeCountOrDefault(
            supabase.from('surveillances').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id).eq('active', true),
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
    if (!appUser) return;
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
            supabase
              .from('suivi_annonce')
              .select('date_suivi')
              .eq('user_id', appUser.id)
              .eq('statut', 'called')
              .gte('date_suivi', `${startDate}T00:00:00.000Z`)
              .lte('date_suivi', `${endDate}T23:59:59.999Z`),
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
          const date = format(parseISO(item.date_suivi), 'yyyy-MM-dd');
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
    if (!appUser) return;
    clearSectionError('statusDistribution');

    try {
      await measure('statusDistribution', async () => {
        const [{ count: favorisCount, error: favorisError }, { data: suiviData, error: suiviError }] = await Promise.all([
          withTimeout(
            supabase.from('favoris').select('id', { count: 'exact', head: true }).eq('user_id', appUser.id),
            'favoris'
          ),
          withTimeout(
            supabase.from('suivi_annonce').select('statut').eq('user_id', appUser.id).limit(1000),
            'statuts suivi'
          ),
        ]);

        if (favorisError) throw favorisError;
        if (suiviError) throw suiviError;

        const statusMap = new Map<string, number>();
        statusMap.set('Favoris', favorisCount || 0);
        suiviData?.forEach(item => {
          const displayName = {
            to_process: 'À traiter',
            to_call: 'À rappeler',
            called: 'Appelé',
            rdv: 'RDV',
            hidden: 'Masqué',
          }[item.statut as string] || item.statut;
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
    if (!appUser) return;
    clearSectionError('recentActivity');

    try {
      await measure('recentActivity', async () => {
        const [appelsResult, rappelsResult, surveillancesResult] = await Promise.all([
          withTimeout(
            supabase
              .from('suivi_annonce')
              .select('id, date_suivi, statut, annonces!inner(title)')
              .eq('user_id', appUser.id)
              .eq('statut', 'called')
              .order('date_suivi', { ascending: false })
              .limit(5),
            'activité appels'
          ),
          withTimeout(
            supabase
              .from('rappels')
              .select('id, created_at, title')
              .eq('user_id', appUser.id)
              .order('created_at', { ascending: false })
              .limit(5),
            'activité rappels'
          ),
          withTimeout(
            supabase
              .from('surveillances')
              .select('id, created_at, annonces!inner(title)')
              .eq('user_id', appUser.id)
              .eq('active', true)
              .order('created_at', { ascending: false })
              .limit(5),
            'activité surveillances'
          ),
        ]);

        if (appelsResult.error) throw appelsResult.error;
        if (rappelsResult.error) throw rappelsResult.error;
        if (surveillancesResult.error) throw surveillancesResult.error;

        const activities: ActivityItem[] = [];
        appelsResult.data?.forEach(item => {
          activities.push({
            id: item.id,
            type: 'appel',
            description: `Appel passé pour "${item.annonces.title}"`,
            timestamp: item.date_suivi,
            icon: '📞',
          });
        });
        rappelsResult.data?.forEach(item => {
          activities.push({
            id: item.id,
            type: 'rappel',
            description: `Rappel créé: ${item.title}`,
            timestamp: item.created_at,
            icon: '⏰',
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
    if (!appUser) return;

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
  }, [appUser, filters]);

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
