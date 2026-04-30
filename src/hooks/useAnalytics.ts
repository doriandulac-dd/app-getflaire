import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { AnalyticsFilters, KPIData, EvolutionData, DonutData, ActivityItem } from '../types/analytics';
import { subDays, format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export const useAnalytics = (filters: AnalyticsFilters) => {
  const { appUser } = useAuth();
  const [kpis, setKpis] = useState<KPIData>({
    totalAnnonces: 0,
    totalAnnoncesVariation: 0,
    totalOnlineAnnonces: 0,
    totalOnlineAnnoncesVariation: 0,
    appelsPasses: 0,
    appelsPassesVariation: 0,
    rappelsAFaire: 0,
    rappelsAFaireVariation: 0,
    surveillancesActives: 0,
    surveillancesActivesVariation: 0,
  });
  const [evolution, setEvolution] = useState<EvolutionData[]>([]);
  const [propertyTypesPro, setPropertyTypesPro] = useState<DonutData[]>([]);
  const [propertyTypesParticulier, setPropertyTypesParticulier] = useState<DonutData[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<DonutData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (filters.period === 'custom' && filters.startDate && filters.endDate) {
      startDate = parseISO(filters.startDate);
      endDate = parseISO(filters.endDate);
    } else {
      const days = parseInt(filters.period);
      startDate = subDays(now, days);
    }

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      previousStartDate: format(subDays(startDate, parseInt(filters.period) || 30), 'yyyy-MM-dd'),
      previousEndDate: format(subDays(startDate, 1), 'yyyy-MM-dd'),
    };
  };

  const fetchKPIs = async () => {
    if (!appUser) return;

    try {
      const { startDate, endDate, previousStartDate, previousEndDate } = getDateRange();

      // Total annonces (current period)
      let totalAnnoncesQuery = supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_type', 'Particulier')
        .eq('en_ligne', true)
        .eq('supprimee', false);

      if (filters.city) {
        totalAnnoncesQuery = totalAnnoncesQuery.ilike('city', `%${filters.city}%`);
      }

      const { count: totalAnnonces } = await totalAnnoncesQuery;

      // Total annonces (previous period)
      let totalAnnoncesPreviousQuery = supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_type', 'Particulier')
        .eq('en_ligne', true)
        .eq('supprimee', false);

      if (filters.city) {
        totalAnnoncesPreviousQuery = totalAnnoncesPreviousQuery.ilike('city', `%${filters.city}%`);
      }

      const { count: totalAnnoncesPrevious } = await totalAnnoncesPreviousQuery;

      // Total annonces Pro (current period)
      let totalAnnoncesProQuery = supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_type', 'Pro')
        .eq('en_ligne', true)
        .eq('supprimee', false);

      if (filters.city) {
        totalAnnoncesProQuery = totalAnnoncesProQuery.ilike('city', `%${filters.city}%`);
      }

      const { count: totalAnnoncesPro } = await totalAnnoncesProQuery;

      // Total annonces Pro (previous period)
      let totalAnnoncesProPreviousQuery = supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_type', 'Pro')
        .eq('en_ligne', true)
        .eq('supprimee', false);

      if (filters.city) {
        totalAnnoncesProPreviousQuery = totalAnnoncesProPreviousQuery.ilike('city', `%${filters.city}%`);
      }

      const { count: totalAnnoncesProPrevious } = await totalAnnoncesProPreviousQuery;

      // Total annonces en ligne (current period) - toutes les annonces en ligne
      let totalOnlineAnnoncesQuery = supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .gte('publication_date', `${startDate}T00:00:00.000Z`)
        .lte('publication_date', `${endDate}T23:59:59.999Z`)
        .eq('en_ligne', true)
        .eq('supprimee', false);

      if (filters.city) {
        totalOnlineAnnoncesQuery = totalOnlineAnnoncesQuery.ilike('city', `%${filters.city}%`);
      }

      const { count: totalOnlineAnnonces } = await totalOnlineAnnoncesQuery;

      // Total annonces en ligne (previous period)
      let totalOnlineAnnoncesPreviousQuery = supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .gte('publication_date', `${previousStartDate}T00:00:00.000Z`)
        .lte('publication_date', `${previousEndDate}T23:59:59.999Z`)
        .eq('en_ligne', true)
        .eq('supprimee', false);

      if (filters.city) {
        totalOnlineAnnoncesPreviousQuery = totalOnlineAnnoncesPreviousQuery.ilike('city', `%${filters.city}%`);
      }

      const { count: totalOnlineAnnoncesPrevious } = await totalOnlineAnnoncesPreviousQuery;

      // Annonces traitées (current period)
      const { count: propertiesProcessed } = await supabase
        .from('suivi_annonce')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .gte('date_suivi', `${startDate}T00:00:00.000Z`)
        .lte('date_suivi', `${endDate}T23:59:59.999Z`);

      // Annonces traitées (previous period)
      const { count: propertiesProcessedPrevious } = await supabase
        .from('suivi_annonce')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .gte('date_suivi', `${previousStartDate}T00:00:00.000Z`)
        .lte('date_suivi', `${previousEndDate}T23:59:59.999Z`);
      // Appels passés (current period)
      const { count: appelsPasses } = await supabase
        .from('suivi_annonce')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('statut', 'called')
        .gte('date_suivi', `${startDate}T00:00:00.000Z`)
        .lte('date_suivi', `${endDate}T23:59:59.999Z`);

      // Appels passés (previous period)
      const { count: appelsPassesPrevious } = await supabase
        .from('suivi_annonce')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('statut', 'called')
        .gte('date_suivi', `${previousStartDate}T00:00:00.000Z`)
        .lte('date_suivi', `${previousEndDate}T23:59:59.999Z`);

      // Rappels à faire
      const { count: rappelsAFaire } = await supabase
        .from('rappels')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('status', 'pending')
        .gte('date_rappel', new Date().toISOString());

      // Rappels à faire (previous period)
      const { count: rappelsAFairePrevious } = await supabase
        .from('rappels')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('status', 'pending')
        .gte('date_rappel', `${previousStartDate}T00:00:00.000Z`)
        .lte('date_rappel', `${previousEndDate}T23:59:59.999Z`);

      // À traiter (current period)
      const { count: toProcessReminders } = await supabase
        .from('suivi_annonce')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('statut', 'to_process')
        .gte('date_suivi', `${startDate}T00:00:00.000Z`)
        .lte('date_suivi', `${endDate}T23:59:59.999Z`);

      // À traiter (previous period)
      const { count: toProcessRemindersPrevious } = await supabase
        .from('suivi_annonce')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('statut', 'to_process')
        .gte('date_suivi', `${previousStartDate}T00:00:00.000Z`)
        .lte('date_suivi', `${previousEndDate}T23:59:59.999Z`);

      // Nouvelles annonces aujourd'hui
      const today = new Date().toISOString().split('T')[0];
      const { count: newPropertiesParticulierToday } = await supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .gte('publication_date', `${today}T00:00:00.000Z`)
        .lte('publication_date', `${today}T23:59:59.999Z`)
        .eq('owner_type', 'Particulier')
        .eq('en_ligne', true)
        .eq('supprimee', false);

      // Nouvelles annonces Pro aujourd'hui
      const { count: newPropertiesProToday } = await supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .gte('publication_date', `${today}T00:00:00.000Z`)
        .lte('publication_date', `${today}T23:59:59.999Z`)
        .eq('owner_type', 'Pro')
        .eq('en_ligne', true)
        .eq('supprimee', false);

      // Nouvelles annonces hier
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const { count: newPropertiesParticulierYesterday } = await supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .gte('publication_date', `${yesterdayStr}T00:00:00.000Z`)
        .lte('publication_date', `${yesterdayStr}T23:59:59.999Z`)
        .eq('owner_type', 'Particulier')
        .eq('en_ligne', true)
        .eq('supprimee', false);

      // Nouvelles annonces Pro hier
      const { count: newPropertiesProYesterday } = await supabase
        .from('annonces')
        .select('*', { count: 'exact', head: true })
        .gte('publication_date', `${yesterdayStr}T00:00:00.000Z`)
        .lte('publication_date', `${yesterdayStr}T23:59:59.999Z`)
        .eq('owner_type', 'Pro')
        .eq('en_ligne', true)
        .eq('supprimee', false);
      // Surveillances actives
      const { count: surveillancesActives } = await supabase
        .from('surveillances')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id)
        .eq('active', true);

      // Calculate variations
      const totalAnnoncesVariation = totalAnnoncesPrevious ? 
        ((totalAnnonces || 0) - totalAnnoncesPrevious) / totalAnnoncesPrevious * 100 : 0;
      
      const totalAnnoncesProVariation = totalAnnoncesProPrevious ? 
        ((totalAnnoncesPro || 0) - totalAnnoncesProPrevious) / totalAnnoncesProPrevious * 100 : 0;
      
      const totalOnlineAnnoncesVariation = totalOnlineAnnoncesPrevious ? 
        ((totalOnlineAnnonces || 0) - totalOnlineAnnoncesPrevious) / totalOnlineAnnoncesPrevious * 100 : 0;
      
      const propertiesProcessedVariation = propertiesProcessedPrevious ? 
        ((propertiesProcessed || 0) - propertiesProcessedPrevious) / propertiesProcessedPrevious * 100 : 0;

      const appelsPassesVariation = appelsPassesPrevious ? 
        ((appelsPasses || 0) - appelsPassesPrevious) / appelsPassesPrevious * 100 : 0;

      const rappelsAFaireVariation = rappelsAFairePrevious ? 
        ((rappelsAFaire || 0) - rappelsAFairePrevious) / rappelsAFairePrevious * 100 : 0;

      const toProcessRemindersVariation = toProcessRemindersPrevious ? 
        ((toProcessReminders || 0) - toProcessRemindersPrevious) / toProcessRemindersPrevious * 100 : 0;

      const newPropertiesParticulierTodayVariation = newPropertiesParticulierYesterday ? 
        ((newPropertiesParticulierToday || 0) - newPropertiesParticulierYesterday) / newPropertiesParticulierYesterday * 100 : 0;

      const newPropertiesProTodayVariation = newPropertiesProYesterday ? 
        ((newPropertiesProToday || 0) - newPropertiesProYesterday) / newPropertiesProYesterday * 100 : 0;

      // Calculate conversion rate (appels passés / total annonces)
      const conversionRate = totalAnnonces ? ((appelsPasses || 0) / totalAnnonces * 100) : 0;
      const conversionRatePrevious = totalAnnoncesPrevious ? ((appelsPassesPrevious || 0) / totalAnnoncesPrevious * 100) : 0;
      const conversionRateVariation = conversionRatePrevious ? 
        (conversionRate - conversionRatePrevious) / conversionRatePrevious * 100 : 0;
      setKpis({
        totalAnnonces: totalAnnonces || 0,
        totalAnnoncesVariation: Math.round(totalAnnoncesVariation),
        totalAnnoncesPro: totalAnnoncesPro || 0,
        totalAnnoncesProVariation: Math.round(totalAnnoncesProVariation),
        totalOnlineAnnonces: totalOnlineAnnonces || 0,
        totalOnlineAnnoncesVariation: Math.round(totalOnlineAnnoncesVariation),
        propertiesProcessed: propertiesProcessed || 0,
        propertiesProcessedVariation: Math.round(propertiesProcessedVariation),
        appelsPasses: appelsPasses || 0,
        appelsPassesVariation: Math.round(appelsPassesVariation),
        rappelsAFaire: rappelsAFaire || 0,
        rappelsAFaireVariation: Math.round(rappelsAFaireVariation),
        toProcessReminders: toProcessReminders || 0,
        toProcessRemindersVariation: Math.round(toProcessRemindersVariation),
        newPropertiesParticulierToday: newPropertiesParticulierToday || 0,
        newPropertiesParticulierTodayVariation: Math.round(newPropertiesParticulierTodayVariation),
        newPropertiesProToday: newPropertiesProToday || 0,
        newPropertiesProTodayVariation: Math.round(newPropertiesProTodayVariation),
        conversionRate: Math.round(conversionRate * 10) / 10, // Round to 1 decimal
        conversionRateVariation: Math.round(conversionRateVariation),
        surveillancesActives: surveillancesActives || 0,
        surveillancesActivesVariation: 0, // Could be calculated if needed
      });
    } catch (err: any) {
      console.error('Error fetching KPIs:', err);
      setError(err.message);
    }
  };

