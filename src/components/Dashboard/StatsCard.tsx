import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'secondary';
  comparisonPeriod?: string; // 🆕 Période de comparaison personnalisable
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'primary',
  comparisonPeriod // 🆕
}) => {
  const colorClasses = {
    primary: 'bg-primary-500 text-white shadow-primary-500/20',
    success: 'bg-success-500 text-white shadow-success-500/20',
    warning: 'bg-warning-500 text-white shadow-warning-500/20',
    secondary: 'bg-secondary-700 text-white shadow-secondary-500/20',
  };

  return (
    <div className="surface-panel motion-safe-card rounded-3xl p-6 shadow-lg shadow-gray-900/5" data-gsap-reveal>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-secondary-500">{title}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-secondary-900">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? 'text-success-600' : 'text-error-600'
                }`}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              {comparisonPeriod && (
                <span className="text-xs text-secondary-500 ml-1">
                  {comparisonPeriod}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${colorClasses[color]}`}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
