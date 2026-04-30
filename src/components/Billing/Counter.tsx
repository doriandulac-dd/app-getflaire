import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { formatPrice, getCadenceLabel } from '../../stripe-config';

interface CounterProps {
  label: string;
  value: number;
  setValue: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  price?: number;
  cadence?: 'month' | 'quarter' | 'year';
}

const Counter: React.FC<CounterProps> = ({ 
  label, 
  value, 
  setValue, 
  min = 0, 
  max = 99, 
  disabled = false,
  price,
  cadence = 'month'
}) => {
  const handleDecrement = () => {
    if (value > min) {
      setValue(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      setValue(value + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    if (newValue >= min && newValue <= max) {
      setValue(newValue);
    }
  };

  const getMonthlyEquivalent = (price: number): number => {
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
    <div className="flex items-center justify-between border border-gray-200 rounded-2xl p-4 bg-white hover:border-gray-300 transition-colors">
      <div>
        <div className="font-medium text-secondary-900">{label}</div>
        {price && (
          <div className="text-sm text-secondary-600">
            {formatPrice(price)} par unité ({getCadenceLabel(cadence)})
            {cadence !== 'month' && (
              <span className="text-primary-600 font-medium ml-1">
                soit {formatPrice(getMonthlyEquivalent(price))}/mois
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          className="p-1 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>
        
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          disabled={disabled}
          className="w-12 text-center border border-gray-300 rounded-lg py-1 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
        />
        
        <button
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          className="p-1 rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Counter;