const fetchEvolution = async () => {
  if (!appUser) return;

  try {
    const { startDate, endDate } = getDateRange();

    // 1. Récupérer owner_type + publication_date avec tous les filtres
    let annoncesQuery = supabase
      .from('annonces')
      .select('publication_date, owner_type')
      .gte('publication_date', `${startDate}T00:00:00.000Z`)
      .lte('publication_date', `${endDate}T23:59:59.999Z`)
      .eq('supprimee', false)
      .eq('en_ligne', true);

    // Appliquer le filtre ville si nécessaire
    if (filters.city) {
      annoncesQuery = annoncesQuery.ilike('city', `%${filters.city}%`);
    }

    const { data: annoncesData, error: annoncesError } = await annoncesQuery;
    
    if (annoncesError) {
      console.error('Error fetching annonces data:', annoncesError);
      throw annoncesError;
    }

    // 2. Appels
    const { data: appelsData } = await supabase
      .from('suivi_annonce')
      .select('date_suivi')
      .eq('user_id', appUser.id)
      .eq('statut', 'called')
      .gte('date_suivi', `${startDate}T00:00:00.000Z`)
      .lte('date_suivi', `${endDate}T23:59:59.999Z`);

    // 3. Map date -> { annoncesParticulier, annoncesPro, appels }
    const evolutionMap = new Map<string, { annoncesParticulier: number; annoncesPro: number; appels: number }>();

    // 4. Initialise toutes les dates
    const currDate = parseISO(startDate);
    const endDateObj = parseISO(endDate);
    while (currDate <= endDateObj) {
      const dateStr = format(currDate, 'yyyy-MM-dd');
      evolutionMap.set(dateStr, { annoncesParticulier: 0, annoncesPro: 0, appels: 0 });
      currDate.setDate(currDate.getDate() + 1);
    }

    // 5. Compte les annonces par type/owner_type
    annoncesData?.forEach(item => {
      const date = format(parseISO(item.publication_date), 'yyyy-MM-dd');
      const existing = evolutionMap.get(date);
      if (existing) {
        if (item.owner_type === 'Particulier') {
          existing.annoncesParticulier++;
        } else if (item.owner_type === 'Professionnel' || item.owner_type === 'Pro') {
          existing.annoncesPro++;
        }
      }
    });

    // 6. Compte les appels par date
    appelsData?.forEach(item => {
      const date = format(parseISO(item.date_suivi), 'yyyy-MM-dd');
      const existing = evolutionMap.get(date);
      if (existing) {
        existing.appels++;
      }
    });

    // 7. Transforme en tableau pour graphe
    const evolutionArray: EvolutionData[] = Array.from(evolutionMap.entries()).map(([date, data]) => ({
      date: format(parseISO(date), 'dd/MM'),
      annoncesParticulier: data.annoncesParticulier,
      annoncesPro: data.annoncesPro,
      appels: data.appels,
    }));

    setEvolution(evolutionArray);
  } catch (err: any) {
    console.error('Error fetching evolution:', err);
    setError(err.message);
  }
};
  
