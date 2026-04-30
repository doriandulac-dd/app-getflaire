import React from 'react';
import { Clock, Phone, Calendar, Eye, Bell } from 'lucide-react';
import { ActivityItem } from '../../types/analytics';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ActivityTimelineProps {
  activities: ActivityItem[];
  loading?: boolean;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities, loading = false }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'appel':
        return <Phone className="h-4 w-4 text-green-600" />;
      case 'rappel':
        return <Calendar className="h-4 w-4 text-orange-600" />;
      case 'surveillance':
        return <Eye className="h-4 w-4 text-blue-600" />;
      case 'annonce':
        return <Bell className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'appel':
        return 'bg-green-100 border-green-200';
      case 'rappel':
        return 'bg-orange-100 border-orange-200';
      case 'surveillance':
        return 'bg-blue-100 border-blue-200';
      case 'annonce':
        return 'bg-purple-100 border-purple-200';
      default:
        return 'bg-gray-100 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start space-x-3 animate-pulse">
            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-secondary-900">
          Aucune activité récente
        </h3>
        <p className="mt-1 text-sm text-secondary-500">
          Vos actions apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={activity.id} className="flex items-start space-x-3">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full border-2 
              ${getActivityColor(activity.type)}
            `}>
              {getActivityIcon(activity.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-secondary-900 truncate">
                  {activity.description}
                </p>
                <span className="text-xs text-secondary-500 ml-2 flex-shrink-0">
                  {formatDistanceToNow(parseISO(activity.timestamp), { 
                    addSuffix: true, 
                    locale: fr 
                  })}
                </span>
              </div>
              
              {index < activities.length - 1 && (
                <div className="mt-3 border-l-2 border-gray-100 ml-3 h-4"></div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityTimeline;