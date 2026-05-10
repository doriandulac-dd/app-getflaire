import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useActivityScope } from './useActivityScope';
import { ReminderFromSuivi, ReminderFilters, ProcessedReminder } from '../types/reminder';
import toast from 'react-hot-toast';

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
            image_urls
          )
        `)
        .in('user_id', activityScope.userIds)
        .in('statut', ['to_process', 'to_call', 'called', 'rdv'])
        .order('date_suivi', { ascending: false });

      // Apply filters
      if (filters.type) {
        query = query.eq('statut', filters.type);
      }

      if (filters.period) {
        const now = new Date();
        let dateFrom: Date;
        
        switch (filters.period) {
          case 'today':
            dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            query = query.gte('date_suivi', dateFrom.toISOString());
            break;
          case 'week':
            dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query = query.gte('date_suivi', dateFrom.toISOString());
            break;
          case 'month':
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            query = query.gte('date_suivi', dateFrom.toISOString());
            break;
        }
      }

      if (filters.date_from) {
        query = query.gte('date_suivi', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('date_suivi', filters.date_to);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      // Process and transform data
      const processedReminders: ProcessedReminder[] = (data || [])
        .map((item: any) => {
          const reminder: ProcessedReminder = {
            id: item.id,
            user_id: item.user_id,
            actor_name: activityScope.formatActor(item.user_id),
            is_own_action: activityScope.isOwnAction(item.user_id),
            type: item.statut,
            title: getReminderTitle(item.statut, item.annonces?.title),
            scheduled_date: item.date_suivi,
            status: getReminderStatus(item.statut, item.date_suivi),
            annonce_title: item.annonces?.title || 'Annonce supprimée',
            annonce_id: item.annonce_id,
            annonce_url: item.annonces?.url || '',
            note: item.note,
            city: item.annonces?.city || '',
            price: item.annonces?.price || 0,
            type_de_bien: item.annonces?.type_de_bien || '',
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
        return `À traiter : ${shortTitle}`;
      case 'to_call':
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

    if (type === 'to_call' || type === 'rdv') {
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
        .from('suivi_annonce')
        .update({
          ...updates,
          user_id: appUser?.id,
          agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
        })
        .eq('id', id)
        .in('user_id', activityScope.userIds);

      if (error) throw error;

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
        .from('suivi_annonce')
        .delete()
        .eq('id', id)
        .in('user_id', activityScope.userIds);

      if (error) throw error;

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
        .from('suivi_annonce')
        .update({ 
          user_id: appUser?.id,
          agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
          statut: 'called',
          date_suivi: new Date().toISOString()
        })
        .eq('id', id)
        .in('user_id', activityScope.userIds);

      if (error) throw error;

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
