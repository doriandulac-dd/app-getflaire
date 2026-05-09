import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Filter, MapPin, Search, SlidersHorizontal, Tag, X } from 'lucide-react';
import { SurveillanceFilters } from '../../types/surveillance';
import { supabase } from '../../lib/supabase';

interface SurveillanceFiltersProps {
  filters: SurveillanceFilters;
  onFiltersChange: (filters: SurveillanceFilters) => void;
  onClearFilters: () => void;
}

type SurveillanceFilterValue = SurveillanceFilters[keyof SurveillanceFilters];

const propertyTypes = [
  { value: 'Appartement', label: 'Appartement' },
  { value: 'Maison', label: 'Maison' },
  { value: 'Terrain', label: 'Terrain' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Autre', label: 'Autre' },
];

const statusOptions = [
  { value: 'en_ligne', label: 'En ligne' },
  { value: 'hors_ligne', label: 'Hors ligne' },
  { value: 'supprimee', label: 'Supprimée' },
];

const SurveillanceFiltersComponent: React.FC<SurveillanceFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const [isOpen, setIsOpen] = useState(false);
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
      Object.values(filters).filter((value) =>
        value !== undefined && value !== '' && (Array.isArray(value) ? value.length > 0 : true)
      ).length,
    [filters]
  );

  const handleFilterChange = (key: keyof SurveillanceFilters, value: SurveillanceFilterValue) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleArrayFilterChange = (key: keyof SurveillanceFilters, value: string, checked: boolean) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = checked ? [...currentValues, value] : currentValues.filter((item) => item !== value);
    handleFilterChange(key, newValues.length > 0 ? newValues : undefined);
  };

  const handleCityAdd = (city: string) => {
    if (city.trim() && !(filters.cities || []).includes(city.trim())) {
      handleArrayFilterChange('cities', city.trim(), true);
      setCityInput('');
      setShowSuggestions(false);
    }
  };

  const handleCityInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (citySuggestions.length > 0) {
        handleCityAdd(citySuggestions[0]);
      } else if (cityInput.trim()) {
        handleCityAdd(cityInput.trim());
      }
    } else if (event.key === 'Escape') {
      setShowSuggestions(false);
      setCityInput('');
    }
  };

  return (
    <section className="rounded-3xl border border-secondary-100 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-secondary-950 p-3 text-white">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-secondary-950">Filtres de surveillance</h3>
            <p className="text-xs font-medium text-secondary-500">
              {activeFiltersCount > 0
                ? `${activeFiltersCount} filtre${activeFiltersCount > 1 ? 's' : ''} actif${activeFiltersCount > 1 ? 's' : ''}`
                : 'Affinez les annonces suivies ou le stock'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="inline-flex items-center rounded-2xl border border-secondary-200 bg-white px-3 py-2 text-sm font-bold text-secondary-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700 lg:hidden"
          >
            <Filter className="mr-2 h-4 w-4" />
            {isOpen ? 'Masquer' : 'Afficher'}
          </button>
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center rounded-2xl bg-secondary-100 px-3 py-2 text-sm font-bold text-secondary-700 transition hover:bg-secondary-200"
            >
              <X className="mr-2 h-4 w-4" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className={`${isOpen ? 'block' : 'hidden lg:block'} mt-5 space-y-5`}>
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
          <label className="relative block">
            <span className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.14em] text-secondary-500">
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Recherche
            </span>
            <input
              type="text"
              placeholder="Titre, description, ville..."
              value={filters.search || ''}
              onChange={(event) => handleFilterChange('search', event.target.value || undefined)}
              className="w-full rounded-2xl border border-secondary-200 bg-secondary-50/80 px-4 py-3 text-sm font-medium text-secondary-900 outline-none transition placeholder:text-secondary-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
            />
          </label>

          <label className="relative block">
            <span className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.14em] text-secondary-500">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Villes
            </span>
            <input
              type="text"
              placeholder="Ajouter une ville..."
              value={cityInput}
              onChange={(event) => {
                setCityInput(event.target.value);
                setShowSuggestions(event.target.value.length >= 2);
              }}
              onKeyDown={handleCityInputKeyDown}
              onFocus={() => cityInput.length >= 2 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="w-full rounded-2xl border border-secondary-200 bg-secondary-50/80 px-4 py-3 text-sm font-medium text-secondary-900 outline-none transition placeholder:text-secondary-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
            />
            {showSuggestions && citySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-44 overflow-y-auto rounded-2xl border border-secondary-100 bg-white p-1 shadow-xl">
                {citySuggestions.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => handleCityAdd(city)}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-secondary-700 transition hover:bg-primary-50 hover:text-primary-700"
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </label>

          <label className="block">
            <span className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.14em] text-secondary-500">
              <Tag className="mr-1.5 h-3.5 w-3.5" />
              Statut
            </span>
            <select
              value={filters.status || ''}
              onChange={(event) => handleFilterChange('status', event.target.value || undefined)}
              className="w-full rounded-2xl border border-secondary-200 bg-secondary-50/80 px-4 py-3 text-sm font-bold text-secondary-800 outline-none transition focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Tous les statuts</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {(filters.cities || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(filters.cities || []).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleArrayFilterChange('cities', city, false)}
                className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 ring-1 ring-primary-100 transition hover:bg-primary-100"
              >
                {city}
                <X className="ml-2 h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="flex items-center text-xs font-black uppercase tracking-[0.14em] text-secondary-500">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Type de bien
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {propertyTypes.map((type) => {
              const selected = (filters.property_types || []).includes(type.value);
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleArrayFilterChange('property_types', type.value, !selected)}
                  className={`rounded-full px-3 py-2 text-sm font-bold ring-1 transition ${
                    selected
                      ? 'bg-secondary-950 text-white ring-secondary-950'
                      : 'bg-secondary-50 text-secondary-600 ring-secondary-100 hover:bg-secondary-100'
                  }`}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-secondary-100 bg-secondary-50/70 p-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="flex w-full items-center justify-between text-left text-sm font-black text-secondary-900"
          >
            Filtres avancés
            <span className="text-xs font-bold text-primary-600">{showAdvanced ? 'Réduire' : 'Prix / surface'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <input
                type="number"
                placeholder="Prix min"
                value={filters.price_min || ''}
                onChange={(event) => handleFilterChange('price_min', event.target.value ? Number(event.target.value) : undefined)}
                className="rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
              <input
                type="number"
                placeholder="Prix max"
                value={filters.price_max || ''}
                onChange={(event) => handleFilterChange('price_max', event.target.value ? Number(event.target.value) : undefined)}
                className="rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
              <input
                type="number"
                placeholder="Surface min"
                value={filters.surface_min || ''}
                onChange={(event) => handleFilterChange('surface_min', event.target.value ? Number(event.target.value) : undefined)}
                className="rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
              <input
                type="number"
                placeholder="Surface max"
                value={filters.surface_max || ''}
                onChange={(event) => handleFilterChange('surface_max', event.target.value ? Number(event.target.value) : undefined)}
                className="rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SurveillanceFiltersComponent;
