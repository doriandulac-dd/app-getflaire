import React from 'react';
import { DivideIcon as LucideIcon, TrendingDown, TrendingUp } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number;
  variation?: number;
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'warning' | 'secondary' | 'danger';
  loading?: boolean;
  suffix?: string;
  description?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  variation,
  icon: Icon,
  color = 'primary',
  loading = false,
  suffix = '',
  description,
}) => {
  const colorClasses = {
    primary: 'from-primary-500 to-orange-500',
    success: 'from-emerald-500 to-teal-600',
    warning: 'from-amber-500 to-primary-500',
    secondary: 'from-secondary-700 to-secondary-950',
    danger: 'from-red-500 to-orange-500',
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num || 0);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-3xl border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100">
        <div className="animate-pulse">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-3 h-3 w-28 rounded bg-secondary-100" />
              <div className="mb-3 h-8 w-20 rounded bg-secondary-100" />
              <div className="h-3 w-36 rounded bg-secondary-100" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-secondary-100" />
          </div>
        </div>
      </div>
    );
  }

  const positive = (variation || 0) >= 0;

  return (
    <div className="group overflow-hidden rounded-3xl border border-white bg-white p-5 shadow-sm ring-1 ring-secondary-100 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">{title}</p>
          <p className="mt-3 text-3xl font-black text-secondary-950">
            {formatNumber(value)}
            {suffix && <span className="ml-1 text-lg text-secondary-500">{suffix}</span>}
          </p>
          {description && <p className="mt-1 text-xs font-medium text-secondary-500">{description}</p>}
        </div>
        <div className={`rounded-2xl bg-gradient-to-br ${colorClasses[color]} p-3 text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {variation !== undefined && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-secondary-50 px-3 py-2">
          {positive ? (
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
          <span className={`text-sm font-black ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
            {positive ? '+' : ''}
            {variation}%
          </span>
          <span className="text-xs font-medium text-secondary-500">vs période précédente</span>
        </div>
      )}
    </div>
  );
};

export default KPICard;
