import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const Pige: React.FC = () => {
  const { appUser } = useAuth();
  const [filters, setFilters] = useState<PropertyFiltersType>({});
  const [sort, setSort] = useState<SortOption>({ field: 'publication_date', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const itemsPerPage = appUser?.personalization_settings?.items_per_page || 20;
  const authorizedDepartments = appUser?.departements_autorises || [];
  const hasNoAuthorizedDepartments = Boolean(appUser) && authorizedDepartments.length === 0;
  const { annonces, loading, error, hasMore, totalCount, loadedCount, loadMore, refresh } = useAnnonces(filters, sort, itemsPerPage, {
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

  const sortOptions = [
    { field: 'publication_date', direction: 'desc' as const, label: 'Plus recent' },
    { field: 'publication_date', direction: 'asc' as const, label: 'Plus ancien' },
    { field: 'price', direction: 'asc' as const, label: 'Prix croissant' },
    { field: 'price', direction: 'desc' as const, label: 'Prix decroissant' },
    { field: 'size', direction: 'desc' as const, label: 'Surface decroissante' },
    { field: 'city', direction: 'asc' as const, label: 'Ville A-Z' },
    { field: 'source', direction: 'asc' as const, label: 'Source A-Z' },
    { field: 'status', direction: 'asc' as const, label: 'Statuts prioritaires' },
    { field: 'non_processed', direction: 'asc' as const, label: 'Non traitees d abord' },
    { field: 'created_at', direction: 'desc' as const, label: 'Dernieres ajoutees' },
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
    const urgent = annonces.filter((annonce) => annonce.urgence || annonce.urgence_detectee).length;
    const withPhone = annonces.filter((annonce) => Boolean(annonce.phone)).length;
    const withChanges = annonces.filter((annonce) => (annonce.nb_modifications || 0) > 0).length;

    return [
      {
        label: 'Urgentes a traiter',
        value: urgent,
        helper: 'Priorites chaudes detectees',
        icon: Flame,
        accent: 'bg-primary-500 text-secondary-950',
      },
      {
        label: 'Avec numero',
        value: withPhone,
        helper: 'Contacts exploitables maintenant',
        icon: Target,
        accent: 'bg-secondary-900 text-white',
      },
      {
        label: 'Avec signaux',
        value: withChanges,
        helper: 'Biens avec modifications ou mouvement',
        icon: TrendingUp,
        accent: 'bg-white text-secondary-900',
      },
    ];
  }, [annonces]);

  const quickFilters = [
    {
      label: 'Urgentes',
      active: Boolean(filters.urgent_only),
      onClick: () => setFilters((prev) => ({ ...prev, urgent_only: prev.urgent_only ? undefined : true })),
    },
    {
      label: 'Avec numero',
      active: Boolean(filters.has_phone),
      onClick: () => setFilters((prev) => ({ ...prev, has_phone: prev.has_phone ? undefined : true })),
    },
    {
      label: 'A appeler',
      active: (filters.status || []).includes('to_call'),
      onClick: () =>
        setFilters((prev) => ({
          ...prev,
          status: (prev.status || []).includes('to_call') ? undefined : ['to_call'],
        })),
    },
    {
      label: 'A rappeler',
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
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        handleLoadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore]);

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
              Cockpit pige immobiliere
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
              <h2 className="text-2xl font-bold text-secondary-900">Pige immobiliere</h2>
              <span className="rounded-full bg-secondary-100 px-3 py-1 text-sm font-medium text-secondary-700">
                {totalCount} annonce{totalCount > 1 ? 's' : ''}
              </span>
              {loadedCount > 0 && loadedCount < totalCount && (
                <span className="text-sm font-medium text-secondary-500">
                  {loadedCount} affichee{loadedCount > 1 ? 's' : ''} sur {totalCount}
                </span>
              )}
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
      />

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700" data-gsap-reveal>
          <p className="font-semibold">Erreur lors du chargement</p>
          <p className="mt-1 text-sm">Erreur : {error}</p>
          <button
            onClick={refresh}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            Reessayer
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {hasNoAuthorizedDepartments && !loading && !error && (
        <div className="rounded-3xl border border-primary-200 bg-primary-50 p-5 text-primary-900" data-gsap-reveal>
          <p className="font-semibold">Aucun departement actif dans votre abonnement</p>
          <p className="mt-1 text-sm text-primary-800">
            Ajoutez au moins un departement depuis vos parametres ou votre abonnement pour afficher la pige immobiliere.
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
              />
            ))}
          </div>
        ) : (
          !loading && !hasNoAuthorizedDepartments && (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white/70 px-6 py-14 text-center" data-gsap-reveal>
              <p className="text-lg font-semibold text-secondary-800">
                Aucune annonce ne correspond a ces criteres.
              </p>
              <p className="mt-2 text-sm text-secondary-500">
                Elargissez vos filtres ou relancez une recherche plus ouverte.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-secondary-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-secondary-800"
              >
                Reinitialiser les filtres
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
