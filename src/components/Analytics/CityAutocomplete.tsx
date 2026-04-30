import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CityAutocompleteProps {
  value: string;
  onChange: (city: string | undefined) => void;
  placeholder?: string;
}

const CityAutocomplete: React.FC<CityAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Rechercher une ville...",
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('annonces')
          .select('city')
          .ilike('city', `%${inputValue}%`)
          .not('city', 'is', null)
          .limit(10);

        if (error) throw error;

        const uniqueCities = [...new Set(data?.map(item => item.city) || [])]
          .filter(city => city && city.toLowerCase().includes(inputValue.toLowerCase()))
          .sort();

        setSuggestions(uniqueCities);
      } catch (error) {
        console.error('Error fetching city suggestions:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(true);
    
    if (newValue === '') {
      onChange(undefined);
    }
  };

  const handleSuggestionClick = (city: string) => {
    setInputValue(city);
    onChange(city);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    setInputValue('');
    onChange(undefined);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleSuggestionClick(suggestions[0]);
      } else if (inputValue.trim()) {
        onChange(inputValue.trim());
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
      }
    }, 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
        {inputValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (suggestions.length > 0 || loading) && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto mt-1"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Recherche en cours...
            </div>
          ) : (
            suggestions.map((city, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(city)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-primary-50 hover:text-primary-700 focus:bg-primary-50 focus:text-primary-700 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
              >
                {city}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CityAutocomplete;