const fetchPropertyTypes = async () => {
  try {
    const { startDate, endDate } = getDateRange();

    // Mapping couleur unique (même couleur pour pro et particulier)
    const propertyTypeColors: Record<string, string> = {
      "Maison": "#EF4444",              // Rouge
      "Appartement": "#3B82F6",         // Bleu
      "Parking": "#8B5CF6",             // Violet
      "Terrain": "#F59E0B",             // Jaune orangé
      "Bureaux & Commerces": "#10B981", // Vert
      "Autre": "#64748B",               // Gris/bleuté
    };
    const defaultColor = "#9CA3AF";      // Gris neutre si non trouvé

    // Professionnels
    let proQuery = supabase
      .from('annonces')
      .select('type_de_bien')
      .eq('owner_type', 'Pro')
      .eq('en_ligne', true)
      .eq('supprimee', false)
      .gte('publication_date', `${startDate}T00:00:00.000Z`)
      .lte('publication_date', `${endDate}T23:59:59.999Z`);

    // Particuliers
    let particulierQuery = supabase
      .from('annonces')
      .select('type_de_bien')
      .eq('owner_type', 'Particulier')
      .eq('en_ligne', true)
      .eq('supprimee', false)
      .gte('publication_date', `${startDate}T00:00:00.000Z`)
      .lte('publication_date', `${endDate}T23:59:59.999Z`);

    if (filters.city) {
      proQuery = proQuery.ilike('city', `%${filters.city}%`);
      particulierQuery = particulierQuery.ilike('city', `%${filters.city}%`);
    }

    const [{ data: proData }, { data: particulierData }] = await Promise.all([
      proQuery,
      particulierQuery
    ]);

    // Groupement pour Professionnels
    const proTypes = new Map<string, number>();
    proData?.forEach(item => {
      const type = item.type_de_bien || 'Autre';
      proTypes.set(type, (proTypes.get(type) || 0) + 1);
    });

    // Groupement pour Particuliers
    const particulierTypes = new Map<string, number>();
    particulierData?.forEach(item => {
      const type = item.type_de_bien || 'Autre';
      particulierTypes.set(type, (particulierTypes.get(type) || 0) + 1);
    });

    // Utilisation du mapping couleur unique
    setPropertyTypesPro(
      Array.from(proTypes.entries()).map(([name, value]) => ({
        name,
        value,
        color: propertyTypeColors[name] || defaultColor,
      }))
    );
    setPropertyTypesParticulier(
      Array.from(particulierTypes.entries()).map(([name, value]) => ({
        name,
        value,
        color: propertyTypeColors[name] || defaultColor,
      }))
    );
  } catch (err: any) {
    console.error('Error fetching property types:', err);
    setError(err.message);
  }
};

  const fetchStatusDistribution = async () => {
    if (!appUser) return;

    try {
      // Fetch favoris count
      const { count: favorisCount } = await supabase
        .from('favoris')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', appUser.id);

      // Fetch suivi statuses
      const { data: suiviData } = await supabase
        .from('suivi_annonce')
        .select('statut')
        .eq('user_id', appUser.id);

      // Count by status
      const statusMap = new Map<string, number>();
      statusMap.set('Favoris', favorisCount || 0);

      suiviData?.forEach(item => {
        const status = item.statut;
        let displayName = '';
        switch (status) {
          case 'to_process': displayName = 'À traiter'; break;
          case 'to_call': displayName = 'À rappeler'; break;
          case 'called': displayName = 'Appelé'; break;
          case 'rdv': displayName = 'RDV'; break;
          case 'hidden': displayName = 'Masqué'; break;
          default: displayName = status;
        }
        statusMap.set(displayName, (statusMap.get(displayName) || 0) + 1);
      });

      const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
      const statusData: DonutData[] = Array.from(statusMap.entries()).map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }));

      setStatusDistribution(statusData);
    } catch (err: any) {
      console.error('Error fetching status distribution:', err);
      setError(err.message);
    }
  };

  const fetchRecentActivity = async () => {
    if (!appUser) return;

    try {
      const activities: ActivityItem[] = [];

      // Recent appels
      const { data: appelsData } = await supabase
        .from('suivi_annonce')
        .select(`
          id,
          date_suivi,
          statut,
          annonces!inner(title)
        `)
        .eq('user_id', appUser.id)
        .eq('statut', 'called')
        .order('date_suivi', { ascending: false })
        .limit(5);

      appelsData?.forEach(item => {
        activities.push({
          id: item.id,
          type: 'appel',
          description: `Appel passé pour "${item.annonces.title}"`,
          timestamp: item.date_suivi,
          icon: '📞',
        });
      });

      // Recent rappels
      const { data: rappelsData } = await supabase
        .from('rappels')
        .select('id, created_at, title')
        .eq('user_id', appUser.id)
        .order('created_at', { ascending: false })
        .limit(5);

      rappelsData?.forEach(item => {
        activities.push({
          id: item.id,
          type: 'rappel',
          description: `Rappel créé: ${item.title}`,
          timestamp: item.created_at,
          icon: '⏰',
        });
      });

      // Recent surveillances
      const { data: surveillancesData } = await supabase
        .from('surveillances')
        .select(`
          id,
          created_at,
          annonces!inner(title)
        `)
        .eq('user_id', appUser.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      surveillancesData?.forEach(item => {
        activities.push({
          id: item.id,
          type: 'surveillance',
          description: `Surveillance activée pour "${item.annonces.title}"`,
          timestamp: item.created_at,
          icon: '👁️',
        });
      });

      // Sort all activities by timestamp and take the 10 most recent
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 10));
    } catch (err: any) {
      console.error('Error fetching recent activity:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    if (appUser) {
      setLoading(true);
      setError(null);

      Promise.all([
        fetchKPIs(),
        fetchEvolution(),
        fetchPropertyTypes(),
        fetchStatusDistribution(),
        fetchRecentActivity(),
      ]).finally(() => {
        setLoading(false);
      });
    }
  }, [appUser, filters]);
  const exportData = async () => {
    try {
      const csvContent = [
  ['Métrique', 'Valeur', 'Variation (%)'].join(','),
  ['Total annonces', kpis.totalAnnonces.toString(), kpis.totalAnnoncesVariation.toString()].join(','),
  ['Annonces traitées', kpis.propertiesProcessed.toString(), kpis.propertiesProcessedVariation.toString()].join(','),
  ['Appels passés', kpis.appelsPasses.toString(), kpis.appelsPassesVariation.toString()].join(','),
  ['Rappels à venir', kpis.rappelsAFaire.toString(), kpis.rappelsAFaireVariation.toString()].join(','),
  ['Nouvelles annonces Particulier (aujourd’hui)', kpis.newPropertiesParticulierToday.toString(), kpis.newPropertiesParticulierTodayVariation.toString()].join(','),
  ['Nouvelles annonces PRO (aujourd’hui)', kpis.newPropertiesProToday.toString(), kpis.newPropertiesProTodayVariation.toString()].join(','),
  ['Taux de conversion (%)', kpis.conversionRate.toString(), kpis.conversionRateVariation.toString()].join(','),
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
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      toast.error('Erreur lors de l\'export des données');
    }
  };

  return {
    kpis,
    evolution,
    propertyTypesPro,
    propertyTypesParticulier,
    statusDistribution,
    recentActivity,
    loading,
    error,
    exportData,
  };
};
