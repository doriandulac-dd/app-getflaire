import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle, Clock, Filter, Phone, Search, SlidersHorizontal, Target, X } from 'lucide-react';
import { ReminderFilters } from '../../types/reminder';

interface ReminderFiltersProps {
  filters: ReminderFilters;
  onFiltersChange: (filters: ReminderFilters) => void;
  onClearFilters: () => void;
}

type ReminderFilterValue = ReminderFilters[keyof ReminderFilters];

const typeOptions = [
  { value: 'to_process', label: 'À traiter', icon: Target },
  { value: 'to_call', label: 'À rappeler', icon: Phone },
  { value: 'called', label: 'Appelé', icon: CheckCircle },
  { value: 'rdv', label: 'RDV', icon: Calendar },
] as const;

const statusOptions = [
  { value: 'pending', label: 'À faire' },
  { value: 'completed', label: 'Terminé' },
  { value: 'overdue', label: 'En retard' },
] as const;

const periodOptions = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'custom', label: 'Période personnalisée' },
] as const;

const ReminderFiltersComponent: React.FC<ReminderFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const activeFiltersCount = useMemo(
    () => Object.values(filters).filter((value) => value !== undefined && value !== '').length,
    [filters]
  );

  const handleFilterChange = (key: keyof ReminderFilters, value: ReminderFilterValue) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <section className="rounded-3xl border border-secondary-100 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-secondary-950 p-3 text-white">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-secondary-950">Filtres de relance</h3>
            <p className="text-xs font-medium text-secondary-500">
              {activeFiltersCount > 0
                ? `${activeFiltersCount} filtre${activeFiltersCount > 1 ? 's' : ''} actif${activeFiltersCount > 1 ? 's' : ''}`
                : 'Recherche, statut, période et type de rappel'}
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
        <label className="relative block">
          <span className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.14em] text-secondary-500">
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Recherche
          </span>
          <input
            type="text"
            placeholder="Titre, commentaire, annonce, ville..."
            value={filters.search || ''}
            onChange={(event) => handleFilterChange('search', event.target.value)}
            className="w-full rounded-2xl border border-secondary-200 bg-secondary-50/80 px-4 py-3 text-sm font-medium text-secondary-900 outline-none transition placeholder:text-secondary-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
          />
        </label>

        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-500">Type de rappel</p>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {typeOptions.map((option) => {
              const selected = filters.type === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFilterChange('type', selected ? undefined : option.value)}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold ring-1 transition ${
                    selected
                      ? 'bg-secondary-950 text-white ring-secondary-950'
                      : 'bg-secondary-50 text-secondary-600 ring-secondary-100 hover:bg-secondary-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-secondary-500">Statut</p>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const selected = filters.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleFilterChange('status', selected ? undefined : option.value)}
                    className={`rounded-full px-3 py-2 text-sm font-bold ring-1 transition ${
                      selected
                        ? 'bg-primary-600 text-white ring-primary-600'
                        : 'bg-primary-50 text-primary-700 ring-primary-100 hover:bg-primary-100'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 flex items-center text-xs font-black uppercase tracking-[0.14em] text-secondary-500">
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Période
            </p>
            <div className="flex flex-wrap gap-2">
              {periodOptions.map((option) => {
                const selected = filters.period === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleFilterChange('period', selected ? undefined : option.value)}
                    className={`rounded-full px-3 py-2 text-sm font-bold ring-1 transition ${
                      selected
                        ? 'bg-secondary-950 text-white ring-secondary-950'
                        : 'bg-secondary-50 text-secondary-600 ring-secondary-100 hover:bg-secondary-100'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {filters.period === 'custom' && (
          <div className="grid gap-3 rounded-2xl border border-secondary-100 bg-secondary-50/70 p-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-secondary-500">Du</span>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(event) => handleFilterChange('date_from', event.target.value)}
                className="w-full rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-secondary-500">Au</span>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(event) => handleFilterChange('date_to', event.target.value)}
                className="w-full rounded-2xl border border-secondary-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
              />
            </label>
          </div>
        )}
      </div>
    </section>
  );
};

export default ReminderFiltersComponent;
