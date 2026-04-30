import React, { useState } from 'react';
import { useEffect } from 'react';
import { Filter, X, Search } from 'lucide-react';
import { PropertyFilters as PropertyFiltersType } from '../../types';
import { supabase } from '../../lib/supabase';

interface PropertyFiltersProps {
  filters: PropertyFiltersType;
  onFiltersChange: (filters: PropertyFiltersType) => void;
  onClearFilters: () => void;
}

const PropertyFilters: React.FC<PropertyFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const propertyTypes = [
    { value: 'Appartement', label: 'Appartement' },
    { value: 'Maison', label: 'Maison' },
    { value: 'Terrain', label: 'Terrain' },
    { value: 'Commercial', label: 'Commercial' },
    { value: 'Autre', label: 'Autre' },
  ];

  // Fetch city suggestions based on input
  useEffect(() => {
    const fetchCitySuggestions = async () => {
      if (cityInput.length < 2) {
        setCitySuggestions([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('annonces')
          .select('city')
          .ilike('city', `%${cityInput}%`)
          .not('city', 'is', null)
          .limit(10);

        if (error) throw error;

        // Get unique cities and filter out already selected ones
        const uniqueCities = [...new Set(data?.map(item => item.city) || [])]
          .filter(city => city && !((filters.cities || []).includes(city)))
          .sort();

        setCitySuggestions(uniqueCities);
      } catch (error) {
        console.error('Error fetching city suggestions:', error);
        setCitySuggestions([]);
      }
    };

    const debounceTimer = setTimeout(fetchCitySuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [cityInput, filters.cities]);

  const handleFilterChange = (key: keyof PropertyFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleArrayFilterChange = (key: keyof PropertyFiltersType, value: string, checked: boolean) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    handleFilterChange(key, newValues.length > 0 ? newValues : undefined);
  };

  const handleCityAdd = (city: string) => {
    if (city.trim() && !(filters.cities || []).includes(city.trim())) {
      handleArrayFilterChange('cities', city.trim(), true);
      setCityInput('');
      setShowSuggestions(false);
    }
  };

  const handleCityInputChange = (value: string) => {
    setCityInput(value);
    setShowSuggestions(value.length >= 2);
  };

  const handleCityInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (citySuggestions.length > 0) {
        handleCityAdd(citySuggestions[0]);
      } else if (cityInput.trim()) {
        handleCityAdd(cityInput.trim());
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setCityInput('');
    }
  };

  const activeFiltersCount = Object.values(filters).filter(value => 
    value !== undefined && value !== '' && 
    (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      {/* Mobile toggle */}
      <div className="flex items-center justify-between lg:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 text-secondary-700 font-medium"
        >
          <Filter className="h-5 w-5" />
          <span>Filtres</span>
          {activeFiltersCount > 0 && (
            <span className="bg-primary-500 text-white rounded-full px-2 py-1 text-xs">
              {activeFiltersCount}
            </span>
          )}
        </button>
        
        {activeFiltersCount > 0 && (
          <button
            onClick={onClearFilters}
            className="text-sm text-secondary-500 hover:text-secondary-700"
          >
            Effacer
          </button>
        )}
      </div>

      {/* Filters content */}
      <div className={`space-y-4 ${isOpen ? 'block' : 'hidden lg:block'} ${isOpen ? 'mt-4' : ''}`}>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher"
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex flex-row flex-nowrap gap-4 overflow-x-auto pb-2">
          {/* Property types */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Type de bien
            </label>
            <div className="space-y-2">
              {propertyTypes.map(type => (
                <label key={type.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={(filters.property_types || []).includes(type.value)}
                    onChange={(e) => handleArrayFilterChange('property_types', type.value, e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-secondary-700">{type.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Cities */}
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Villes
            </label>
            <div className="space-y-2 relative">
              <input
                type="text"
                placeholder="Ajouter une ville..."
                value={cityInput}
                onChange={(e) => handleCityInputChange(e.target.value)}
                onKeyDown={handleCityInputKeyDown}
                onFocus={() => cityInput.length >= 2 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              />
              
              {/* Suggestions dropdown */}
              {showSuggestions && citySuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {citySuggestions.map((city, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleCityAdd(city)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 focus:bg-primary-50 focus:text-primary-700 focus:outline-none"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="max-h-32 overflow-y-auto space-y-1">
                {(filters.cities || []).map(city => (
                  <div key={city} className="flex items-center justify-between bg-primary-50 px-2 py-1 rounded text-sm">
                    <span className="text-primary-700">{city}</span>
                    <button
                      onClick={() => handleArrayFilterChange('cities', city, false)}
                      className="text-primary-600 hover:text-primary-800 ml-2"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Actions
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.status || []).includes('favorite')}
                  onChange={(e) => handleArrayFilterChange('status', 'favorite', e.target.checked)}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-red-700 font-medium">Favoris</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.status || []).includes('to_call')}
                  onChange={(e) => handleArrayFilterChange('status', 'to_call', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-blue-700 font-medium">À rappeler</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.status || []).includes('called')}
                  onChange={(e) => handleArrayFilterChange('status', 'called', e.target.checked)}
                  className="h-4 w-4 text-success-600 focus:ring-success-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-success-700 font-medium">Appelé</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={(filters.status || []).includes('hidden')}
                  onChange={(e) => handleArrayFilterChange('status', 'hidden', e.target.checked)}
                  className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 font-medium">Masqué</span>
              </label>
            </div>
          </div>

          {/* Prix */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Prix (€)
            </label>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.price_min || ''}
                onChange={(e) => handleFilterChange('price_min', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.price_max || ''}
                onChange={(e) => handleFilterChange('price_max', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Surface */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Surface (m²)
            </label>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.surface_min || ''}
                onChange={(e) => handleFilterChange('surface_min', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.surface_max || ''}
                onChange={(e) => handleFilterChange('surface_max', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Urgence */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Urgence
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.urgent_only || false}
                onChange={(e) => handleFilterChange('urgent_only', e.target.checked || undefined)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-red-700 font-medium">Annonces urgentes uniquement</span>
            </label>
          </div>

          {/* Annonces avec numéro */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Annonces avec numéro
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.has_phone || false}
                onChange={(e) => handleFilterChange('has_phone', e.target.checked || undefined)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-secondary-700 font-medium">Avec numéro de téléphone</span>
            </label>
          </div>

          {/* Annonces non-traitées */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Statut de traitement
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.non_processed || false}
                onChange={(e) => handleFilterChange('non_processed', e.target.checked || undefined)}
                className="h-4 w-4 text-secondary-600 focus:ring-secondary-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-secondary-700 font-medium">Annonces non-traitées uniquement</span>
            </label>
          </div>
        </div>


        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-secondary-600">
              {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif{activeFiltersCount > 1 ? 's' : ''}
            </span>
          </div>
          
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="flex items-center space-x-1 text-sm text-secondary-500 hover:text-secondary-700"
            >
              <X className="h-4 w-4" />
              <span>Effacer les filtres</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyFilters;