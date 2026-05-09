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

  const handleBlur = () => {
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
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.length >= 2 && setShowSuggestions(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-secondary-200 bg-white/90 py-3 pl-11 pr-10 text-sm font-semibold text-secondary-900 outline-none transition placeholder:text-secondary-400 focus:border-primary-300 focus:ring-4 focus:ring-primary-100"
        />
        {inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (suggestions.length > 0 || loading) && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-secondary-100 bg-white p-1 shadow-xl"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm font-semibold text-secondary-500">
              Recherche en cours...
            </div>
          ) : (
            suggestions.map((city, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(city)}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-secondary-700 transition hover:bg-primary-50 hover:text-primary-700 focus:bg-primary-50 focus:text-primary-700 focus:outline-none"
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
