import React, { useState, useEffect } from 'react';
import { Grid, List } from 'lucide-react';
import PropertyCard from '../components/Properties/PropertyCard';
import PropertyFilters from '../components/Properties/PropertyFilters';
import { useAnnonces } from '../hooks/useProperties';
import { PropertyFilters as PropertyFiltersType, SortOption } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useGsapReveal } from '../hooks/useGsapReveal';

const Pige: React.FC = () => {
  const { appUser } = useAuth();
  const [filters, setFilters] = useState<PropertyFiltersType>({
    owner_type: 'Particulier'
  });
  const [sort, setSort] = useState<SortOption>({ field: 'publication_date', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const itemsPerPage = appUser?.personalization_settings?.items_per_page || 20;
  const { annonces, loading, error, hasMore, loadMore, refresh } = useAnnonces(filters, sort, itemsPerPage);
  const pigeRef = useGsapReveal<HTMLDivElement>([loading, annonces.length], {
    selector: '[data-gsap-reveal]',
    y: 16,
    stagger: 0.045,
  });

  const sortOptions = [
    { field: 'publication_date', direction: 'desc' as const, label: 'Plus récent' },
    { field: 'publication_date', direction: 'asc' as const, label: 'Plus ancien' },
    { field: 'price', direction: 'asc' as const, label: 'Prix croissant' },
    { field: 'price', direction: 'desc' as const, label: 'Prix décroissant' },
    { field: 'size', direction: 'desc' as const, label: 'Surface décroissante' },
    { field: 'city', direction: 'asc' as const, label: 'Ville A-Z' },
  ];

  const handleClearFilters = () => {
    setFilters({
      owner_type: 'Particulier'
    });
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadMore();
    }
  };

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop
        >= document.documentElement.offsetHeight - 1000
      ) {
        handleLoadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore]);

  return (
    <div ref={pigeRef} className="space-y-6">
      {/* Page Header */}
      <div className="surface-panel rounded-2xl p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-gsap-reveal>
        <div>
          <div className="mb-2 inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
            Opportunités
          </div>
          <h1 className="text-3xl font-bold text-secondary-900">Pige immobilière</h1>
          <p className="text-secondary-600 mt-2">
            Parcourez, qualifiez et priorisez les annonces immobilières.
          </p>
        </div>

        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          {/* Sort dropdown */}
          <select
            value={`${sort.field}-${sort.direction}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-');
              setSort({ field, direction: direction as 'asc' | 'desc' });
            }}
            className="rounded-xl border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:ring-primary-500 focus:border-primary-500"
          >
            {sortOptions.map(option => (
              <option key={`${option.field}-${option.direction}`} value={`${option.field}-${option.direction}`}>
                {option.label}
              </option>
            ))}
          </select>

          {/* View mode toggle */}
          <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <PropertyFilters
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Results count */}
      <div className="surface-panel rounded-xl p-4 flex items-center justify-between" data-gsap-reveal>
        <div className="flex items-center space-x-4">
          <p className="text-sm text-secondary-600">
            {annonces.length} annonce{annonces.length > 1 ? 's' : ''} trouvée{annonces.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <button
          onClick={refresh}
          disabled={loading}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
        >
          Actualiser
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-error-50 border border-error-200 rounded-md p-4">
          <p className="text-error-700">Erreur : {error}</p>
          <button
            onClick={refresh}
            className="mt-2 text-sm text-error-600 hover:text-error-700 font-medium"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Properties grid */}
      {annonces.length > 0 ? (
        <div className={`
          ${viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
            : 'space-y-4'
          }
        `} data-gsap-reveal>
          {annonces.map((annonce) => (
            <PropertyCard
              key={annonce.id}
              annonce={annonce}
              onStatusChange={(annonceId, status) => {
                // Handle status change if needed
              }}
            />
          ))}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-12">
            <p className="text-secondary-500">Aucune annonce trouvée avec ces critères.</p>
            <button
              onClick={handleClearFilters}
              className="mt-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              Effacer les filtres
            </button>
          </div>
        )
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      )}

      {/* Load more button (fallback) */}
      {hasMore && !loading && (
        <div className="text-center py-8">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
          >
            Charger plus d'annonces
          </button>
        </div>
      )}
    </div>
  );
};

export default Pige;
