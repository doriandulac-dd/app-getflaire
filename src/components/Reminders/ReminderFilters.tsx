import React, { useState } from 'react';
import { Filter, X, Search, Calendar } from 'lucide-react';
import { ReminderFilters } from '../../types/reminder';

interface ReminderFiltersProps {
  filters: ReminderFilters;
  onFiltersChange: (filters: ReminderFilters) => void;
  onClearFilters: () => void;
}

const ReminderFiltersComponent: React.FC<ReminderFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const typeOptions = [
    { value: 'to_process', label: 'À traiter', color: 'text-orange-600' },
    { value: 'to_call', label: 'À rappeler', color: 'text-blue-600' },
    { value: 'called', label: 'Appelé', color: 'text-green-600' },
    { value: 'rdv', label: 'RDV', color: 'text-purple-600' },
  ];

  const statusOptions = [
    { value: 'pending', label: 'À faire', color: 'text-orange-600' },
    { value: 'completed', label: 'Terminé', color: 'text-green-600' },
    { value: 'overdue', label: 'En retard', color: 'text-red-600' },
  ];

  const periodOptions = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'month', label: 'Ce mois' },
    { value: 'custom', label: 'Période personnalisée' },
  ];

  const handleFilterChange = (key: keyof ReminderFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const activeFiltersCount = Object.values(filters).filter(value => 
    value !== undefined && value !== ''
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
            placeholder="Rechercher par titre, commentaire, annonce..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Type filter */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Type de rappel
            </label>
            <select
              value={filters.type || ''}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Tous les types</option>
              {typeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Statut
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Tous les statuts</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Period filter */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Période
            </label>
            <select
              value={filters.period || ''}
              onChange={(e) => handleFilterChange('period', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Toutes les périodes</option>
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom date range */}
          {filters.period === 'custom' && (
            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Dates personnalisées
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Du"
                />
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Au"
                />
              </div>
            </div>
          )}
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

export default ReminderFiltersComponent;