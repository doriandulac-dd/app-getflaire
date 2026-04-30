import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, CreditCard, AlertTriangle, Calendar } from 'lucide-react';
import { useStripe } from '../../hooks/useStripe';
import { getProductByPriceId, formatDate, getCadenceLabel } from '../../stripe-config';

const SubscriptionBanner: React.FC = () => {
  const { subscriptionSummary, loading } = useStripe();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-primary-50 border-b border-primary-200 px-4 py-2">
        <div className="flex items-center justify-center">
          <div className="animate-pulse flex items-center space-x-2">
            <div className="h-4 w-4 bg-primary-200 rounded"></div>
            <div className="h-4 bg-primary-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscriptionSummary) {
    return (
      <div className="bg-warning-50 border-b border-warning-200 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-warning-600" />
            <span className="text-sm font-medium text-warning-800">
              Aucun abonnement actif
            </span>
          </div>
          <button
            onClick={() => navigate('/billing/upgrade')}
            className="text-sm font-medium text-warning-700 hover:text-warning-800 underline"
          >
            Choisir un plan
          </button>
        </div>
      </div>
    );
  }

  const isActive = subscriptionSummary.status === 'active';
  const isPastDue = subscriptionSummary.status === 'past_due';
  const isCanceled = subscriptionSummary.status === 'canceled';
  const isTrialing = subscriptionSummary.status === 'trialing';

  const getBannerStyle = () => {
    if (isPastDue) return 'bg-red-50 border-red-200';
    if (isCanceled) return 'bg-gray-50 border-gray-200';
    if (isTrialing) return 'bg-blue-50 border-blue-200';
    if (isActive) return 'bg-green-50 border-green-200';
    return 'bg-primary-50 border-primary-200';
  };

  const getTextColor = () => {
    if (isPastDue) return 'text-red-800';
    if (isCanceled) return 'text-gray-800';
    if (isTrialing) return 'text-blue-800';
    if (isActive) return 'text-green-800';
    return 'text-primary-800';
  };

  const getIconColor = () => {
    if (isPastDue) return 'text-red-600';
    if (isCanceled) return 'text-gray-600';
    if (isTrialing) return 'text-blue-600';
    if (isActive) return 'text-green-600';
    return 'text-primary-600';
  };

  const getStatusMessage = () => {
    const planName = subscriptionSummary.planLabel;
    const cadenceLabel = getCadenceLabel(subscriptionSummary.cadence);
    
    if (isPastDue) return `${planName} - Paiement en retard`;
    if (isCanceled) return `${planName} - Abonnement annulé`;
    if (isTrialing) return `${planName} - Période d'essai`;
    if (isActive) return `${planName} (${cadenceLabel})`;
    return `${planName} - ${subscriptionSummary.status}`;
  };

  return (
    <div className={`border-b px-4 py-2 ${getBannerStyle()}`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <Crown className={`h-4 w-4 ${getIconColor()}`} />
          <span className={`text-sm font-medium ${getTextColor()}`}>
            {getStatusMessage()}
          </span>
          {subscriptionSummary.periodEnd && (
            <span className="text-xs text-secondary-500 hidden sm:inline">
              • Prochaine facturation: {formatDate(subscriptionSummary.periodEnd)}
            </span>
          )}
        </div>
        
        <button
          onClick={() => navigate('/settings?tab=billing')}
          className={`text-sm font-medium hover:underline ${getTextColor()} flex items-center space-x-1`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Gérer</span>
        </button>
      </div>
    </div>
  );
};

export default SubscriptionBanner;