import React from 'react';
import { Bell, Calendar, Clock, Eye, Phone } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ActivityItem } from '../../types/analytics';

interface ActivityTimelineProps {
  activities: ActivityItem[];
  loading?: boolean;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities, loading = false }) => {
  const getActivityMeta = (type: string) => {
    switch (type) {
      case 'appel':
        return { icon: Phone, className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
      case 'rappel':
        return { icon: Calendar, className: 'bg-primary-50 text-primary-700 ring-primary-100' };
      case 'surveillance':
        return { icon: Eye, className: 'bg-blue-50 text-blue-700 ring-blue-100' };
      case 'annonce':
        return { icon: Bell, className: 'bg-indigo-50 text-indigo-700 ring-indigo-100' };
      default:
        return { icon: Clock, className: 'bg-secondary-50 text-secondary-700 ring-secondary-100' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-2xl bg-secondary-50 p-3">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-secondary-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-secondary-100" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-secondary-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-3xl bg-secondary-50 py-10 text-center">
        <Clock className="mx-auto h-10 w-10 text-secondary-300" />
        <h3 className="mt-3 text-sm font-black text-secondary-950">Aucune activité récente</h3>
        <p className="mt-1 text-sm font-medium text-secondary-500">Vos actions apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="max-h-[440px] overflow-y-auto pr-1">
      <div className="space-y-3">
        {activities.map((activity) => {
          const meta = getActivityMeta(activity.type);
          const Icon = meta.icon;
          return (
            <div key={activity.id} className="flex items-start gap-3 rounded-2xl border border-secondary-100 bg-white p-3 shadow-sm">
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ring-1 ${meta.className}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold text-secondary-950">{activity.description}</p>
                <p className="mt-1 text-xs font-medium text-secondary-500">
                  {formatDistanceToNow(parseISO(activity.timestamp), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityTimeline;
