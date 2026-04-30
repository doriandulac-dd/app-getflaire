import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Calculator, Crown, MapPin, Users, Building } from 'lucide-react';
import { useStripe } from '../hooks/useStripe';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { DEPT_LABELS } from '../components/Billing/RegionDeptPicker';
import { 
  getPlanPriceId, 
  getDeptAddonPriceId, 
  getUserAddonPriceId, 
  getProductByPriceId,
  getStatusColor, 
  getStatusLabel, 
  calculatePrice, 
  calculateAddonPrice, 
  formatPrice,
  getCadenceLabel
} from '../stripe-config';
import PlanSelector from '../components/Billing/PlanSelector';
import Addons from '../components/Billing/Addons';
import RegionDeptPicker from '../components/Billing/RegionDeptPicker';
import toast from 'react-hot-toast';

const UpgradePage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { 
    subscriptionSummary, 
    loading, 
    openBillingPortal,
    refreshData 
  } = useStripe();

  const [selectedPlan, setSelectedPlan] = useState<'independant' | 'agence'>('independant');
  const [selectedCadence, setSelectedCadence] = useState<'month' | 'quarter' | 'year'>('month');
  const [quantities, setQuantities] = useState({
    extraDepartments: 0,
    extraUsers: 0,
  });
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const hasActiveSub = Boolean(subscriptionSummary);
  const profile = selectedPlan === 'independant' ? 'individual' : 'agency';

  // Calculate max departments allowed (1 included + extensions)
  const maxDepartmentsAllowed = 1 + quantities.extraDepartments;

  // Calculate total price
  const basePlanPrice = calculatePrice(profile, selectedCadence);
  const deptAddonPrice = calculateAddonPrice('dept', profile, selectedCadence) * quantities.extraDepartments;
  const userAddonPrice = calculateAddonPrice('user', 'agency', selectedCadence) * quantities.extraUsers;
  const totalPrice = basePlanPrice + deptAddonPrice + userAddonPrice;

  // Analyze current subscription to extract details
  const getCurrentPlanDetails = () => {
    if (!subscriptionSummary) return null;

    const currentProduct = getProductByPriceId(subscriptionSummary.items[0]?.price_id || '');
    const isAgencyPlan = currentProduct?.profile === 'agency';
    
    // Count add-ons from subscription items
    let currentExtraDepts = 0;
    let currentExtraUsers = 0;
    
    subscriptionSummary.items.forEach(item => {
      if (item.lookup_key.includes('Département supplémentaire')) {
        currentExtraDepts += item.quantity;
      } else if (item.lookup_key.includes('Compte supplémentaire')) {
        currentExtraUsers += item.quantity;
      }
    });

    return {
      planType: isAgencyPlan ? 'Agence' : 'Indépendant',
      cadence: subscriptionSummary.cadence,
      departments: subscriptionSummary.selectedDepartments || [],
      totalDepartments: 1 + currentExtraDepts, // 1 included + extras
      extraDepartments: currentExtraDepts,
      totalUsers: isAgencyPlan ? (3 + currentExtraUsers) : 1, // Agency: 3 included + extras, Individual: 1
      extraUsers: currentExtraUsers,
      price: subscriptionSummary.price,
      status: subscriptionSummary.status,
    };
  };

  const currentPlanDetails = getCurrentPlanDetails();
  const handleOpenPortal = async () => {
    try {
      await openBillingPortal();
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || 'Erreur lors de l\'ouverture du portail de facturation');
    }
  };

  const handleQuantityChange = (addon: 'extraDepartments' | 'extraUsers', quantity: number) => {
    setQuantities(prev => ({
      ...prev,
      [addon]: quantity
    }));
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Pre-select current subscription details when data is loaded
  useEffect(() => {
    if (!loading) {
      // If user has an active subscription, use subscription data
      if (subscriptionSummary && subscriptionSummary.status === 'active') {
      // Determine plan type from subscription
      const currentProduct = getProductByPriceId(subscriptionSummary.items[0]?.price_id || '');
      if (currentProduct) {
        // Set plan based on product profile
        if (currentProduct.profile === 'individual') {
          setSelectedPlan('independant');
        } else if (currentProduct.profile === 'agency') {
          setSelectedPlan('agence');
        }
        
        // Set cadence from subscription
        setSelectedCadence(subscriptionSummary.cadence);
      }
      
      // Set selected departments from subscription
      if (subscriptionSummary.selectedDepartments) {
        setSelectedDepartments(subscriptionSummary.selectedDepartments);
      }
      
      // Calculate current add-on quantities based on subscription items
      // This is a simplified calculation - you might need to adjust based on your actual Stripe setup
      const currentItems = subscriptionSummary.items;
      let extraDepts = 0;
      let extraUsers = 0;
      
      currentItems.forEach(item => {
        if (item.lookup_key.includes('Département supplémentaire')) {
          extraDepts += item.quantity;
        } else if (item.lookup_key.includes('Compte supplémentaire')) {
          extraUsers += item.quantity;
        }
      });
      
      setQuantities({
        extraDepartments: extraDepts,
        extraUsers: extraUsers,
      });
    } else if (appUser) {
        // If no active subscription, pre-select based on user role/agency
        const hasAgency = Boolean(appUser.agency_id || appUser.agency?.id);
        const userRole = (appUser.Role || '').toLowerCase();
        
        if (hasAgency || userRole === 'admin' || userRole === 'agence') {
          setSelectedPlan('agence');
        } else {
          setSelectedPlan('independant');
        }
        
        // Reset to defaults for new subscription
        setSelectedCadence('month');
        setQuantities({
          extraDepartments: 0,
          extraUsers: 0,
        });
        setSelectedDepartments([]);
      }
    }
  }, [loading, subscriptionSummary, appUser]);

  const continueCheckout = async () => {
    if (selectedDepartments.length === 0) {
      toast.error('Veuillez sélectionner au moins un département');
      return;
    }

    if (selectedDepartments.length > maxDepartmentsAllowed) {
      toast.error(`Vous ne pouvez sélectionner que ${maxDepartmentsAllowed} département(s) maximum`);
      return;
    }

    setCheckoutLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Utilisateur non authentifié');
      }

      // Convert department codes to department names
      const selectedDepartmentNames = selectedDepartments.map(code => DEPT_LABELS[code] || code);

      // Use dedicated functions URL with fallback to proxy
      const baseFunctionsUrl =
        import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
        ?? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`; // fallback proxy

      // Create checkout session via edge function
      const response = await fetch(`${baseFunctionsUrl}/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          // Add apikey for proxy /functions/v1 (often required)
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          cadence: selectedCadence,
          extraDepartments: quantities.extraDepartments,
          extraRegions: 0,
          extraUsers: quantities.extraUsers,
          selectedDepartments: selectedDepartmentNames,
          selectedRegions: [],
          success_url: `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/billing/upgrade`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du checkout');
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('URL de checkout non reçue');
      }

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Erreur lors de la création du paiement');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getMonthlyEquivalent = (price: number): number => {
    switch (selectedCadence) {
      case 'quarter':
        return price / 3;
      case 'year':
        return price / 12;
      default:
        return price;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/settings?tab=billing')}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-secondary-900">
            {hasActiveSub ? 'Mettre à jour mon plan' : 'Choisir mon plan'}
          </h1>
          <p className="text-secondary-600 mt-1">
            {hasActiveSub ? 'Modifiez votre abonnement actuel' : 'Sélectionnez le plan qui vous convient'}
          </p>
        </div>
      </div>

      {/* Current Plan Summary */}
      {hasActiveSub && currentPlanDetails && (
        <div className="bg-gradient-to-r from-blue-50 to-primary-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900 text-lg">Mon plan actuel</h3>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-blue-800 font-medium text-lg">{currentPlanDetails.planType}</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(currentPlanDetails.status)}`}>
                    {getStatusLabel(currentPlanDetails.status)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-600">
                {formatPrice(currentPlanDetails.price)}
              </div>
              <div className="text-sm text-blue-700">
                {getCadenceLabel(currentPlanDetails.cadence)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Plan Type */}
            <div className="bg-white/70 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Building className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Type de plan</h4>
              </div>
              <p className="text-blue-800 font-semibold">{currentPlanDetails.planType}</p>
              <p className="text-sm text-blue-700">{getCadenceLabel(currentPlanDetails.cadence)}</p>
            </div>

            {/* Departments */}
            <div className="bg-white/70 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Départements</h4>
              </div>
              <p className="text-blue-800 font-semibold">
                {currentPlanDetails.totalDepartments} département{currentPlanDetails.totalDepartments > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-blue-700">
                1 inclus + {currentPlanDetails.extraDepartments} supplémentaire{currentPlanDetails.extraDepartments > 1 ? 's' : ''}
              </p>
              {currentPlanDetails.departments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {currentPlanDetails.departments.slice(0, 3).map(dept => (
                    <span key={dept} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      {dept}
                    </span>
                  ))}
                  {currentPlanDetails.departments.length > 3 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      +{currentPlanDetails.departments.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Users (for agency plans) */}
            <div className="bg-white/70 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-900">Comptes utilisateurs</h4>
              </div>
              <p className="text-blue-800 font-semibold">
                {currentPlanDetails.totalUsers} compte{currentPlanDetails.totalUsers > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-blue-700">
                {currentPlanDetails.planType === 'Agence' 
                  ? `3 inclus + ${currentPlanDetails.extraUsers} supplémentaire${currentPlanDetails.extraUsers > 1 ? 's' : ''}`
                  : '1 compte inclus'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Configuration */}
        <div className="lg:col-span-2 space-y-8">
          {/* Plan Selection */}
          <PlanSelector
            selectedPlan={selectedPlan}
            selectedCadence={selectedCadence}
            onPlanChange={setSelectedPlan}
            onCadenceChange={setSelectedCadence}
          />

          {/* Add-ons */}
          <Addons
            selectedPlan={selectedPlan}
            selectedCadence={selectedCadence}
            quantities={quantities}
            onQuantityChange={handleQuantityChange}
          />

          {/* Department Selection */}
          <RegionDeptPicker
            selectedPlan={selectedPlan}
            selectedDepartments={selectedDepartments}
            onDepartmentsChange={setSelectedDepartments}
            maxDepartmentsAllowed={maxDepartmentsAllowed}
          />
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
            <div className="flex items-center space-x-2 mb-6">
              <Calculator className="h-5 w-5 text-primary-600" />
              <h3 className="text-lg font-semibold text-secondary-900">Récapitulatif</h3>
            </div>

            <div className="space-y-4">
              {/* Base Plan */}
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-secondary-900">
                    {selectedPlan === 'independant' ? 'GetFlaire Indépendant' : 'GetFlaire Agence'}
                  </h4>
                  <p className="text-sm text-secondary-600">
                    {getCadenceLabel(selectedCadence)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-secondary-900">{formatPrice(basePlanPrice)}</div>
                  {selectedCadence !== 'month' && (
                    <div className="text-xs text-secondary-500">
                      soit {formatPrice(getMonthlyEquivalent(basePlanPrice))}/mois
                    </div>
                  )}
                </div>
              </div>

              {/* Departments Add-on */}
              {quantities.extraDepartments > 0 && (
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-secondary-900">Départements supplémentaires</h4>
                    <p className="text-sm text-secondary-600">
                      {quantities.extraDepartments} × {formatPrice(calculateAddonPrice('dept', profile, selectedCadence))}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-secondary-900">{formatPrice(deptAddonPrice)}</div>
                    {selectedCadence !== 'month' && (
                      <div className="text-xs text-secondary-500">
                        soit {formatPrice(getMonthlyEquivalent(deptAddonPrice))}/mois
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Users Add-on */}
              {quantities.extraUsers > 0 && (
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-secondary-900">Comptes supplémentaires</h4>
                    <p className="text-sm text-secondary-600">
                      {quantities.extraUsers} × {formatPrice(calculateAddonPrice('user', 'agency', selectedCadence))}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-secondary-900">{formatPrice(userAddonPrice)}</div>
                    {selectedCadence !== 'month' && (
                      <div className="text-xs text-secondary-500">
                        soit {formatPrice(getMonthlyEquivalent(userAddonPrice))}/mois
                      </div>
                    )}
                  </div>
                </div>
              )}

              <hr className="border-gray-200" />

              {/* Total */}
              <div className="flex justify-between text-lg font-bold">
                <span className="text-secondary-900">Total :</span>
                <div className="text-right">
                  <div className="text-primary-600">{formatPrice(totalPrice)}</div>
                  {selectedCadence !== 'month' && (
                    <div className="text-sm font-normal text-secondary-500">
                      soit {formatPrice(getMonthlyEquivalent(totalPrice))}/mois
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Departments */}
              {selectedDepartments.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-secondary-700 mb-2">
                    Départements sélectionnés ({selectedDepartments.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedDepartments.map(dept => (
                      <span key={dept} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-800">
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Checkout Button */}
            <button
              onClick={continueCheckout}
              disabled={checkoutLoading || selectedDepartments.length === 0}
              className="w-full mt-6 inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkoutLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <CreditCard className="h-5 w-5 mr-2" />
              )}
              {hasActiveSub ? 'Mettre à jour' : 'S\'abonner'}
            </button>

            <p className="text-xs text-secondary-500 text-center mt-3">
              Paiement sécurisé par Stripe
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={handleOpenPortal}
          className="px-6 py-3 border border-gray-300 text-secondary-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          Gérer via Stripe
        </button>
      </div>

      {/* Information */}
      <div className="bg-primary-50 border border-primary-200 rounded-2xl p-6">
        <h4 className="text-sm font-medium text-primary-900 mb-3">
          💡 Informations importantes
        </h4>
        <ul className="text-sm text-primary-800 space-y-2">
          <li>• Les changements de plan sont proratisés automatiquement</li>
          <li>• Vous pouvez modifier ou annuler votre abonnement à tout moment</li>
          <li>• Les extensions sont facturées en plus de votre plan de base</li>
          <li>• Paiement sécurisé par Stripe avec garantie de remboursement</li>
          <li>• Factures disponibles immédiatement après paiement</li>
        </ul>
      </div>
    </div>
  );
};

export default UpgradePage;