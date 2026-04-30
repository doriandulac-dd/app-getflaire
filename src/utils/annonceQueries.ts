import React from 'react';
import { supabase } from '../lib/supabase';
import { Annonce } from '../types';

/**
 * Récupère toutes les annonces professionnelles en ligne
 * Filtre: owner_type = 'Pro' ET en_ligne = true
 */
export const fetchOnlineProAnnonces = async (): Promise<{
  data: Annonce[] | null;
  error: string | null;
  count: number;
}> => {
  try {
    const { data, error, count } = await supabase
      .from('annonces')
      .select('*', { count: 'exact' })
      .eq('owner_type', 'Pro')
      .eq('en_ligne', true)
      .order('publication_date', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des annonces Pro en ligne:', error);
      return {
        data: null,
        error: error.message,
        count: 0
      };
    }

    return {
      data: data || [],
      error: null,
      count: count || 0
    };
  } catch (err: any) {
    console.error('Erreur inattendue:', err);
    return {
      data: null,
      error: err.message || 'Une erreur inattendue est survenue',
      count: 0
    };
  }
};

/**
 * Récupère toutes les annonces particuliers en ligne
 * Filtre: owner_type = 'Particulier' ET en_ligne = true
 */
export const fetchOnlineParticulierAnnonces = async (): Promise<{
  data: Annonce[] | null;
  error: string | null;
  count: number;
}> => {
  try {
    const { data, error, count } = await supabase
      .from('annonces')
      .select('*', { count: 'exact' })
      .eq('owner_type', 'Particulier')
      .eq('en_ligne', true)
      .order('publication_date', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération des annonces Particulier en ligne:', error);
      return {
        data: null,
        error: error.message,
        count: 0
      };
    }

    return {
      data: data || [],
      error: null,
      count: count || 0
    };
  } catch (err: any) {
    console.error('Erreur inattendue:', err);
    return {
      data: null,
      error: err.message || 'Une erreur inattendue est survenue',
      count: 0
    };
  }
};

/**
 * Récupère toutes les annonces en ligne (Pro + Particulier)
 * Filtre: en_ligne = true
 */
export const fetchAllOnlineAnnonces = async (): Promise<{
  data: Annonce[] | null;
  error: string | null;
  count: number;
}> => {
  try {
    const { data, error, count } = await supabase
      .from('annonces')
      .select('*', { count: 'exact' })
      .eq('en_ligne', true)
      .order('publication_date', { ascending: false });

    if (error) {
      console.error('Erreur lors de la récupération de toutes les annonces en ligne:', error);
      return {
        data: null,
        error: error.message,
        count: 0
      };
    }

    return {
      data: data || [],
      error: null,
      count: count || 0
    };
  } catch (err: any) {
    console.error('Erreur inattendue:', err);
    return {
      data: null,
      error: err.message || 'Une erreur inattendue est survenue',
      count: 0
    };
  }
};

/**
 * Hook personnalisé pour utiliser les annonces Pro en ligne dans un composant React
 */
export const useOnlineProAnnonces = () => {
  const [data, setData] = React.useState<Annonce[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [count, setCount] = React.useState(0);

  const fetchData = async () => {
    setLoading(true);
    const result = await fetchOnlineProAnnonces();
    
    if (result.error) {
      setError(result.error);
      setData([]);
    } else {
      setError(null);
      setData(result.data || []);
    }
    
    setCount(result.count);
    setLoading(false);
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    count,
    refetch: fetchData
  };
};