import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CreditCard, 
  ExternalLink, 
  Download, 
  RefreshCw,
  Crown,
  Calendar,
  ArrowUpRight,
  Plus
} from 'lucide-react';
import { useStripe } from '../hooks/useStripe';
import { formatPrice, formatDate, getStatusColor, getStatusLabel, getInvoiceStatusColor, getInvoiceStatusLabel, getCadenceLabel } from '../stripe-config';
import BillingInfoForm from '../components/Billing/BillingInfoForm';
import PageHeader from '../components/UI/PageHeader';
import SurfacePanel from '../components/UI/SurfacePanel';
import EmptyState from '../components/UI/EmptyState';
import LoadingSkeleton from '../components/UI/LoadingSkeleton';
import { useGsapReveal } from '../hooks/useGsapReveal';

const BillingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    subscriptionSummary, 
    paymentMethods, 
    invoices, 
    loading, 
    error,
    setAsDefaultPaymentMethod,
    detachPaymentMethod,
    openBillingPortal,
    refreshData
  } = useStripe();

  const billingRef = useGsapReveal<HTMLDivElement>([loading, invoices.length, paymentMethods.length], {
    selector: '[data-gsap-reveal]',
    y: 16,
    stagger: 0.05,
  });

  useEffect(() => {
    // Check for success/cancel status from URL params
    const status = searchParams.get('status');
    
    if (status === 'success') {
      // Refresh data after successful payment
      setTimeout(() => {
        refreshData();
      }, 2000);
    }
  }, [refreshData]);

  const handleSetDefault = async (paymentMethodId: string) => {
    await setAsDefaultPaymentMethod(paymentMethodId);
  };

  const handleDetach = async (paymentMethodId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette méthode de paiement ?')) {
      await detachPaymentMethod(paymentMethodId);
    }
  };

  const handleOpenPortal = async () => {
    try {
      await openBillingPortal();
    } catch {
      // Error handling is done in the hook
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <LoadingSkeleton count={3} className="space-y-6" itemClassName="h-32 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Erreur de chargement</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={refreshData}
            className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={billingRef} className="mx-auto max-w-5xl space-y-8">
      {/* Page Header */}
      <PageHeader
        eyebrow="Abonnement"
        title="Facturation & Abonnements"
        description="Gérez votre abonnement GetFlaire, vos moyens de paiement et votre historique de facturation."
        actions={
          <button
            onClick={refreshData}
            disabled={loading}
            className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-secondary-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </button>
        }
      />

      {/* Current Subscription */}
      <SurfacePanel className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-3">
              <Crown className="h-6 w-6 text-primary-600" />
              <h2 className="text-xl font-semibold text-secondary-900">Abonnement actuel</h2>
            </div>
            
            {subscriptionSummary ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-lg text-secondary-900">
                    {subscriptionSummary.planLabel}
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscriptionSummary.status)}`}>
                    {getStatusLabel(subscriptionSummary.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-secondary-600">Fréquence:</span>
                    <div className="font-medium text-secondary-900">
                      {getCadenceLabel(subscriptionSummary.cadence)}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-secondary-600">Prix:</span>
                    <div className="font-medium text-secondary-900">
                      {formatPrice(subscriptionSummary.price)}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-secondary-600">Prochaine facturation:</span>
                    <div className="font-medium text-secondary-900">
                      {formatDate(subscriptionSummary.periodEnd)}
                    </div>
                  </div>
                </div>

                {/* Subscription Items */}
                {subscriptionSummary.items.length > 1 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-secondary-700 mb-2">Inclus dans votre abonnement :</h4>
                    <div className="space-y-1">
                      {subscriptionSummary.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-secondary-600">
                            {item.lookup_key} {item.quantity > 1 && `(×${item.quantity})`}
                          </span>
                          <span className="font-medium text-secondary-900">
                            {formatPrice(item.unit_amount * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={Crown}
                title="Aucun abonnement actif"
                description="Choisissez un plan GetFlaire pour accéder à toutes nos fonctionnalités."
                action={
                  <button
                    onClick={() => navigate('/billing/upgrade')}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Choisir un plan
                  </button>
                }
              />
            )}
          </div>
          
          {subscriptionSummary && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/billing/upgrade')}
                className="px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 transition-colors font-medium"
              >
                Modifier le plan
              </button>
              <button
                onClick={handleOpenPortal}
                className="px-4 py-2 rounded-xl border border-gray-300 text-secondary-700 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4 inline mr-1" />
                Portail Stripe
              </button>
            </div>
          )}
        </div>
      </SurfacePanel>

      {/* Payment Methods */}
      <SurfacePanel className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-secondary-600" />
            <h3 className="text-lg font-semibold text-secondary-900">Méthodes de paiement</h3>
          </div>
          <button
            onClick={handleOpenPortal}
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            + Ajouter une carte
          </button>
        </div>
        
        <div className="space-y-3">
          {paymentMethods.length > 0 ? (
            paymentMethods.map(pm => (
              <div key={pm.id} className="flex items-center justify-between border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center space-x-3">
                  <CreditCard className="h-5 w-5 text-secondary-500" />
                  <div>
                    <div className="font-medium text-secondary-900">
                      {pm.brand.toUpperCase()} •••• {pm.last4}
                      {pm.is_default && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Par défaut
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-secondary-500">
                      Expire {pm.exp_month.toString().padStart(2, '0')}/{pm.exp_year}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {!pm.is_default && (
                    <button
                      onClick={() => handleSetDefault(pm.id)}
                      className="text-sm text-primary-600 hover:text-primary-700 underline"
                    >
                      Définir par défaut
                    </button>
                  )}
                  <button
                    onClick={() => handleDetach(pm.id)}
                    className="text-sm text-red-600 hover:text-red-700 underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={CreditCard}
              title="Aucune méthode de paiement"
              description="Ajoutez une carte pour gérer vos paiements automatiquement."
              action={
                <button
                  onClick={handleOpenPortal}
                  className="font-semibold text-primary-600 hover:text-primary-700"
                >
                  Ajouter une carte de crédit
                </button>
              }
            />
          )}
        </div>
      </SurfacePanel>

      {/* Billing History */}
      <SurfacePanel className="p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Calendar className="h-5 w-5 text-secondary-600" />
          <h3 className="text-lg font-semibold text-secondary-900">Historique de facturation</h3>
        </div>
        
        <div className="space-y-3">
          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Intl.DateTimeFormat('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(invoice.created * 1000))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatPrice(invoice.amount_paid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getInvoiceStatusColor(invoice.status)}`}>
                          {getInvoiceStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          {invoice.hosted_invoice_url && (
                            <a
                              href={invoice.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 flex items-center"
                              title="Voir la facture"
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Voir
                            </a>
                          )}
                          {invoice.invoice_pdf && (
                            <a
                              href={invoice.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-secondary-600 hover:text-secondary-700 flex items-center"
                              title="Télécharger le PDF"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="Aucune facture"
              description="Vos factures apparaîtront ici après votre premier paiement."
            />
          )}
        </div>
      </SurfacePanel>

      {/* Billing Information */}
      <BillingInfoForm />

      {/* Quick Actions */}
      <SurfacePanel className="p-6">
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Actions rapides</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/billing/upgrade')}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all group"
          >
            <div className="flex items-center space-x-3">
              <Crown className="h-6 w-6 text-primary-600" />
              <div className="text-left">
                <div className="font-medium text-secondary-900">
                  {subscriptionSummary ? 'Modifier mon plan' : 'Choisir un plan'}
                </div>
                <div className="text-sm text-secondary-600">
                  {subscriptionSummary ? 'Changer de plan ou d\'options' : 'Découvrir nos offres'}
                </div>
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-primary-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>

          <button
            onClick={handleOpenPortal}
            className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-secondary-300 hover:bg-secondary-50 transition-all group"
          >
            <div className="flex items-center space-x-3">
              <ExternalLink className="h-6 w-6 text-secondary-600" />
              <div className="text-left">
                <div className="font-medium text-secondary-900">Portail Stripe</div>
                <div className="text-sm text-secondary-600">
                  Gérer cartes et factures
                </div>
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-secondary-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </button>
        </div>
      </SurfacePanel>
    </div>
  );
};

export default BillingPage;
