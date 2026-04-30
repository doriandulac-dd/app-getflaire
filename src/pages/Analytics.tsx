import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Phone, 
  Calendar, 
  Bell,
  Download,
  Search,
  Home,
  Users,
  Clock,
  CheckCircle,
  Heart,
  Eye
} from 'lucide-react';
import { useAnalytics } from '../hooks/useAnalytics';
import { AnalyticsFilters } from '../types/analytics';
import KPICard from '../components/Analytics/KPICard';
import EvolutionChart from '../components/Analytics/EvolutionChart';
import DonutChart from '../components/Analytics/DonutChart';
import ActivityTimeline from '../components/Analytics/ActivityTimeline';
import CityAutocomplete from '../components/Analytics/CityAutocomplete';

const Analytics: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    period: '7',
    city: undefined,
    startDate: undefined,
    endDate: undefined,
  });

  const {
    kpis,
    evolution,
    propertyTypesPro,
    propertyTypesParticulier,
    statusDistribution,
    recentActivity,
    loading,
    error,
    exportData
  } = useAnalytics(filters);

  const handlePeriodChange = (period: string) => {
    if (period === 'custom') {
      setFilters(prev => ({ ...prev, period: 'custom' }));
    } else {
      setFilters(prev => ({ 
        ...prev, 
        period,
        startDate: undefined,
        endDate: undefined
      }));
    }
  };

  const handleCityChange = (city: string | undefined) => {
    setFilters(prev => ({ ...prev, city }));
  };

  const handleDateRangeChange = (startDate: string, endDate: string) => {
    setFilters(prev => ({ ...prev, startDate, endDate }));
  };

  const handleExport = async () => {
    try {
      await exportData();
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
    }
  };

  const periodOptions = [
    { value: '7', label: '7 derniers jours' },
    { value: '30', label: '30 derniers jours' },
    { value: '90', label: '90 derniers jours' },
    { value: 'custom', label: 'Période personnalisée' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">Analytics</h1>
          <p className="text-secondary-600 mt-1">
            Analysez vos performances immobilières en temps réel
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 mt-4 lg:mt-0">
          {/* City Filter */}
          <div className="w-full sm:w-64">
            <CityAutocomplete
              value={filters.city || ''}
              onChange={handleCityChange}
              placeholder="Filtrer par ville..."
            />
          </div>

          {/* Period Filter */}
          <select
            value={filters.period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            {periodOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Custom Date Range */}
          {filters.period === 'custom' && (
            <div className="flex space-x-2">
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}

          {/* Export Button */}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Erreur : {error}</p>
        </div>
      )}

      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total annonces Particulier"
          value={kpis.totalAnnonces}
          variation={kpis.totalAnnoncesVariation}
          icon={Home}
          color="primary"
          loading={loading}
        />
        <KPICard
          title="Appels passés"
          value={kpis.appelsPasses}
          variation={kpis.appelsPassesVariation}
          icon={Phone}
          color="success"
          loading={loading}
        />
        <KPICard
          title="Rappels à faire"
          value={kpis.rappelsAFaire}
          variation={kpis.rappelsAFaireVariation}
          icon={Calendar}
          color="warning"
          loading={loading}
        />
        <KPICard
          title="Surveillances actives"
          value={kpis.surveillancesActives}
          variation={kpis.surveillancesActivesVariation}
          icon={Eye}
          color="secondary"
          loading={loading}
        />
      </div>

      {/* Evolution Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">
          Évolution des annonces et appels
        </h2>
        <EvolutionChart data={evolution} loading={loading} />
      </div>

      {/* Donut Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">
            Répartition type de bien - Professionnels
          </h2>
          <DonutChart data={propertyTypesPro} loading={loading} />
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">
            Répartition type de bien - Particuliers
          </h2>
          <DonutChart data={propertyTypesParticulier} loading={loading} />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">
            Activité récente
          </h2>
          <ActivityTimeline activities={recentActivity} loading={loading} />
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">
            Statuts des annonces
          </h2>
          <DonutChart data={statusDistribution} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default Analytics;