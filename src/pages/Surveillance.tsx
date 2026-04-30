import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Eye, Search, Settings, Plus, TrendingUp, AlertCircle, Grid, List } from 'lucide-react';
import { useSurveillance } from '../hooks/useSurveillance';
import { useAnnonces } from '../hooks/useProperties';
import { PropertyFilters as PropertyFiltersType, SortOption } from '../types';
import SurveillanceCard from '../components/Surveillance/SurveillanceCard';
import SurveillanceFiltersComponent from '../components/Surveillance/SurveillanceFilters';
import SurveillanceSettings from '../components/Surveillance/SurveillanceSettings';
import PropertyCard from '../components/Properties/PropertyCard';
import PropertyDetails from './PropertyDetails';
import PageHeader from '../components/UI/PageHeader';
import MetricCard from '../components/UI/MetricCard';
import SurfacePanel from '../components/UI/SurfacePanel';
import SegmentedTabs from '../components/UI/SegmentedTabs';
import EmptyState from '../components/UI/EmptyState';
import LoadingSkeleton from '../components/UI/LoadingSkeleton';
import { useGsapReveal } from '../hooks/useGsapReveal';

const Surveillance: React.FC = () => {
  const {
    surveillances,
    loading: surveillanceLoading,
    hasMore: surveillanceHasMore,
    error: surveillanceError,
    fetchSurveillances,
    loadMore: loadMoreSurveillances,
    refreshSurveillances
  } = useSurveillance();
  const [activeTab, setActiveTab] = useState<'mes_surveillances' | 'recherche_stock'>('mes_surveillances');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAnnonceId, setSelectedAnnonceId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [filters, setFilters] = useState<PropertyFiltersType>({});
  const [sort] = useState<SortOption>({ field: 'publication_date', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Ref pour le scroll du <main>
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Attribue <main> à scrollContainerRef au montage
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

  // Gestion scroll pour loadMore (stock → GetFlaire orange)
  const handleLoadMoreWithScroll = () => {
    if (!scrollContainerRef.current) {
      loadMore();
      return;
    }
    const scrollTop = scrollContainerRef.current.scrollTop;
    loadMore();
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    }, 0);
  };

  // Idem pour surveillances si tu veux la même expérience
  const handleLoadMoreSurveillancesWithScroll = () => {
    if (!scrollContainerRef.current) {
      loadMoreSurveillances();
      return;
    }
    const scrollTop = scrollContainerRef.current.scrollTop;
    loadMoreSurveillances();
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    }, 0);
  };

  const stats = {
    total_surveillances: surveillances.length,
    avec_modifications: surveillances.filter(s => s.nb_modifications > 0).length,
    nouvelles_modifications: surveillances.reduce((sum, s) => sum + s.nb_modifications, 0),
  };
  const surveillanceRef = useGsapReveal<HTMLDivElement>(
    [activeTab, surveillanceLoading, loading, surveillances.length, annonces.length],
    {
      selector: '[data-gsap-reveal]',
      y: 16,
      stagger: 0.05,
    }
  );

  return (
    <div ref={surveillanceRef} className="space-y-6">
      <PageHeader
        eyebrow="Monitoring"
        title="Module Surveillance"
        description="Surveillez les annonces, repérez les changements de prix et gardez le contrôle sur votre stock."
        actions={
          <>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-secondary-700 shadow-sm hover:bg-gray-50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Paramètres
          </button>
          {activeTab === 'recherche_stock' && (
            <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Surveillances actives" value={stats.total_surveillances} icon={Eye} tone="primary" />
        <MetricCard title="Avec modifications" value={stats.avec_modifications} icon={TrendingUp} tone="warning" />
        <MetricCard title="Modifications détectées" value={stats.nouvelles_modifications} icon={AlertCircle} tone="danger" />
      </div>

      <SurfacePanel className="p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'mes_surveillances', label: 'Mes surveillances', count: stats.total_surveillances },
              { id: 'recherche_stock', label: 'Recherche stock' },
            ]}
          />
        </div>

          {/* Recherche par URL */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Recherche rapide par URL d'annonce
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                placeholder="Collez l'URL de l'annonce à rechercher..."
                className="flex-1 rounded-xl border-gray-200 bg-white px-3 py-2 shadow-sm focus:ring-primary-500 focus:border-primary-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUrlSearch((e.target as HTMLInputElement).value);
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = scrollContainerRef.current?.querySelector('input[type="url"]') as HTMLInputElement | null;
                  if (input) void handleUrlSearch(input.value);
                }}
                className="rounded-xl bg-primary-600 px-4 py-2 text-white shadow-sm hover:bg-primary-700"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filtres */}
          <SurveillanceFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={handleClearFilters}
          />

          {(error || surveillanceError) && (
            <div className="my-4 rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600">
              Erreur : {JSON.stringify(error || surveillanceError)}
            </div>
          )}

          {/* Contenu selon l'onglet */}
          {activeTab === 'mes_surveillances' ? (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-secondary-600">
                  {surveillances.length} surveillance{surveillances.length > 1 ? 's' : ''} active{surveillances.length > 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => refreshSurveillances(filters)}
                  disabled={surveillanceLoading}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                >
                  Actualiser
                </button>
              </div>

              {surveillanceLoading ? (
                <LoadingSkeleton itemClassName="h-96 rounded-2xl" />
              ) : surveillances.length === 0 ? (
                <EmptyState
                  icon={Eye}
                  title="Aucune surveillance active"
                  description="Commencez par ajouter des annonces à votre surveillance."
                  action={
                    <button
                      onClick={() => setActiveTab('recherche_stock')}
                      className="inline-flex items-center rounded-xl bg-primary-600 px-4 py-2 text-white shadow-sm hover:bg-primary-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Rechercher des annonces
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {surveillances.map((surveillance) => (
                      <SurveillanceCard
                        key={surveillance.id}
                        surveillance={surveillance}
                        onRemove={() => refreshSurveillances(filters)}
                        onCardClick={() => handleCardClick(surveillance.annonce_id)}
                      />
                    ))}
                  </div>

                  {/* Load more button for surveillances (scroll stable si tu veux) */}
                  {surveillanceHasMore && !surveillanceLoading && (
                    <div className="text-center py-8">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleLoadMoreSurveillancesWithScroll();
                        }}
                        className="rounded-xl bg-primary-500 px-6 py-2 font-semibold text-white shadow-sm hover:bg-primary-600"
                      >
                        Charger plus de surveillances
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-secondary-600">
                  {annonces.length} annonce{annonces.length > 1 ? 's' : ''} dans le stock
                </p>
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
                >
                  Actualiser
                </button>
              </div>

              {loading ? (
                <LoadingSkeleton itemClassName="h-96 rounded-2xl" />
              ) : annonces.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Aucune annonce trouvée"
                  description="Essayez de modifier vos critères de recherche."
                />
              ) : (
                <>
                  <div className={`
                    ${viewMode === 'grid' 
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
                      : 'space-y-4'
                    }
                  `}>
                    {annonces.map((annonce) => (
                      <PropertyCard
                        key={annonce.id}
                        annonce={annonce}
                        showSurveillanceButton={true}
                        onStatusChange={() => {}}
                        onCardClick={() => handleCardClick(annonce.id)}
                      />
                    ))}
                  </div>

                  {/* Bouton Charger plus d'annonces avec scroll stable */}
                  {hasMore && !loading && (
                    <div className="text-center py-8">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleLoadMoreWithScroll();
                        }}
                        className="rounded-xl bg-primary-500 px-6 py-2 font-semibold text-white shadow-sm hover:bg-primary-600"
                      >
                        Charger plus d'annonces
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
      </SurfacePanel>

      <SurveillanceSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Modale de détails d'annonce */}
      {showDetailsModal && selectedAnnonceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <PropertyDetails
              id={selectedAnnonceId}
              onClose={handleCloseDetailsModal}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Surveillance;
