import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Calendar,
  TrendingUp,
  Users,
  Home,
  BarChart3,
  Clock,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Zap,
} from 'lucide-react';
import StatsCard from '../components/Dashboard/StatsCard';
import EvolutionChart from '../components/Analytics/EvolutionChart';
import PropertyCard from '../components/Properties/PropertyCard';
import { supabase } from '../lib/supabase';
import { Annonce } from '../types';
import { AnalyticsFilters } from '../types/analytics';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';
import { useNavigate } from 'react-router-dom';
import { useGsapReveal } from '../hooks/useGsapReveal';

const Dashboard: React.FC = () => {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AnalyticsFilters>({ period: '7' });

  // États
  const [lastPigeAnnonce, setLastPigeAnnonce] = useState<Annonce[]>([]);
  const [monitoredAnnonces, setMonitoredAnnonces] = useState<Annonce[]>([]);
  const [loadingAnnonces, setLoadingAnnonces] = useState(true);

  // Index carrousels
  const [currentPigeIndex, setCurrentPigeIndex] = useState(0);
  const [currentMonitoredIndex, setCurrentMonitoredIndex] = useState(0);

  const {
    kpis,
    evolution,
    kpiLoading,
    chartLoading,
    error,
    errorBySection,
  } = useAnalytics(filters);

  const dashboardRef = useGsapReveal<HTMLDivElement>(
    [kpiLoading, chartLoading, error, lastPigeAnnonce.length, monitoredAnnonces.length],
    {
      selector: '[data-gsap-reveal]',
      y: 18,
      stagger: 0.055,
    }
  );

  // Dernières annonces Pige — vue + dédup par id_annnoce, particuliers en ligne
  const fetchSpecialAnnonces = async () => {
    if (!appUser?.id) return;
    try {
      setLoadingAnnonces(true);

      const { data: lastAnnonces, error: lastError } = await supabase
        .from('annonces_with_relative_date')
        .select('*')
        .eq('en_ligne', true)
        .eq('supprimee', false)
        .eq('owner_type', 'Particulier')
        .order('publication_date', { ascending: false })
        .limit(20);

      if (lastError) throw lastError;

      if (lastAnnonces && lastAnnonces.length) {
        type Row = Annonce & { id_annnoce?: string | null };
        const uniqueMap = new Map<string, Row>();

        (lastAnnonces as Row[]).forEach(a => {
          const key =
            (a.id_annnoce && a.id_annnoce.trim().length > 0)
              ? a.id_annnoce.trim()
              : String(a.id);
          if (!uniqueMap.has(key)) uniqueMap.set(key, a);
        });

        // on garde les 10 dernières annonces uniques
        const deduped = Array.from(uniqueMap.values()).slice(0, 10) as Annonce[];
        setLastPigeAnnonce(deduped);
      } else {
        setLastPigeAnnonce([]);
      }
    } catch (e) {
      console.error('Error fetching last pige annonces:', e);
      setLastPigeAnnonce([]);
    } finally {
      setLoadingAnnonces(false);
    }
  };

  // Annonces réellement surveillées par l'utilisateur (carrousel)
  const fetchMonitoredAnnonces = async () => {
    if (!appUser?.id) return;
    try {
      setLoadingAnnonces(true);

      const { data: surveillancesData, error: surveillancesError } = await supabase
        .from('surveillances')
        .select('annonce_id')
        .eq('user_id', appUser.id)
        .eq('active', true)
        .order('date_surveillance', { ascending: false }) // ou created_at selon ton schéma
        .limit(10); // ← on charge jusqu'à 10 pour le carrousel

      if (surveillancesError) throw surveillancesError;

      const annonceIds = (surveillancesData || []).map(s => s.annonce_id);
      if (annonceIds.length === 0) {
        setMonitoredAnnonces([]);
        return;
      }

      const { data: annoncesData, error: annoncesError } = await supabase
        .from('annonces')
        .select('*')
        .in('id', annonceIds);

      if (annoncesError) throw annoncesError;

      // Conserver l'ordre des surveillances
      const ordered = annonceIds
        .map(id => (annoncesData || []).find(a => a.id === id))
        .filter(Boolean) as Annonce[];

      setMonitoredAnnonces(ordered);
    } catch (e) {
      console.error('Error fetching monitored annonces:', e);
      setMonitoredAnnonces([]);
    } finally {
      setLoadingAnnonces(false);
    }
  };

  useEffect(() => {
    if (appUser) {
      fetchSpecialAnnonces();
      fetchMonitoredAnnonces();
    }
  }, [appUser]);

  // reset indices quand les listes changent
  useEffect(() => { setCurrentPigeIndex(0); }, [lastPigeAnnonce.length]);
  useEffect(() => { setCurrentMonitoredIndex(0); }, [monitoredAnnonces.length]);

  const handlePeriodChange = (period: string) => {
    setFilters(prev => ({ ...prev, period }));
  };

  // Navigation carrousel Pige
  const handlePrevPige = () => {
    const len = lastPigeAnnonce.length;
    if (len === 0) return;
    setCurrentPigeIndex(prev => (prev - 1 + len) % len);
  };
  const handleNextPige = () => {
    const len = lastPigeAnnonce.length;
    if (len === 0) return;
    setCurrentPigeIndex(prev => (prev + 1) % len);
  };

  // Navigation carrousel Surveillées
  const handlePrevMonitored = () => {
    const len = monitoredAnnonces.length;
    if (len === 0) return;
    setCurrentMonitoredIndex(prev => (prev - 1 + len) % len);
  };
  const handleNextMonitored = () => {
    const len = monitoredAnnonces.length;
    if (len === 0) return;
    setCurrentMonitoredIndex(prev => (prev + 1) % len);
  };

  // 2 visibles (wrap-around)
  const visiblePigeAnnonces = useMemo(() => {
    const len = lastPigeAnnonce.length;
    if (len === 0) return [];
    if (len === 1) return [lastPigeAnnonce[0]];
    return [
      lastPigeAnnonce[currentPigeIndex % len],
      lastPigeAnnonce[(currentPigeIndex + 1) % len],
    ];
  }, [lastPigeAnnonce, currentPigeIndex]);

  const visibleMonitoredAnnonces = useMemo(() => {
    const len = monitoredAnnonces.length;
    if (len === 0) return [];
    if (len === 1) return [monitoredAnnonces[0]];
    return [
      monitoredAnnonces[currentMonitoredIndex % len],
      monitoredAnnonces[(currentMonitoredIndex + 1) % len],
    ];
  }, [monitoredAnnonces, currentMonitoredIndex]);

  const periodOptions = [
    { value: '7', label: '7 derniers jours' },
    { value: '30', label: '30 derniers jours' },
    { value: '90', label: '90 derniers jours' },
  ];

  const firstName = appUser?.profile.first_name || appUser?.Prenom || 'Bienvenue';
  const agencyName = appUser?.agency?.name || 'GetFlaire';
  const activePeriod = periodOptions.find(option => option.value === filters.period)?.label || periodOptions[0].label;
  const priorityCards = [
    {
      label: 'À traiter maintenant',
      value: kpis.toProcessReminders,
      helper: 'Relances et annonces à reprendre',
      icon: Flame,
      className: 'bg-primary-500 text-secondary-950',
    },
    {
      label: 'Rappels à venir',
      value: kpis.rappelsAFaire,
      helper: 'À sécuriser sur la période',
      icon: Calendar,
      className: 'bg-secondary-900 text-white',
    },
    {
      label: 'Surveillances actives',
      value: monitoredAnnonces.length,
      helper: 'Biens suivis en temps réel',
      icon: Eye,
      className: 'bg-white text-secondary-900',
    },
  ];

  return (
    <div ref={dashboardRef} className="space-y-7">
      <section
        className="relative overflow-hidden rounded-3xl bg-secondary-900 px-5 py-6 text-white shadow-2xl shadow-secondary-900/25 sm:px-7 lg:px-9 lg:py-8"
        data-gsap-reveal
        data-interface-version="premium-dashboard-v2"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,178,63,0.35),transparent_26rem),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.18),transparent_24rem)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-300/80 to-transparent" />

        <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.75fr] lg:items-stretch">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <div className="mb-5 inline-flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/10 backdrop-blur">
                <Sparkles className="h-4 w-4 text-primary-300" />
                <span>Nouvelle interface GetFlaire</span>
              </div>
              <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                {firstName}, pilotez votre activité immobilière sans perdre le fil.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/72 sm:text-base">
                Vue métier centralisée pour la pige, les rappels et les biens surveillés de {agencyName}.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                onClick={() => navigate('/pige')}
                className="group flex items-center justify-between rounded-2xl bg-primary-500 px-4 py-3 text-left text-sm font-semibold text-secondary-950 shadow-lg shadow-primary-500/20 transition-all hover:-translate-y-0.5 hover:bg-primary-400"
              >
                Lancer une pige
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => navigate('/surveillance')}
                className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15"
              >
                Surveiller un bien
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => navigate('/reminders')}
                className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15"
              >
                Voir les rappels
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/10 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">Période active</p>
                <p className="mt-2 text-2xl font-bold text-white">{activePeriod}</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 text-secondary-950">
                <Zap className="h-5 w-5" />
              </span>
            </div>

            <select
              value={filters.period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="mt-6 w-full rounded-2xl border-white/15 bg-white px-4 py-3 text-sm font-medium text-secondary-900 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs text-white/60">Particuliers</p>
                <p className="mt-1 text-2xl font-bold text-white">{kpiLoading ? '...' : kpis.totalAnnonces}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs text-white/60">Pros</p>
                <p className="mt-1 text-2xl font-bold text-white">{kpiLoading ? '...' : kpis.totalAnnoncesPro}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4" data-gsap-reveal>
          <p className="text-red-700">Erreur : {error}</p>
        </div>
      )}
      {Object.entries(errorBySection).length > 1 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-gsap-reveal>
          Certaines données secondaires n'ont pas répondu assez vite. Le dashboard reste utilisable.
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-gsap-reveal>
        {priorityCards.map(({ label, value, helper, icon: Icon, className }) => (
          <button
            key={label}
            onClick={() => navigate(label.includes('Surveillance') ? '/surveillance' : label.includes('Rappels') ? '/reminders' : '/pige')}
            className={`motion-safe-card flex min-h-36 items-stretch justify-between rounded-3xl border border-gray-200/70 p-5 text-left shadow-lg ${className}`}
          >
            <span className="flex flex-col justify-between">
              <span>
                <span className="text-sm font-semibold opacity-80">{label}</span>
                <span className="mt-2 block text-4xl font-bold">{kpiLoading ? '...' : value}</span>
              </span>
              <span className="text-sm opacity-70">{helper}</span>
            </span>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/10">
              <Icon className="h-6 w-6" />
            </span>
          </button>
        ))}
      </section>

      <div className="surface-panel rounded-3xl p-5 lg:p-6" data-gsap-reveal>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">Pilotage immédiat</p>
            <h2 className="mt-1 text-xl font-bold text-secondary-900">Actions rapides</h2>
          </div>
          <p className="text-sm text-secondary-500">Accès direct aux workflows du jour.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Nouvelle pige', icon: Search, to: '/pige' },
            { label: 'Surveillance', icon: Eye, to: '/surveillance' },
            { label: 'Rappel', icon: Calendar, to: '/reminders' },
            { label: 'Analytics', icon: BarChart3, to: '/analytics' },
          ].map(({ label, icon: Icon, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="motion-safe-card flex min-h-24 flex-col items-start justify-between rounded-2xl border border-gray-200 bg-white p-4 text-left hover:border-primary-300"
            >
              <Icon className="h-5 w-5 text-primary-500" />
              <span className="text-sm font-semibold text-secondary-800">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPIs - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Total annonces PRO" value={kpiLoading ? '...' : kpis.totalAnnoncesPro} icon={Home} color="warning" />
        <StatsCard title="Total annonces Particulier" value={kpiLoading ? '...' : kpis.totalAnnonces} icon={Users} color="primary" />
        <StatsCard
          title="Rappels à venir"
          value={kpiLoading ? '...' : kpis.rappelsAFaire}
          icon={Calendar}
          trend={{ value: kpis.rappelsAFaireVariation, isPositive: kpis.rappelsAFaireVariation >= 0 }}
          color="secondary"
        />
        <StatsCard
          title="À traiter"
          value={kpiLoading ? '...' : kpis.toProcessReminders}
          icon={Clock}
          trend={{ value: kpis.toProcessRemindersVariation, isPositive: kpis.toProcessRemindersVariation >= 0 }}
          color="success"
        />
      </div>

      {/* Graphique + Nouvelles annonces */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="surface-panel rounded-2xl p-6 lg:col-span-3" data-gsap-reveal>
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Activité des annonces & appels</h2>
          <EvolutionChart data={evolution} loading={chartLoading} />
        </div>

        <div className="flex flex-col space-y-6 lg:col-span-1">
          <StatsCard
            title="Nouvelles annonces PRO aujourd'hui"
            value={kpiLoading ? '...' : kpis.newPropertiesProToday}
            icon={TrendingUp}
            trend={{ value: kpis.newPropertiesProTodayVariation, isPositive: kpis.newPropertiesProTodayVariation >= 0 }}
            comparisonPeriod="vs. hier"
            color="warning"
          />
          <StatsCard
            title="Nouvelles annonces Particulier aujourd'hui"
            value={kpiLoading ? '...' : kpis.newPropertiesParticulierToday}
            icon={Users}
            trend={{ value: kpis.newPropertiesParticulierTodayVariation, isPositive: kpis.newPropertiesParticulierTodayVariation >= 0 }}
            comparisonPeriod="vs. hier"
            color="primary"
          />
        </div>
      </div>

      {/* Dernières annonces Pige & Annonces à surveiller */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dernières annonces Pige (carrousel 2 cartes) */}
        <div className="surface-panel rounded-2xl p-6" data-gsap-reveal>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-secondary-900">Dernières annonces Pige</h2>
            {lastPigeAnnonce.length > 2 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPige}
                  className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                  aria-label="Annonce précédente"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextPige}
                  className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                  aria-label="Annonce suivante"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {loadingAnnonces ? (
            <div className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : lastPigeAnnonce.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visiblePigeAnnonces.map((annonce) => (
                <PropertyCard key={annonce.id} annonce={annonce} onStatusChange={() => {}} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary-500">Aucune annonce trouvée.</p>
          )}
        </div>

        {/* Annonces à surveiller (carrousel 2 cartes) */}
        <div className="surface-panel rounded-2xl p-6" data-gsap-reveal>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-secondary-900">Annonces à surveiller</h2>
            <div className="flex items-center gap-2">
              {monitoredAnnonces.length > 0 && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Alerte
                </span>
              )}
              {monitoredAnnonces.length > 2 && (
                <>
                  <button
                    onClick={handlePrevMonitored}
                    className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                    aria-label="Annonce surveillée précédente"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNextMonitored}
                    className="p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50"
                    aria-label="Annonce surveillée suivante"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {loadingAnnonces ? (
            <div className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : monitoredAnnonces.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleMonitoredAnnonces.map((annonce) => (
                <PropertyCard key={annonce.id} annonce={annonce} onStatusChange={() => {}} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary-500">Aucune annonce surveillée pour le moment.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
