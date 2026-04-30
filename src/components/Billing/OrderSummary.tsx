import React from 'react';
import { CreditCard, Calculator } from 'lucide-react';
import { calculatePrice, calculateAddonPrice, formatPrice, calculateTTC } from '../../stripe-config';

interface OrderSummaryProps {
  selectedPlan: 'independant' | 'agence';
  quantities: {
    extraDepartments: number;
    extraUsers: number;
  };
  onCheckout: () => void;
  loading?: boolean;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  selectedPlan,
  quantities,
  onCheckout,
  loading = false,
}) => {
  const profile = selectedPlan === 'independant' ? 'individual' : 'agency';
  const basePlanPrice = calculatePrice(profile);

  const addonPrices = {
    extraDepartments: calculateAddonPrice('dept', profile) * quantities.extraDepartments,
    extraUsers: calculateAddonPrice('user') * quantities.extraUsers,
  };

  const totalHT =
    basePlanPrice +
    addonPrices.extraDepartments +
    addonPrices.extraUsers;

  const totalTTC = calculateTTC(totalHT);


  const planLabel = selectedPlan === 'independant' ? 'GetFlaire Indépendant' : 'GetFlaire Agence';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
      <div className="flex items-center space-x-2 mb-6">
        <Calculator className="h-5 w-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-secondary-900">Récapitulatif de commande</h3>
      </div>

      <div className="space-y-4">
        {/* Plan de base */}
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-medium text-secondary-900">{planLabel}</h4>
            <p className="text-sm text-secondary-600">
              Abonnement mensuel
            </p>
          </div>
          <div className="text-right">
            <div className="font-semibold text-secondary-900">{formatPrice(basePlanPrice)}</div>
            <div className="text-xs text-secondary-500">/mois</div>
          </div>
        </div>

        {/* Départements */}
        {quantities.extraDepartments > 0 && (
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-secondary-900">Départements supplémentaires</h4>
              <p className="text-sm text-secondary-600">
                {quantities.extraDepartments} × {formatPrice(calculateAddonPrice('dept', profile))}
              </p>
            </div>
            <div className="text-right">
              <div className="font-semibold text-secondary-900">{formatPrice(addonPrices.extraDepartments)}</div>
              <div className="text-xs text-secondary-500">/mois</div>
            </div>
          </div>
        )}

        {/* Utilisateurs (agence) */}
        {quantities.extraUsers > 0 && (
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-medium text-secondary-900">Utilisateurs supplémentaires</h4>
              <p className="text-sm text-secondary-600">
                {quantities.extraUsers} × {formatPrice(calculateAddonPrice('user'))}
              </p>
            </div>
            <div className="text-right">
              <div className="font-semibold text-secondary-900">{formatPrice(addonPrices.extraUsers)}</div>
              <div className="text-xs text-secondary-500">/mois</div>
            </div>
          </div>
        )}

        <hr className="border-gray-200" />

        {/* Totaux */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-secondary-700">Sous-total HT :</span>
            <span className="font-medium text-secondary-900">{formatPrice(totalHT)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary-700">TVA (20%) :</span>
            <span className="font-medium text-secondary-900">{formatPrice(totalTTC - totalHT)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span className="text-secondary-900">Total TTC :</span>
            <span className="text-primary-600">{formatPrice(totalTTC)}</span>
          </div>
          <p className="text-xs text-secondary-500">
            Facturé mensuellement
          </p>
        </div>

        {/* Bouton de paiement */}
        <button
          onClick={onCheckout}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              <span>S'abonner / Mettre à jour</span>
            </>
          )}
        </button>

        <p className="text-xs text-secondary-500 text-center">
          Paiement sécurisé par Stripe. Vous serez redirigé vers une page de paiement sécurisée.
        </p>
      </div>
    </div>
  );
};

export default OrderSummary;