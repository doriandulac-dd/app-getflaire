import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, CreditCard, Calendar, Crown, Home } from 'lucide-react';
import { useStripe } from '../hooks/useStripe';
import { getProductByPriceId, formatPrice, formatDate, getCadenceLabel } from '../stripe-config';

const BillingSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { subscriptionSummary, refreshData } = useStripe();
  const [loading, setLoading] = useState(true);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Refresh subscription data after successful payment
    const refreshAndSetLoading = async () => {
      await refreshData();
      setLoading(false);
    };

    // Add a delay to ensure webhook has processed
    const timer = setTimeout(refreshAndSetLoading, 3000);
    return () => clearTimeout(timer);
  }, [refreshData]);

  const currentProduct = subscriptionSummary?.items[0]?.price_id 
    ? getProductByPriceId(subscriptionSummary.items[0].price_id) 
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        {/* Success Icon */}
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-secondary-900 mb-2">
            Paiement réussi !
          </h1>
          <p className="text-secondary-600 text-lg">
            Votre abonnement GetFlaire a été activé avec succès
          </p>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Crown className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-secondary-900">Détails de votre abonnement</h3>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ) : subscriptionSummary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">Plan souscrit:</span>
                <span className="font-medium text-secondary-900">
                  {subscriptionSummary.planLabel}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">Fréquence:</span>
                <span className="font-medium text-secondary-900">
                  {getCadenceLabel(subscriptionSummary.cadence)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">Prix:</span>
                <span className="font-medium text-secondary-900">
                  {formatPrice(subscriptionSummary.price)}
                  {subscriptionSummary.cadence !== 'month' && (
                    <span className="text-xs text-secondary-500 ml-1">
                      ({getCadenceLabel(subscriptionSummary.cadence)})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-secondary-600">Prochaine facturation:</span>
                <span className="font-medium text-secondary-900">
                  {formatDate(subscriptionSummary.periodEnd)}
                </span>
              </div>

              {sessionId && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary-500">ID de session:</span>
                    <span className="font-mono text-xs text-secondary-500">
                      {sessionId.substring(0, 20)}...
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-secondary-600">Chargement des détails de l'abonnement...</p>
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-primary-900 mb-3">
            🎉 Félicitations !
          </h3>
          <ul className="space-y-2 text-sm text-primary-800">
            <li>• Votre abonnement GetFlaire est maintenant actif</li>
            <li>• Vous avez accès à toutes les fonctionnalités de votre plan</li>
            <li>• Un email de confirmation vous a été envoyé</li>
            <li>• Vous pouvez gérer votre abonnement dans les paramètres</li>
            <li>• Vos factures sont disponibles dans votre espace client</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            <Home className="h-5 w-5 mr-2" />
            Accéder au tableau de bord
            <ArrowRight className="h-5 w-5 ml-2" />
          </button>
          
          <button
            onClick={() => navigate('/settings?tab=billing')}
            className="w-full flex items-center justify-center px-4 py-2 bg-secondary-100 text-secondary-700 rounded-xl font-medium hover:bg-secondary-200 transition-colors"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Voir la facturation
          </button>
        </div>

        {/* Support */}
        <div className="text-center">
          <p className="text-sm text-secondary-500">
            Besoin d'aide ? Contactez notre support à{' '}
            <a href="mailto:support@getflaire.com" className="text-primary-600 hover:text-primary-700 font-medium">
              support@getflaire.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default BillingSuccessPage;