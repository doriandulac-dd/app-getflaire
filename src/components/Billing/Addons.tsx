import React from 'react';
import { MapPin, Users, Plus, Minus } from 'lucide-react';
import { calculateAddonPrice, formatPrice, getCadenceLabel } from '../../stripe-config';

interface AddonsProps {
  selectedPlan: 'independant' | 'agence';
  selectedCadence: 'month' | 'quarter' | 'year';
  quantities: {
    extraDepartments: number;
    extraUsers: number;
  };
  onQuantityChange: (addon: 'extraDepartments' | 'extraUsers', quantity: number) => void;
}

const Addons: React.FC<AddonsProps> = ({
  selectedPlan,
  selectedCadence,
  quantities,
  onQuantityChange,
}) => {
  const profile = selectedPlan === 'independant' ? 'individual' : 'agency';
  
  const addons = [
    {
      id: 'extraDepartments' as const,
      name: 'Départements supplémentaires',
      description: 'Ajoutez des départements à votre couverture géographique',
      icon: MapPin,
      price: calculateAddonPrice('dept', profile, selectedCadence),
      availableFor: ['independant', 'agence'] as const,
      unit: "département",
    },
    {
      id: 'extraUsers' as const,
      name: 'Comptes supplémentaires',
      description: 'Ajoutez des membres à votre équipe (réservé aux agences)',
      icon: Users,
      price: calculateAddonPrice('user', 'agency', selectedCadence),
      availableFor: ['agence'] as const,
      unit: 'compte',
    },
  ] as const;

  const availableAddons = addons.filter(a => a.availableFor.includes(selectedPlan));

  const handleQuantityChange = (
    addonId: 'extraDepartments' | 'extraUsers',
    delta: number
  ) => {
    const current = quantities[addonId];
    const next = Math.max(0, current + delta);
    onQuantityChange(addonId, next);
  };

  const handleInputChange = (
    addonId: 'extraDepartments' | 'extraUsers',
    value: string
  ) => {
    const q = Math.max(0, parseInt(value || '0', 10) || 0);
    onQuantityChange(addonId, q);
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

  if (!availableAddons.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-secondary-900">Extensions disponibles</h3>

      <div className="space-y-4">
        {availableAddons.map((addon) => {
          const Icon = addon.icon;
          const quantity = quantities[addon.id];
          const totalPrice = addon.price * quantity;
          const monthlyEquivalent = getMonthlyEquivalent(addon.price);

          return (
            <div key={addon.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <Icon className="h-5 w-5 text-primary-600" />
                  </div>

                  <div className="flex-1">
                    <h4 className="font-semibold text-secondary-900">{addon.name}</h4>
                    <p className="text-sm text-secondary-600 mb-3">{addon.description}</p>

                    <div className="flex items-center space-x-2 text-sm text-secondary-700">
                      <span>{formatPrice(addon.price)} / {addon.unit}</span>
                      <span className="text-secondary-500">({getCadenceLabel(selectedCadence)})</span>
                      {selectedCadence !== 'month' && (
                        <span className="text-primary-600 font-medium">
                          soit {formatPrice(monthlyEquivalent)}/mois
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleQuantityChange(addon.id, -1)}
                      disabled={quantity <= 0}
                      className="p-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      value={quantity}
                      onChange={(e) => handleInputChange(addon.id, e.target.value)}
                      className="w-16 px-2 py-1 text-center border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />

                    <button
                      onClick={() => handleQuantityChange(addon.id, 1)}
                      className="p-1 rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {quantity > 0 && (
                    <div className="text-right">
                      <div className="font-semibold text-secondary-900">{formatPrice(totalPrice)}</div>
                      <div className="text-xs text-secondary-500">
                        {getCadenceLabel(selectedCadence)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {addon.id === 'extraDepartments' && (
                <p className="mt-2 text-xs text-secondary-500">
                  Vous pouvez sélectionner <strong>{1 + quantities.extraDepartments}</strong> département(s) au total (1 inclus dans le plan + vos extensions).
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Addons;