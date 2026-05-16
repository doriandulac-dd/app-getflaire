import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useActivityScope } from './useActivityScope';
import { ReminderFromSuivi, ReminderFilters, ProcessedReminder } from '../types/reminder';
import toast from 'react-hot-toast';

const isMissingActivityTableError = (error: { code?: string; message?: string }) =>
  error.code === '42P01' || (error.message || '').includes('pige_actions');

const applyReminderScope = (query: any, activityScope: ReturnType<typeof useActivityScope>, userId?: string) => {
  if (activityScope.isAgencyScope && activityScope.agencyId) {
    return query.eq('agency_id', activityScope.agencyId);
  }

  if (activityScope.userIds.length > 0) {
    return query.in('user_id', activityScope.userIds);
  }

  return userId ? query.eq('user_id', userId) : query;
};

export const useReminders = (filters: ReminderFilters = {}) => {
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const [reminders, setReminders] = useState<ProcessedReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = async () => {
    if (!appUser?.id || activityScope.loading || activityScope.userIds.length === 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('pige_actions')
        .select(`
          id,
          user_id,
          agency_id,
          annonce_id,
          action_type,
          note,
          scheduled_at,
          updated_at,
          annonces!inner(
            id,
            title,
            price,
            city,
            postal_code,
            type_de_bien,
            url,
            image_url,
            image_urls
          )
        `)
        .eq('active', true)
        .in('action_type', ['to_call', 'reminder', 'called', 'rdv'])
        .order('updated_at', { ascending: false });

      query = applyReminderScope(query, activityScope, appUser.id);

      // Apply filters
      if (filters.type) {
        query = query.eq('action_type', filters.type);
      }

      if (filters.period) {
        const now = new Date();
        let dateFrom: Date;
        
        switch (filters.period) {
          case 'today':
            dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            query = query.gte('scheduled_at', dateFrom.toISOString());
            break;
          case 'week':
            dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query = query.gte('scheduled_at', dateFrom.toISOString());
            break;
          case 'month':
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            query = query.gte('scheduled_at', dateFrom.toISOString());
            break;
        }
      }

      if (filters.date_from) {
        query = query.gte('scheduled_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('scheduled_at', filters.date_to);
      }

      let { data, error: queryError } = await query;

      if (queryError && (queryError.code === '42P01' || (queryError.message || '').includes('pige_actions'))) {
        let legacyQuery = supabase
          .from('suivi_annonce')
          .select(`
            id,
            user_id,
            agency_id,
            annonce_id,
            statut,
            note,
            date_suivi,
            annonces!inner(
              id,
              title,
              price,
              city,
              postal_code,
              type_de_bien,
              url,
              image_url,
              image_urls
            )
          `)
          .in('statut', ['to_process', 'to_call', 'called', 'rdv'])
          .order('date_suivi', { ascending: false });

        legacyQuery = applyReminderScope(legacyQuery, activityScope, appUser.id);

        if (filters.type) {
          const legacyType = filters.type === 'to_call' ? 'to_process' : filters.type === 'reminder' ? 'to_call' : filters.type;
          legacyQuery = legacyQuery.eq('statut', legacyType);
        }

        const legacyResult = await legacyQuery;
        data = legacyResult.data?.map((item: any) => ({
          ...item,
          action_type: item.statut === 'to_process' ? 'to_call' : item.statut === 'to_call' ? 'reminder' : item.statut,
          scheduled_at: item.date_suivi,
          updated_at: item.date_suivi,
        }));
        queryError = legacyResult.error;
      }

      if (queryError) throw queryError;

      // Process and transform data
      const processedReminders: ProcessedReminder[] = (data || [])
        .map((item: any) => {
          const reminder: ProcessedReminder = {
            id: item.id,
            user_id: item.user_id,
            actor_name: activityScope.formatActor(item.user_id),
            is_own_action: activityScope.isOwnAction(item.user_id),
            type: item.action_type,
            title: getReminderTitle(item.action_type, item.annonces?.title),
            scheduled_date: item.scheduled_at || item.updated_at,
            status: getReminderStatus(item.action_type, item.scheduled_at || item.updated_at),
            annonce_title: item.annonces?.title || 'Annonce supprimée',
            annonce_id: item.annonce_id,
            annonce_url: item.annonces?.url || '',
            note: item.note,
            city: item.annonces?.city || '',
            price: item.annonces?.price || 0,
            type_de_bien: item.annonces?.type_de_bien || '',
            image_url: item.annonces?.image_url,
            image_urls: item.annonces?.image_urls,
          };
          return reminder;
        })
        .filter((reminder) => {
          // Apply search filter
          if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            return (
              reminder.annonce_title.toLowerCase().includes(searchTerm) ||
              reminder.note?.toLowerCase().includes(searchTerm) ||
              reminder.city.toLowerCase().includes(searchTerm) ||
              reminder.title.toLowerCase().includes(searchTerm)
            );
          }
          return true;
        })
        .filter((reminder) => {
          // Apply status filter
          if (filters.status) {
            return reminder.status === filters.status;
          }
          return true;
        });

      setReminders(processedReminders);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getReminderTitle = (type: string, annonceTitle?: string): string => {
    const shortTitle = annonceTitle ? annonceTitle.substring(0, 50) + '...' : 'Annonce';
    switch (type) {
      case 'to_process':
      case 'to_call':
        return `À appeler : ${shortTitle}`;
      case 'reminder':
        return `À rappeler : ${shortTitle}`;
      case 'called':
        return `Appelé : ${shortTitle}`;
      case 'rdv':
        return `RDV : ${shortTitle}`;
      default:
        return shortTitle;
    }
  };

  const getReminderStatus = (type: string, dateString: string): 'pending' | 'completed' | 'overdue' => {
    if (type === 'called') {
      return 'completed';
    }

    const reminderDate = new Date(dateString);
    const now = new Date();

    if (type === 'reminder' || type === 'rdv') {
      // Pour les rappels et RDV, vérifier si la date est passée
      if (reminderDate < now) {
        return 'overdue';
      }
    }

    return 'pending';
  };

  const updateReminder = async (id: string, updates: Partial<ReminderFromSuivi>) => {
    try {
      const { error } = await supabase
        .from('pige_actions')
        .update({
          action_type: updates.statut,
          note: updates.note,
          scheduled_at: updates.date_suivi,
          user_id: appUser?.id,
          agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        if (isMissingActivityTableError(error)) {
          const { error: legacyError } = await supabase
            .from('suivi_annonce')
            .update({
              ...updates,
              user_id: appUser?.id,
              agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
            })
            .eq('id', id)
            .in('user_id', activityScope.userIds);
          if (legacyError) throw legacyError;
        } else {
          throw error;
        }
      }

      toast.success('Rappel mis à jour');
      fetchReminders();
      return true;
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
      console.error('Error updating reminder:', error);
      return false;
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pige_actions')
        .update({ active: false, user_id: appUser?.id, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        if (isMissingActivityTableError(error)) {
          const { error: legacyError } = await supabase
            .from('suivi_annonce')
            .delete()
            .eq('id', id)
            .in('user_id', activityScope.userIds);
          if (legacyError) throw legacyError;
        } else {
          throw error;
        }
      }

      toast.success('Rappel supprimé');
      fetchReminders();
      return true;
    } catch (error: any) {
      toast.error('Erreur lors de la suppression');
      console.error('Error deleting reminder:', error);
      return false;
    }
  };

  const markAsCompleted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pige_actions')
        .update({ 
          user_id: appUser?.id,
          agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
          action_type: 'called',
          scheduled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        if (isMissingActivityTableError(error)) {
          const { error: legacyError } = await supabase
            .from('suivi_annonce')
            .update({
              user_id: appUser?.id,
              agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
              statut: 'called',
              date_suivi: new Date().toISOString()
            })
            .eq('id', id)
            .in('user_id', activityScope.userIds);
          if (legacyError) throw legacyError;
        } else {
          throw error;
        }
      }

      toast.success('Rappel marqué comme terminé');
      fetchReminders();
      return true;
    } catch (error: any) {
      toast.error('Erreur lors de la mise à jour');
      console.error('Error marking as completed:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [appUser, filters, activityScope.loading, activityScope.userIds.join('|')]);

  return {
    reminders,
    loading,
    error,
    fetchReminders,
    updateReminder,
    deleteReminder,
    markAsCompleted,
  };
};
