import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import {
  ArrowUpRight,
  Flame,
  Grid,
  List,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import PropertyCard from '../components/Properties/PropertyCard';
import PropertyFilters from '../components/Properties/PropertyFilters';
import { useAnnonces } from '../hooks/useProperties';
import { PropertyFilters as PropertyFiltersType, SortOption } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useGsapReveal } from '../hooks/useGsapReveal';
import { gsap } from '../lib/animations';
import {
  clearPigeScrollState,
  getAppScrollContainer,
  readPigeScrollState,
  scrollAppTo,
  type PigeScrollState,
} from '../utils/pigeScroll';
import { supabase } from '../lib/supabase';
import { buildDepartmentScopeFilter, normalizeDepartmentCodes } from '../utils/pigeScope';

type PigeOverviewCounts = {
  urgent: number;
  withPhone: number;
  withSignals: number;
};

type OverviewSignalMode = 'price-and-movement' | 'price-only';

const defaultOverviewCounts: PigeOverviewCounts = {
  urgent: 0,
  withPhone: 0,
  withSignals: 0,
};

const isMissingModificationColumnError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? error.code : undefined;
  const message = 'message' in error ? error.message : '';
  return code === '42703' && typeof message === 'string' && message.includes('nb_modifications');
};

const Pige: React.FC = () => {
  const { appUser } = useAuth();
  const [filters, setFilters] = useState<PropertyFiltersType>({});
  const [sort, setSort] = useState<SortOption>({ field: 'publication_date', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [overviewCounts, setOverviewCounts] = useState<PigeOverviewCounts>(defaultOverviewCounts);
  const [totalAvailable, setTotalAvailable] = useState<number | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [overviewCountsError, setOverviewCountsError] = useState<string | null>(null);
  const [totalAvailableError, setTotalAvailableError] = useState<string | null>(null);
  const [overviewSignalMode, setOverviewSignalMode] = useState<OverviewSignalMode>('price-and-movement');
  const [availableSources, setAvailableSources] = useState<string[]>([]);

  const itemsPerPage = appUser?.personalization_settings?.items_per_page || 20;
  const authorizedDepartments = appUser?.departements_autorises || [];
  const hasNoAuthorizedDepartments = Boolean(appUser) && authorizedDepartments.length === 0;
  const { annonces, loading, error, hasMore, loadedCount, loadMore, refresh } = useAnnonces(filters, sort, itemsPerPage, {
    ownerType: 'Particulier',
    departments: authorizedDepartments,
    requireDepartments: true,
  });
  const pigeRef = useGsapReveal<HTMLDivElement>([loading, annonces.length], {
    selector: '[data-gsap-reveal]',
    y: 16,
    stagger: 0.045,
  });
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const [pendingScrollRestore, setPendingScrollRestore] = useState<PigeScrollState | null>(null);
  const scopedDepartments = useMemo(
    () => normalizeDepartmentCodes(authorizedDepartments),
    [authorizedDepartments]
  );

  const sortOptions = [
    { field: 'publication_date', direction: 'desc' as const, label: 'Plus récent' },
    { field: 'publication_date', direction: 'asc' as const, label: 'Plus ancien' },
    { field: 'price', direction: 'asc' as const, label: 'Prix croissant' },
    { field: 'price', direction: 'desc' as const, label: 'Prix décroissant' },
    { field: 'size', direction: 'desc' as const, label: 'Surface décroissante' },
    { field: 'city', direction: 'asc' as const, label: 'Ville A-Z' },
    { field: 'source', direction: 'asc' as const, label: 'Source A-Z' },
    { field: 'status', direction: 'asc' as const, label: 'Statuts prioritaires' },
    { field: 'non_processed', direction: 'asc' as const, label: "Non traitées d'abord" },
    { field: 'created_at', direction: 'desc' as const, label: 'Dernières ajoutées' },
  ];

  const activeFiltersCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) =>
        key !== 'owner_type' &&
        value !== undefined &&
        value !== '' &&
        (Array.isArray(value) ? value.length > 0 : true)
      ).length,
    [filters]
  );

  const metrics = useMemo(() => {
    return [
      {
        label: 'Urgentes à traiter',
        value: overviewCounts.urgent,
        helper: 'Priorités chaudes détectées',
        icon: Flame,
        accent: 'bg-primary-500 text-secondary-950',
      },
      {
        label: 'Avec numéro',
        value: overviewCounts.withPhone,
        helper: 'Contacts exploitables maintenant',
        icon: Target,
        accent: 'bg-secondary-900 text-white',
      },
      {
        label: 'Avec signaux',
        value: overviewCounts.withSignals,
        helper:
          overviewSignalMode === 'price-and-movement'
            ? 'Biens avec baisse de prix ou mouvement'
            : 'Biens avec baisse de prix detectee',
        icon: TrendingUp,
        accent: 'bg-white text-secondary-900',
      },
    ];
  }, [overviewCounts, overviewSignalMode]);

  const resultsCounterLabel = isOverviewLoading
    ? `${loadedCount} / ... annonces`
    : totalAvailableError || totalAvailable === null
      ? `${loadedCount} chargée${loadedCount > 1 ? 's' : ''}`
      : `${loadedCount} / ${totalAvailable} annonce${totalAvailable > 1 ? 's' : ''}`;

  const quickFilters = [
    {
      label: 'Urgentes',
      active: Boolean(filters.urgent_only),
      onClick: () => setFilters((prev) => ({ ...prev, urgent_only: prev.urgent_only ? undefined : true })),
    },
    {
      label: 'Avec numéro',
      active: Boolean(filters.has_phone),
      onClick: () => setFilters((prev) => ({ ...prev, has_phone: prev.has_phone ? undefined : true })),
    },
    {
      label: 'À appeler',
      active: (filters.status || []).includes('to_call'),
      onClick: () =>
        setFilters((prev) => ({
          ...prev,
          status: (prev.status || []).includes('to_call') ? undefined : ['to_call'],
        })),
    },
    {
      label: 'À rappeler',
      active: (filters.status || []).includes('reminder'),
      onClick: () =>
        setFilters((prev) => ({
          ...prev,
          status: (prev.status || []).includes('reminder') ? undefined : ['reminder'],
        })),
    },
    {
      label: 'Favoris',
      active: (filters.status || []).includes('favorite'),
      onClick: () =>
        setFilters((prev) => ({
          ...prev,
          status: (prev.status || []).includes('favorite') ? undefined : ['favorite'],
        })),
    },
  ];

  useGSAP(
    () => {
      if (!resultsRef.current) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { reduceMotion } = context.conditions as { reduceMotion: boolean };

          if (reduceMotion) {
            gsap.set(resultsRef.current, { autoAlpha: 1, y: 0 });
            return;
          }

          gsap.fromTo(
            resultsRef.current,
            { autoAlpha: 0, y: 12 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.32,
              ease: 'power2.out',
              clearProps: 'transform,opacity,visibility',
            }
          );
        }
      );

      return () => mm.revert();
    },
    { dependencies: [viewMode, annonces.length, loading], scope: resultsRef, revertOnUpdate: true }
  );

  useEffect(() => {
    const scrollState = readPigeScrollState();
    if (scrollState?.restorePending) {
      setPendingScrollRestore(scrollState);
    }
  }, []);

  const fetchPigeOverviewData = useCallback(async () => {
    if (!appUser || scopedDepartments.length === 0) {
      setOverviewCounts(defaultOverviewCounts);
      setTotalAvailable(null);
      setOverviewCountsError(null);
      setTotalAvailableError(null);
      setOverviewSignalMode('price-and-movement');
      setAvailableSources([]);
      return;
    }

    setIsOverviewLoading(true);
    setOverviewCountsError(null);
    setTotalAvailableError(null);

    const departmentFilters = buildDepartmentScopeFilter(scopedDepartments);

    try {
      let totalQuery = supabase
        .from('annonces')
        .select('id', { count: 'exact', head: true })
        .eq('owner_type', 'Particulier')
        .eq('supprimee', false)
        .neq('en_ligne', false);

      if (departmentFilters.length > 0) {
        totalQuery = totalQuery.or(departmentFilters.join(','));
      }

      const pageSize = 1000;
      let from = 0;
      let hasMorePages = true;
      let signalMode: OverviewSignalMode = 'price-and-movement';
      const rows: Array<{
        id: string;
        urgence?: boolean | null;
        urgence_detectee?: boolean | null;
        phone?: string | null;
        nb_modifications?: number | null;
        maj_prix?: boolean | null;
        source?: string | null;
      }> = [];

      while (hasMorePages) {
        let dataQuery = supabase
          .from('annonces')
          .select('id, urgence, urgence_detectee, phone, nb_modifications, maj_prix, source')
          .eq('owner_type', 'Particulier')
          .eq('supprimee', false)
          .neq('en_ligne', false)
          .range(from, from + pageSize - 1);

        if (departmentFilters.length > 0) {
          dataQuery = dataQuery.or(departmentFilters.join(','));
        }

        let dataResult = await dataQuery;
        if (dataResult.error && isMissingModificationColumnError(dataResult.error)) {
          signalMode = 'price-only';

          let fallbackQuery = supabase
            .from('annonces')
            .select('id, urgence, urgence_detectee, phone, maj_prix, source')
            .eq('owner_type', 'Particulier')
            .eq('supprimee', false)
            .neq('en_ligne', false)
            .range(from, from + pageSize - 1);

          if (departmentFilters.length > 0) {
            fallbackQuery = fallbackQuery.or(departmentFilters.join(','));
          }

          dataResult = await fallbackQuery;
        }

        if (dataResult.error) throw dataResult.error;

        const pageRows = dataResult.data || [];
        rows.push(...pageRows);
        hasMorePages = pageRows.length === pageSize;
        from += pageSize;
      }

      const totalResult = await totalQuery;
      if (totalResult.error) {
        console.error('[pige] total count failed', totalResult.error);
        setTotalAvailable(null);
        setTotalAvailableError(totalResult.error.message || 'count_failed');
      } else {
        setTotalAvailable(totalResult.count || 0);
      }

      setOverviewSignalMode(signalMode);
      setOverviewCounts({
        urgent: rows.filter((item) => item.urgence || item.urgence_detectee).length,
        withPhone: rows.filter((item) => Boolean(item.phone && item.phone.trim())).length,
        withSignals: rows.filter((item) => (item.nb_modifications || 0) > 0 || item.maj_prix).length,
      });

      if (signalMode === 'price-only') {
        setOverviewCountsError("Les mouvements d'annonce ne sont pas disponibles sur cette source pour le moment. Le KPI signaux est calcule a partir des baisses de prix.");
      }

      try {
        let sourcesQuery = supabase
          .from('annonces')
          .select('source')
          .eq('owner_type', 'Particulier')
          .eq('supprimee', false)
          .neq('en_ligne', false)
          .not('source', 'is', null)
          .order('source', { ascending: true })
          .limit(200);

        if (departmentFilters.length > 0) {
          sourcesQuery = sourcesQuery.or(departmentFilters.join(','));
        }

        const sourcesResult = await sourcesQuery;
        if (sourcesResult.error) throw sourcesResult.error;

        setAvailableSources(
          Array.from(
            new Set(
              (sourcesResult.data || [])
                .map((item) => item.source?.trim())
                .filter((source): source is string => Boolean(source))
            )
          ).sort((a, b) => a.localeCompare(b, 'fr'))
        );
      } catch (sourceError) {
        console.error('[pige] source list failed', sourceError);
        setAvailableSources([]);
      }
    } catch (error) {
      console.error('[pige] overview fetch failed', error);
      setOverviewCounts(defaultOverviewCounts);
      setTotalAvailable(null);
      setOverviewSignalMode('price-and-movement');
      setOverviewCountsError(error instanceof Error ? error.message : 'overview_failed');
      setTotalAvailableError(error instanceof Error ? error.message : 'overview_failed');
      setAvailableSources([]);
    } finally {
      setIsOverviewLoading(false);
    }
  }, [appUser, scopedDepartments]);

  useEffect(() => {
    void fetchPigeOverviewData();
  }, [fetchPigeOverviewData]);

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMore();
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = getAppScrollContainer();
      const scrollTop = scrollContainer?.scrollTop ?? document.documentElement.scrollTop;
      const clientHeight = scrollContainer?.clientHeight ?? window.innerHeight;
      const scrollHeight = scrollContainer?.scrollHeight ?? document.documentElement.offsetHeight;

      if (scrollTop + clientHeight >= scrollHeight - 1000) {
        handleLoadMore();
      }
    };

    const scrollContainer = getAppScrollContainer();
    scrollContainer?.addEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll);

    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [loading, hasMore]);

  useEffect(() => {
    if (!pendingScrollRestore || loading) return;

    if (loadedCount < pendingScrollRestore.loadedCount && hasMore) {
      loadMore();
      return;
    }

    const restoreFrame = window.requestAnimationFrame(() => {
      scrollAppTo(pendingScrollRestore.scrollTop);
      clearPigeScrollState();
      setPendingScrollRestore(null);
    });

    return () => window.cancelAnimationFrame(restoreFrame);
  }, [pendingScrollRestore, loading, loadedCount, hasMore, loadMore]);

  return (
    <div ref={pigeRef} className="space-y-6">
      <section
        className="relative overflow-hidden rounded-3xl bg-secondary-900 px-5 py-6 text-white shadow-2xl shadow-secondary-900/20 sm:px-7 lg:px-8"
        data-gsap-reveal
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_18%,rgba(255,178,63,0.34),transparent_24rem),radial-gradient(circle_at_88%_12%,rgba(59,130,246,0.18),transparent_24rem)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-300/70 to-transparent" />

        <div className="relative grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/10 backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary-300" />
              Cockpit pige immobilière
            </div>
            <h1 className="max-w-4xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.8rem]">
              Priorisez les annonces qui meritent vraiment votre prochain appel.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              Filtrez, qualifiez et traitez vos opportunites dans une interface plus nette,
              plus rapide et plus actionnable au quotidien.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {quickFilters.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    item.active
                      ? 'border-primary-300 bg-primary-400/20 text-white'
                      : 'border-white/15 bg-white/10 text-slate-200 hover:bg-white/14'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className={`rounded-3xl border border-white/10 px-4 py-4 shadow-lg shadow-black/10 backdrop-blur ${metric.accent}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                        {metric.label}
                      </p>
                      <p className="mt-3 text-3xl font-bold">{metric.value}</p>
                    </div>
                    <div className="rounded-2xl bg-black/10 p-3">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm opacity-80">{metric.helper}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="surface-panel rounded-3xl p-4 shadow-sm sm:p-5"
        data-gsap-reveal
        data-interface-version="premium-pige-v2"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
              Pilotage des resultats
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-secondary-900">Pige immobilière</h2>
              <span className="rounded-full bg-secondary-100 px-3 py-1 text-sm font-medium text-secondary-700">
                {resultsCounterLabel}
              </span>
              <span className="text-sm font-medium text-secondary-500">
                Chargées sur le total disponible en ligne dans vos départements
              </span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
                  {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif
                  {activeFiltersCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <select
              value={`${sort.field}-${sort.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-');
                setSort({ field, direction: direction as 'asc' | 'desc' });
              }}
              className="rounded-2xl border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
            >
              {sortOptions.map((option) => (
                <option key={`${option.field}-${option.direction}`} value={`${option.field}-${option.direction}`}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="flex overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-secondary-900 text-white'
                    : 'text-secondary-500 hover:bg-gray-50 hover:text-secondary-800'
                }`}
              >
                <Grid className="h-4 w-4" />
                Grille
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-secondary-900 text-white'
                    : 'text-secondary-500 hover:bg-gray-50 hover:text-secondary-800'
                }`}
              >
                <List className="h-4 w-4" />
                Liste
              </button>
            </div>

            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-100 disabled:opacity-60"
            >
              <RefreshCcw className="h-4 w-4" />
              Actualiser
            </button>
          </div>
        </div>
      </section>

      <PropertyFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={handleClearFilters}
        availableSources={availableSources}
      />

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700" data-gsap-reveal>
          <p className="font-semibold">Erreur lors du chargement</p>
          <p className="mt-1 text-sm">Erreur : {error}</p>
          <button
            onClick={refresh}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Réessayer
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {hasNoAuthorizedDepartments && !loading && !error && (
        <div className="rounded-3xl border border-primary-200 bg-primary-50 p-5 text-primary-900" data-gsap-reveal>
          <p className="font-semibold">Aucun département actif dans votre abonnement</p>
          <p className="mt-1 text-sm text-primary-800">
            Ajoutez au moins un département depuis vos paramètres ou votre abonnement pour afficher la pige immobilière.
          </p>
        </div>
      )}

      <div ref={resultsRef}>
        {annonces.length > 0 ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                : 'space-y-4'
            }
            data-gsap-reveal
          >
            {annonces.map((annonce) => (
              <PropertyCard
                key={annonce.id}
                annonce={annonce}
                variant={viewMode}
                onStatusChange={() => {}}
                listLoadedCount={loadedCount}
              />
            ))}
          </div>
        ) : (
          !loading && !hasNoAuthorizedDepartments && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white/70 px-6 py-14 text-center" data-gsap-reveal>
              <p className="text-lg font-semibold text-secondary-800">
                Aucune annonce ne correspond à ces critères.
              </p>
              <p className="mt-2 text-sm text-secondary-500">
                Élargissez vos filtres ou relancez une recherche plus ouverte.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-secondary-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-secondary-800"
              >
                Réinitialiser les filtres
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          )
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-10" data-gsap-reveal>
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-500" />
        </div>
      )}

      {hasMore && !loading && annonces.length > 0 && (
        <div className="text-center py-8" data-gsap-reveal>
          <button
            onClick={handleLoadMore}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-6 py-3 font-semibold text-white shadow-lg shadow-primary-500/20 transition hover:-translate-y-0.5 hover:bg-primary-600"
          >
            Charger plus d'annonces
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pige;
