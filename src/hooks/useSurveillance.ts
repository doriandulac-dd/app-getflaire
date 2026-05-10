import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useActivityScope } from './useActivityScope';
import { SurveillanceWithDetails, SurveillanceHistorique, SurveillanceSettings, SurveillanceFilters } from '../types/surveillance';
import toast from 'react-hot-toast';

export const useSurveillance = () => {
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const [surveillances, setSurveillances] = useState<SurveillanceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SurveillanceSettings | null>(null);
  const [currentFilters, setCurrentFilters] = useState<SurveillanceFilters | undefined>();

  useEffect(() => {
    if (appUser && !activityScope.loading) {
      refreshSurveillances();
      fetchSettings();
    }
    // eslint-disable-next-line
  }, [appUser, activityScope.loading, activityScope.userIds.join('|')]);

  // --- VERSION CORRIGÉE ---
  const fetchSurveillances = async (filters?: SurveillanceFilters, reset: boolean = false, limit: number = 20) => {
    if (!appUser?.id || appUser.id === "undefined" || activityScope.userIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Utiliser la vue surveillances_with_details qui contient déjà toutes les informations nécessaires
      let query = supabase
        .from('surveillances_with_details')
        .select('*', { count: 'exact' })
        .in('user_id', activityScope.userIds)
        .eq('active', true);

      // Applique les filtres, comme dans la pige
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
      }

      if (filters?.property_types?.length) {
        query = query.or(filters.property_types.map(type => `type_de_bien.eq.${type}`).join(','));
      }

      if (filters?.cities?.length) {
        query = query.or(filters.cities.map(city => `city.ilike.%${city}%`).join(','));
      }

      if (filters?.price_min !== undefined) {
        query = query.gte('price', filters.price_min);
      }

      if (filters?.price_max !== undefined) {
        query = query.lte('price', filters.price_max);
      }

      if (filters?.surface_min !== undefined) {
        query = query.gte('size', filters.surface_min);
      }

      if (filters?.surface_max !== undefined) {
        query = query.lte('size', filters.surface_max);
      }

      // Statut online/offline/supprimée si besoin
      if (filters?.status) {
        switch (filters.status) {
          case 'en_ligne':
            query = query.eq('en_ligne', true).eq('supprimee', false);
            break;
          case 'hors_ligne':
            query = query.eq('en_ligne', false).eq('supprimee', false);
            break;
          case 'supprimee':
            query = query.eq('supprimee', true);
            break;
        }
      }

      // Pagination & tri (par défaut sur publication_date)
      query = query.order('date_surveillance', { ascending: false });
      const from = reset ? 0 : (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data: annoncesRows, error: annoncesErr, count } = await query;

      if (annoncesErr) throw annoncesErr;

      // Transformer les données pour correspondre au type SurveillanceWithDetails
      const newSurveillances = (annoncesRows || []).map(row => ({
        ...row,
        annonce_id: row.annonce_id, // Cette propriété devrait maintenant être disponible
        actor_name: activityScope.formatActor(row.user_id),
        is_own_action: activityScope.isOwnAction(row.user_id),
      }));

      if (reset) {
        setSurveillances(newSurveillances);
        setPage(2);
      } else {
        setSurveillances(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newUnique = newSurveillances.filter(a => !existingIds.has(a.id));
          return [...prev, ...newUnique];
        });
        setPage(prev => prev + 1);
      }

      setHasMore(newSurveillances.length === limit && (count || 0) > from + limit);
    } catch (error: any) {
      setError(error.message || 'Erreur lors du chargement des surveillances');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchSurveillances(currentFilters, false);
    }
  };

  const refreshSurveillances = (filters?: SurveillanceFilters) => {
    setCurrentFilters(filters);
    setPage(1);
    fetchSurveillances(filters, true);
  };

  const fetchSettings = async () => {
    if (!appUser?.id) return;
    try {
      const { data, error } = await supabase
        .from('surveillance_settings')
        .select('*')
        .eq('user_id', appUser.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching surveillance settings:', error);
    }
  };

  const addToSurveillance = async (annonceId: string, notes?: string) => {
    if (!appUser?.id || appUser.id === "undefined") return false;
    try {
      const { error } = await supabase
        .from('surveillances')
        .insert({
          user_id: appUser.id,
          agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
          annonce_id: annonceId,
          notes: notes,
          active: true,
        });
      if (error) throw error;
      toast.success('Annonce ajoutée à la surveillance');
      refreshSurveillances();
      return true;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Cette annonce est déjà sous surveillance');
      } else {
        toast.error('Erreur lors de l\'ajout à la surveillance');
      }
      return false;
    }
  };

  const removeFromSurveillance = async (surveillanceId: string) => {
    try {
      const { data, error } = await supabase
        .from('surveillances')
        .update({ active: false })
        .eq('id', surveillanceId)
        .in('user_id', activityScope.userIds)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Surveillance non trouvée ou déjà inactive');
        return false;
      }
      toast.success('Annonce retirée de la surveillance');
      refreshSurveillances();
      return true;
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression de la surveillance');
      return false;
    }
  };

  const isSurveilled = async (annonceId: string): Promise<boolean> => {
    if (!appUser?.id || appUser.id === "undefined") return false;
    try {
      const { data, error } = await supabase
        .from('surveillances')
        .select('id')
        .eq('annonce_id', annonceId)
        .in('user_id', activityScope.userIds)
        .eq('active', true)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    } catch (error) {
      return false;
    }
  };

  const getSurveillanceHistory = async (surveillanceId: string): Promise<SurveillanceHistorique[]> => {
    try {
      const { data, error } = await supabase
        .from('surveillance_historique')
        .select('*')
        .eq('surveillance_id', surveillanceId)
        .order('date_modification', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching surveillance history:', error);
      return [];
    }
  };

  const updateSettings = async (newSettings: Partial<SurveillanceSettings>) => {
    if (!appUser?.id || appUser.id === "undefined") return false;
    try {
      const { error } = await supabase
        .from('surveillance_settings')
        .upsert({
          user_id: appUser.id,
          ...newSettings,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      toast.success('Paramètres mis à jour');
      fetchSettings();
      return true;
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des paramètres');
      return false;
    }
  };

  return {
    surveillances,
    loading,
    hasMore,
    error,
    settings,
    fetchSurveillances: refreshSurveillances,
    loadMore,
    refreshSurveillances,
    addToSurveillance,
    removeFromSurveillance,
    isSurveilled,
    getSurveillanceHistory,
    updateSettings,
  };
};
