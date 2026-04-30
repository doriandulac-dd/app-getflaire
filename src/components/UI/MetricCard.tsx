import React from 'react';
import { type LucideIcon } from 'lucide-react';

type MetricTone = 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

type MetricCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  tone?: MetricTone;
  description?: string;
};

const toneClasses: Record<MetricTone, string> = {
  primary: 'bg-primary-500 text-white',
  success: 'bg-success-500 text-white',
  warning: 'bg-warning-500 text-white',
  danger: 'bg-error-500 text-white',
  secondary: 'bg-secondary-800 text-white',
};

const valueClasses: Record<MetricTone, string> = {
  primary: 'text-primary-700',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger: 'text-error-600',
  secondary: 'text-secondary-900',
};

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  tone = 'primary',
  description,
}) => (
  <div className="surface-panel motion-safe-card rounded-2xl p-5" data-gsap-reveal>
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-secondary-500">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${valueClasses[tone]}`}>{value}</p>
        {description && <p className="mt-1 text-xs text-secondary-500">{description}</p>}
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg ${toneClasses[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </div>
);

export default MetricCard;
