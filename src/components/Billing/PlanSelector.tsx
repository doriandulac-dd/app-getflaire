import React from 'react';
import { Users, User, Check, Crown } from 'lucide-react';
import { calculatePrice, formatPrice, getCadenceLabel, getCadenceDiscount } from '../../stripe-config';

interface PlanSelectorProps {
  selectedPlan: 'independant' | 'agence';
  selectedCadence: 'month' | 'quarter' | 'year';
  onPlanChange: (plan: 'independant' | 'agence') => void;
  onCadenceChange: (cadence: 'month' | 'quarter' | 'year') => void;
}

const PlanSelector: React.FC<PlanSelectorProps> = ({ 
  selectedPlan, 
  selectedCadence,
  onPlanChange, 
  onCadenceChange 
}) => {
  const profile = selectedPlan === 'independant' ? 'individual' : 'agency';
  
  const individualPrice = calculatePrice('individual', selectedCadence);
  const agencyPrice = calculatePrice('agency', selectedCadence);

  const plans = [
    {
      id: 'independant' as const,
      name: 'Indépendant',
      icon: User,
      description: 'Pour les agents immobiliers indépendants',
      price: individualPrice,
      includes: [
        '1 compte utilisateur',
        '1 département inclus',
        'Surveillance d\'annonces',
        'Analytics avancées',
        'Support standard'
      ],
      color: 'border-blue-200 bg-blue-50'
    },
    {
      id: 'agence' as const,
      name: 'Agence',
      icon: Users,
      description: 'Pour les agences immobilières',
      price: agencyPrice,
      includes: [
        '3 comptes utilisateurs',
        '1 département inclus',
        'Gestion d\'équipe',
        'Analytics avancées',
        'Support prioritaire'
      ],
      color: 'border-primary-200 bg-primary-50',
      popular: true
    }
  ];

  const cadenceOptions = [
    { value: 'month' as const, label: 'Mensuel', discount: 0 },
    { value: 'quarter' as const, label: 'Trimestriel', discount: 10 },
    { value: 'year' as const, label: 'Annuel', discount: 20 }
  ];

  const getMonthlyEquivalent = (price: number, cadence: 'month' | 'quarter' | 'year'): number => {
    switch (cadence) {
      case 'quarter':
        return price / 3;
      case 'year':
        return price / 12;
      default:
        return price;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cadence Selection */}
      <div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Fréquence de facturation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cadenceOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onCadenceChange(option.value)}
              className={`relative p-4 rounded-xl border-2 text-center transition-all hover:shadow-md ${
                selectedCadence === option.value
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-100'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {option.discount > 0 && (
                <div className="absolute -top-2 right-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                    -{option.discount}%
                  </span>
                </div>
              )}
              
              <div className="font-semibold text-secondary-900">{option.label}</div>
              {option.discount > 0 && (
                <div className="text-xs text-green-600 font-medium mt-1">
                  Économisez {option.discount}%
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Selection */}
      <div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-4">Choisir votre plan</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan === plan.id;
            const monthlyEquivalent = getMonthlyEquivalent(plan.price, selectedCadence);
            
            return (
              <button
                key={plan.id}
                onClick={() => onPlanChange(plan.id)}
                className={`relative p-6 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  isSelected 
                    ? `${plan.color} border-primary-500 ring-2 ring-primary-100` 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >

                {isSelected && (
                  <div className="absolute -top-3 right-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                      <Check className="h-3 w-3 mr-1" />
                      Sélectionné
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-3 rounded-lg ${isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-secondary-900">{plan.name}</h4>
                    <p className="text-sm text-secondary-600">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-2xl font-bold text-primary-600">
                    {formatPrice(plan.price)}
                  </div>
                  <div className="text-sm text-secondary-600">
                    {getCadenceLabel(selectedCadence)}
                    {selectedCadence !== 'month' && (
                      <span className="text-primary-600 font-medium ml-1">
                        (soit {formatPrice(monthlyEquivalent)}/mois)
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.includes.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-secondary-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlanSelector;