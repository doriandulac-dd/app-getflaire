import React, { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { ChevronDown, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import { PropertyFilters as PropertyFiltersType } from '../../types';
import { supabase } from '../../lib/supabase';

interface PropertyFiltersProps {
  filters: PropertyFiltersType;
  onFiltersChange: (filters: PropertyFiltersType) => void;
  onClearFilters: () => void;
}

const propertyTypes = [
  { value: 'Appartement', label: 'Appartement' },
  { value: 'Maison', label: 'Maison' },
  { value: 'Terrain', label: 'Terrain' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Autre', label: 'Autre' },
];

const statusOptions = [
  { value: 'favorite', label: 'Favoris', accent: 'text-red-700 bg-red-50 border-red-100' },
  { value: 'to_call', label: 'A appeler', accent: 'text-orange-700 bg-orange-50 border-orange-100' },
  { value: 'reminder', label: 'A rappeler', accent: 'text-blue-700 bg-blue-50 border-blue-100' },
  { value: 'called', label: 'Appeles', accent: 'text-green-700 bg-green-50 border-green-100' },
  { value: 'hidden', label: 'Masques', accent: 'text-slate-700 bg-slate-100 border-slate-200' },
];

const PropertyFilters: React.FC<PropertyFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

        const uniqueCities = [...new Set(data?.map((item) => item.city) || [])]
          .filter((city) => city && !((filters.cities || []).includes(city)))
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

  const activeFiltersCount = useMemo(
    () =>
      Object.entries(filters).filter(
        ([key, value]) =>
          key !== 'owner_type' &&
          value !== undefined &&
          value !== '' &&
          (Array.isArray(value) ? value.length > 0 : true)
      ).length,
    [filters]
  );

  const handleFilterChange = (key: keyof PropertyFiltersType, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleArrayFilterChange = (
    key: keyof PropertyFiltersType,
    value: string,
    checked: boolean
  ) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter((v) => v !== value);

    handleFilterChange(key, newValues.length > 0 ? newValues : undefined);
  };

  const handleSingleStatusShortcut = (value: string) => {
    const active = (filters.status || []).includes(value);
    handleFilterChange('status', active ? undefined : [value]);
  };

  const handleCityAdd = (city: string) => {
    if (city.trim() && !(filters.cities || []).includes(city.trim())) {
      handleArrayFilterChange('cities', city.trim(), true);
      setCityInput('');
      setShowSuggestions(false);
    }
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

  return (
    <section className="surface-panel rounded-3xl p-4 shadow-sm sm:p-5" data-gsap-reveal>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
              Filtres et qualification
            </p>
            <h3 className="mt-2 text-xl font-semibold text-secondary-900">Affinez votre pige</h3>
            <p className="mt-1 text-sm text-secondary-500">
              La recherche rapide retrouve une annonce. Les filtres avancés affinent ensuite votre périmètre.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="hidden rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 sm:inline-flex">
                {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsMobileOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-secondary-700 shadow-sm lg:hidden"
            >
              <Filter className="h-4 w-4" />
              Filtres
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block xl:col-span-2">
            <span className="mb-2 block text-sm font-medium text-secondary-700">Recherche rapide</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
              <input
                type="text"
                placeholder="Titre, description, ville, telephone, source..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
                className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
              />
            </span>
          </label>

          <div className="relative">
            <span className="mb-2 block text-sm font-medium text-secondary-700">Ville</span>
            <input
              type="text"
              placeholder="Ajouter une ville"
              value={cityInput}
              onChange={(e) => {
                setCityInput(e.target.value);
                setShowSuggestions(e.target.value.length >= 2);
              }}
              onKeyDown={handleCityInputKeyDown}
              onFocus={() => cityInput.length >= 2 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
            />

            {showSuggestions && citySuggestions.length > 0 && (
              <div className="absolute top-full z-20 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                {citySuggestions.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => handleCityAdd(city)}
                    className="block w-full px-4 py-3 text-left text-sm text-secondary-700 hover:bg-primary-50 hover:text-primary-700"
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-secondary-700">Type de bien</span>
            <select
              value={(filters.property_types || [])[0] || ''}
              onChange={(e) =>
                handleFilterChange('property_types', e.target.value ? [e.target.value] : undefined)
              }
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
            >
              <option value="">Tous les types</option>
              {propertyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

        </div>

        {!!(filters.cities || []).length && (
          <div className="flex flex-wrap gap-2">
            {(filters.cities || []).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleArrayFilterChange('cities', city, false)}
                className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700"
              >
                {city}
                <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}

        <div className={`space-y-4 ${isMobileOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary-600" />
                <h4 className="text-sm font-semibold text-secondary-900">Statuts et priorites</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => {
                  const active = (filters.status || []).includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSingleStatusShortcut(option.value)}
                      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                        active ? option.accent : 'border-gray-200 bg-white text-secondary-600 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleFilterChange('urgent_only', filters.urgent_only ? undefined : true)}
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                    filters.urgent_only
                      ? 'border-red-100 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-white text-secondary-600 hover:bg-gray-50'
                  }`}
                >
                  Urgentes
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('has_phone', filters.has_phone ? undefined : true)}
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                    filters.has_phone
                      ? 'border-primary-100 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white text-secondary-600 hover:bg-gray-50'
                  }`}
                >
                  Avec numero
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleFilterChange('non_processed', filters.non_processed ? undefined : true)
                  }
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                    filters.non_processed
                      ? 'border-secondary-200 bg-secondary-100 text-secondary-800'
                      : 'border-gray-200 bg-white text-secondary-600 hover:bg-gray-50'
                  }`}
                >
                  Non traitees
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-secondary-900">Fourchettes rapides</h4>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-700"
                >
                  Avances
                  <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-secondary-700">Prix min</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.price_min || ''}
                    onChange={(e) =>
                      handleFilterChange('price_min', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-11 w-full rounded-2xl border border-gray-200 px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-secondary-700">Prix max</span>
                  <input
                    type="number"
                    placeholder="1 000 000"
                    value={filters.price_max || ''}
                    onChange={(e) =>
                      handleFilterChange('price_max', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-11 w-full rounded-2xl border border-gray-200 px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-secondary-700">Surface min</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.surface_min || ''}
                    onChange={(e) =>
                      handleFilterChange('surface_min', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-11 w-full rounded-2xl border border-gray-200 px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-secondary-700">Surface max</span>
                  <input
                    type="number"
                    placeholder="300"
                    value={filters.surface_max || ''}
                    onChange={(e) =>
                      handleFilterChange('surface_max', e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="h-11 w-full rounded-2xl border border-gray-200 px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                  />
                </label>
              </div>
            </div>
          </div>

          {showAdvanced && (
            <div className="grid gap-4 rounded-3xl border border-gray-200 bg-slate-50/70 p-4 lg:grid-cols-4">
              <div>
                <p className="mb-3 text-sm font-semibold text-secondary-900">Types disponibles</p>
                <div className="space-y-2">
                  {propertyTypes.map((type) => (
                    <label key={type.value} className="flex items-center gap-2 text-sm text-secondary-700">
                      <input
                        type="checkbox"
                        checked={(filters.property_types || []).includes(type.value)}
                        onChange={(e) =>
                          handleArrayFilterChange('property_types', type.value, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      {type.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-secondary-900">Localisation</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Code postal"
                    value={filters.postal_code || ''}
                    onChange={(e) => handleFilterChange('postal_code', e.target.value || undefined)}
                    className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    placeholder="Departement"
                    value={filters.department || ''}
                    onChange={(e) => handleFilterChange('department', e.target.value || undefined)}
                    className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-secondary-900">Source et date</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Source"
                    value={filters.source || ''}
                    onChange={(e) => handleFilterChange('source', e.target.value || undefined)}
                    className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={filters.date_from || ''}
                      onChange={(e) => handleFilterChange('date_from', e.target.value || undefined)}
                      className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm focus:border-primary-400 focus:ring-primary-500"
                    />
                    <input
                      type="date"
                      value={filters.date_to || ''}
                      onChange={(e) => handleFilterChange('date_to', e.target.value || undefined)}
                      className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm focus:border-primary-400 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-secondary-900">Visibilite</p>
                <label className="flex items-center gap-2 text-sm text-secondary-700">
                  <input
                    type="checkbox"
                    checked={filters.online_status === true}
                    onChange={(e) => handleFilterChange('online_status', e.target.checked ? true : undefined)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  En ligne uniquement
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm text-secondary-700">
                  <input
                    type="checkbox"
                    checked={filters.recent_only || false}
                    onChange={(e) => handleFilterChange('recent_only', e.target.checked || undefined)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Annonces recentes
                </label>
                <label className="mt-3 flex items-center gap-2 text-sm text-secondary-700">
                  <input
                    type="checkbox"
                    checked={filters.new_only || false}
                    onChange={(e) => handleFilterChange('new_only', e.target.checked || undefined)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Nouvelles annonces
                </label>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-secondary-900">Traitement</p>
                <label className="flex items-center gap-2 text-sm text-secondary-700">
                  <input
                    type="checkbox"
                    checked={filters.include_all_statuses || false}
                    onChange={(e) =>
                      handleFilterChange('include_all_statuses', e.target.checked || undefined)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Inclure statuts complets
                </label>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-secondary-900">Pieces min</p>
                <input
                  type="number"
                  placeholder="2"
                  value={filters.rooms_min || ''}
                  onChange={(e) =>
                    handleFilterChange('rooms_min', e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="h-11 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm focus:border-primary-400 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-secondary-600">
              {activeFiltersCount} filtre{activeFiltersCount > 1 ? 's' : ''} actif
              {activeFiltersCount > 1 ? 's' : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-secondary-600 hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Effacer les filtres
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PropertyFilters;
