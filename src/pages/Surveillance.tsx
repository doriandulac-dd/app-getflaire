import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Eye,
  Grid,
  List,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { useSurveillance } from '../hooks/useSurveillance';
import { useAnnonces } from '../hooks/useProperties';
import { PropertyFilters as PropertyFiltersType, SortOption } from '../types';
import SurveillanceCard from '../components/Surveillance/SurveillanceCard';
import SurveillanceFiltersComponent from '../components/Surveillance/SurveillanceFilters';
import SurveillanceSettings from '../components/Surveillance/SurveillanceSettings';
import PropertyCard from '../components/Properties/PropertyCard';
import PropertyDetails from './PropertyDetails';
import SurfacePanel from '../components/UI/SurfacePanel';
import SegmentedTabs from '../components/UI/SegmentedTabs';
import EmptyState from '../components/UI/EmptyState';
import LoadingSkeleton from '../components/UI/LoadingSkeleton';
import { gsap } from '../lib/animations';

const Surveillance: React.FC = () => {
  const {
    surveillances,
    loading: surveillanceLoading,
    hasMore: surveillanceHasMore,
    error: surveillanceError,
    fetchSurveillances,
    loadMore: loadMoreSurveillances,
    refreshSurveillances,
  } = useSurveillance();

  const [activeTab, setActiveTab] = useState<'mes_surveillances' | 'recherche_stock'>('mes_surveillances');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAnnonceId, setSelectedAnnonceId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [urlSearch, setUrlSearch] = useState('');
  const [filters, setFilters] = useState<PropertyFiltersType>({});
  const [sort] = useState<SortOption>({ field: 'publication_date', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const pageRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    scrollContainerRef.current = document.querySelector('main');
  }, []);

  const effectiveFilters = useMemo(() => {
    if (activeTab === 'recherche_stock') {
      return { ...filters, include_all_statuses: true };
    }
    return filters;
  }, [filters, activeTab]);

  const { annonces, loading, error, hasMore, loadMore, refresh } = useAnnonces(effectiveFilters, sort);

  useEffect(() => {
    if (activeTab === 'mes_surveillances') {
      fetchSurveillances(filters, true);
    }
  }, [activeTab, filters]);

  useEffect(() => {
    if (activeTab === 'recherche_stock') {
      refresh();
    }
  }, [activeTab]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          desktop: '(min-width: 1024px)',
        },
        (context) => {
          const reduce = context.conditions?.reduce;
          const distance = context.conditions?.desktop ? 26 : 14;

          if (reduce) {
            gsap.set('[data-surveillance-intro], [data-surveillance-kpi], [data-surveillance-panel], [data-surveillance-card]', {
              autoAlpha: 1,
              y: 0,
              x: 0,
              scale: 1,
            });
            return;
          }

          const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
          tl.fromTo(
            '[data-surveillance-intro]',
            { autoAlpha: 0, y: distance },
            { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.07 }
          )
            .fromTo(
              '[data-surveillance-kpi]',
              { autoAlpha: 0, y: 18, scale: 0.97 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.48, stagger: 0.08 },
              '-=0.28'
            )
            .fromTo(
              '[data-surveillance-panel]',
              { autoAlpha: 0, y: 20 },
              { autoAlpha: 1, y: 0, duration: 0.5 },
              '-=0.18'
            )
            .fromTo(
              '[data-surveillance-card]',
              { autoAlpha: 0, y: 22, scale: 0.98 },
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.44, stagger: { each: 0.055, from: 'start' } },
              '-=0.18'
            );
        }
      );

      return () => mm.revert();
    },
    {
      scope: pageRef,
      dependencies: [activeTab, viewMode, surveillanceLoading, loading, surveillances.length, annonces.length],
      revertOnUpdate: true,
    }
  );

  const handleClearFilters = () => setFilters({});

  const handleUrlSearch = async (url: string) => {
    if (!url.trim()) return;
    setFilters({ ...filters, url_search: url.trim() });
    setActiveTab('recherche_stock');
  };

  const handleCardClick = (annonceId: string) => {
    setSelectedAnnonceId(annonceId);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setSelectedAnnonceId(null);
    setShowDetailsModal(false);
  };

  const loadWithStableScroll = (callback: () => void) => {
    if (!scrollContainerRef.current) {
      callback();
      return;
    }
    const scrollTop = scrollContainerRef.current.scrollTop;
    callback();
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    }, 0);
  };

  const activeFiltersCount = Object.values(filters).filter((value) =>
    value !== undefined && value !== '' && (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  const stats = {
    total: surveillances.length,
    modified: surveillances.filter((surveillance) => surveillance.nb_modifications > 0).length,
    changes: surveillances.reduce((sum, surveillance) => sum + surveillance.nb_modifications, 0),
    offline: surveillances.filter((surveillance) => surveillance.supprimee || !surveillance.en_ligne).length,
  };

  const visibleCount = activeTab === 'mes_surveillances' ? surveillances.length : annonces.length;
  const currentError = error || surveillanceError;

  return (
    <div ref={pageRef} className="space-y-6">
      <section
        data-surveillance-intro
        className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-secondary-950 p-6 text-white shadow-2xl shadow-secondary-900/15 lg:p-8"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,183,77,0.32),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(90,129,255,0.18),transparent_30%)]" />
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10 bg-white/5 blur-sm" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Watchlist active
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Surveillance immobilière, pensée pour agir avant les autres.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-secondary-200 sm:text-base">
              Repérez les annonces qui bougent, ouvrez l'historique, et ajoutez de nouveaux biens au suivi sans casser votre rythme commercial.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-black/10 backdrop-blur transition hover:bg-white/15"
            >
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recherche_stock')}
              className="inline-flex items-center justify-center rounded-2xl bg-primary-500 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-primary-900/30 transition hover:bg-primary-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une annonce
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Surveillances actives', value: stats.total, icon: Eye, tone: 'from-primary-500 to-orange-500' },
          { label: 'Avec modifications', value: stats.modified, icon: TrendingUp, tone: 'from-amber-500 to-primary-500' },
          { label: 'Événements détectés', value: stats.changes, icon: AlertCircle, tone: 'from-red-500 to-orange-500' },
          { label: 'Hors ligne / supprimées', value: stats.offline, icon: Activity, tone: 'from-secondary-700 to-secondary-950' },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              data-surveillance-kpi
              className="group overflow-hidden rounded-3xl border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-500">{metric.label}</p>
                  <p className="mt-3 text-3xl font-black text-secondary-950">{metric.value}</p>
                </div>
                <div className={`rounded-2xl bg-gradient-to-br ${metric.tone} p-3 text-white shadow-lg`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <SurfacePanel data-surveillance-panel className="overflow-hidden p-0">
        <div className="border-b border-secondary-100 bg-white/80 p-5 backdrop-blur lg:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <SegmentedTabs
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'mes_surveillances', label: 'Mes surveillances', count: stats.total },
                { id: 'recherche_stock', label: 'Recherche stock', count: annonces.length },
              ]}
            />

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-secondary-50 px-3 py-2 text-xs font-semibold text-secondary-600">
                {visibleCount} résultat{visibleCount > 1 ? 's' : ''} visible{visibleCount > 1 ? 's' : ''}
                {activeFiltersCount > 0 ? ` · ${activeFiltersCount} filtre${activeFiltersCount > 1 ? 's' : ''}` : ''}
              </div>

              {activeTab === 'recherche_stock' && (
                <div className="flex overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`p-2.5 transition ${viewMode === 'grid' ? 'bg-secondary-950 text-white' : 'text-secondary-500 hover:bg-secondary-50 hover:text-secondary-900'}`}
                    aria-label="Vue grille"
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`p-2.5 transition ${viewMode === 'list' ? 'bg-secondary-950 text-white' : 'text-secondary-500 hover:bg-secondary-50 hover:text-secondary-900'}`}
                    aria-label="Vue liste"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => (activeTab === 'mes_surveillances' ? refreshSurveillances(filters) : refresh())}
                disabled={activeTab === 'mes_surveillances' ? surveillanceLoading : loading}
                className="inline-flex items-center rounded-2xl border border-secondary-200 bg-white px-4 py-2.5 text-sm font-bold text-secondary-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Actualiser
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Recherche rapide par URL d'annonce</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <input
                type="url"
                value={urlSearch}
                onChange={(event) => setUrlSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleUrlSearch(urlSearch);
                }}
                placeholder="Collez une URL d'annonce pour la retrouver dans le stock..."
                className="w-full rounded-2xl border border-secondary-200 bg-secondary-50/70 py-3 pl-11 pr-4 text-sm font-medium text-secondary-900 shadow-inner outline-none transition placeholder:text-secondary-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleUrlSearch(urlSearch)}
              className="inline-flex items-center justify-center rounded-2xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-700"
            >
              Rechercher
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6 bg-gradient-to-b from-white to-secondary-50/70 p-5 lg:p-6">
          <SurveillanceFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
          />

          {currentError && (
            <div className="rounded-2xl border border-error-200 bg-error-50 p-4 text-sm font-semibold text-error-700">
              Erreur : {JSON.stringify(currentError)}
            </div>
          )}

          {activeTab === 'mes_surveillances' ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-500">Watchlist</p>
                  <h2 className="text-xl font-black text-secondary-950">Annonces surveillées</h2>
                </div>
                <p className="text-sm font-medium text-secondary-600">
                  {stats.modified > 0 ? `${stats.modified} annonce${stats.modified > 1 ? 's' : ''} à relire en priorité` : 'Aucune alerte prioritaire pour le moment'}
                </p>
              </div>

              {surveillanceLoading ? (
                <LoadingSkeleton itemClassName="h-96 rounded-3xl" />
              ) : surveillances.length === 0 ? (
                <EmptyState
                  icon={Eye}
                  title="Aucune surveillance active"
                  description="Ajoutez une annonce depuis le stock pour suivre ses changements de prix, statut ou contenu."
                  action={
                    <button
                      type="button"
                      onClick={() => setActiveTab('recherche_stock')}
                      className="inline-flex items-center rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-500/20 hover:bg-primary-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Rechercher des annonces
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                    {surveillances.map((surveillance) => (
                      <div key={surveillance.id} data-surveillance-card>
                        <SurveillanceCard
                          surveillance={surveillance}
                          onRemove={() => refreshSurveillances(filters)}
                          onCardClick={() => handleCardClick(surveillance.annonce_id)}
                        />
                      </div>
                    ))}
                  </div>

                  {surveillanceHasMore && !surveillanceLoading && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          loadWithStableScroll(loadMoreSurveillances);
                        }}
                        className="rounded-2xl bg-secondary-950 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-secondary-900/20 transition hover:bg-secondary-800"
                      >
                        Charger plus de surveillances
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary-500">Stock disponible</p>
                  <h2 className="text-xl font-black text-secondary-950">Ajouter de nouvelles annonces</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Bouton surveillance actif sur les cartes
                </div>
              </div>

              {loading ? (
                <LoadingSkeleton itemClassName="h-96 rounded-3xl" />
              ) : annonces.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Aucune annonce trouvée"
                  description="Essayez de modifier vos critères ou de lancer une recherche plus large."
                />
              ) : (
                <>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3' : 'space-y-4'}>
                    {annonces.map((annonce) => (
                      <div key={annonce.id} data-surveillance-card>
                        <PropertyCard
                          annonce={annonce}
                          variant={viewMode}
                          showSurveillanceButton
                          onStatusChange={() => {}}
                          onCardClick={() => handleCardClick(annonce.id)}
                        />
                      </div>
                    ))}
                  </div>

                  {hasMore && !loading && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          loadWithStableScroll(loadMore);
                        }}
                        className="rounded-2xl bg-secondary-950 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-secondary-900/20 transition hover:bg-secondary-800"
                      >
                        Charger plus d'annonces
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </SurfacePanel>

      <SurveillanceSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {showDetailsModal && selectedAnnonceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-950/70 p-3 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-[1.75rem] bg-white shadow-2xl">
            <PropertyDetails id={selectedAnnonceId} onClose={handleCloseDetailsModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Surveillance;
