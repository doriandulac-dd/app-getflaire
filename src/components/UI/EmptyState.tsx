import React from 'react';
import { type LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white/70 px-6 py-12 text-center ${className}`}>
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary-100 text-secondary-500">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="mt-4 text-base font-semibold text-secondary-900">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-secondary-500">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default EmptyState;
