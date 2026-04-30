import React from 'react';
import { DivideIcon as LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  variation?: number;
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'warning' | 'secondary';
  loading?: boolean;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  variation,
  icon: Icon,
  color = 'primary',
  loading = false,
}) => {
  const colorClasses = {
    primary: 'bg-primary-500 text-white',
    success: 'bg-green-500 text-white',
    warning: 'bg-orange-500 text-white',
    secondary: 'bg-secondary-500 text-white',
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-20"></div>
          </div>
          <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-secondary-900 mb-2">
            {formatNumber(value)}
          </p>
          {variation !== undefined && (
            <div className="flex items-center">
              {variation >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={`text-xs font-medium ${
                variation >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {variation >= 0 ? '+' : ''}{variation}%
              </span>
              <span className="text-xs text-secondary-500 ml-1">vs. période précédente</span>
            </div>
          )}
        </div>
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default KPICard;