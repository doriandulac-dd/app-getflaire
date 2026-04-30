import React from 'react';
import { Calendar, Info, Crown } from 'lucide-react';
import { getCadenceDiscount } from '../../stripe-config';

interface CadenceSelectorProps {
  selectedCadence: 'month' | 'quarter' | 'year';
  onCadenceChange: (cadence: 'month' | 'quarter' | 'year') => void;
}

const CadenceSelector: React.FC<CadenceSelectorProps> = ({
  selectedCadence,
  onCadenceChange
}) => {
  const cadenceOptions = [
    { 
      value: 'month' as const, 
      label: 'Mensuel', 
      description: 'Facturé chaque mois',
      discount: 0,
      popular: false
    },
    { 
      value: 'quarter' as const, 
      label: 'Trimestriel', 
      description: 'Facturé tous les 3 mois',
      discount: getCadenceDiscount('quarter'),
      popular: false
    },
    { 
      value: 'year' as const, 
      label: 'Annuel', 
      description: 'Facturé une fois par an',
      discount: getCadenceDiscount('year'),
      popular: true
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-secondary-900">Fréquence de facturation</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            {option.popular && (
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-500 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Recommandé
                </span>
              </div>
            )}

            {option.discount > 0 && (
              <div className="absolute -top-2 right-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500 text-white">
                  -{option.discount}%
                </span>
              </div>
            )}

            <div className="flex items-center justify-center mb-2">
              <Calendar className={`h-6 w-6 ${selectedCadence === option.value ? 'text-primary-600' : 'text-gray-400'}`} />
            </div>
            
            <h4 className="font-semibold text-secondary-900 mb-1">{option.label}</h4>
            <p className="text-sm text-secondary-600">{option.description}</p>
            
            {option.discount > 0 && (
              <div className="mt-2 text-xs font-medium text-green-600">
                Économisez {option.discount}% par rapport au mensuel
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <Info className="h-5 w-5 text-primary-600" />
          <span className="text-sm font-medium text-primary-800">
            Facturation flexible
          </span>
        </div>
        <p className="text-sm text-primary-700 mt-2">
          Vous pouvez changer de fréquence de facturation à tout moment depuis votre espace client.
          Les changements sont proratisés automatiquement.
        </p>
      </div>
    </div>
  );
};

export default CadenceSelector;