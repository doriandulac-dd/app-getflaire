import React, { useState, useEffect } from 'react';
import { Heart, Clock, Phone, CheckCircle, Calendar, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useActivityScope } from '../../hooks/useActivityScope';
import toast from 'react-hot-toast';

interface PropertyStatus {
  favorite: boolean;
  to_process: boolean;
  to_call: boolean;
  called: boolean;
  rdv: boolean;
  call_date?: string;
  reminder_date?: string;
  reminder_time?: string;
  rdv_date?: string;
  rdv_time?: string;
}

interface PropertyActionsProps {
  annonceId: string;
  initialStatus?: PropertyStatus;
  initialComment?: string;
  onUpdate?: (status: PropertyStatus, comment: string) => void;
}

const PropertyActions: React.FC<PropertyActionsProps> = ({
  annonceId,
  initialStatus = {
    favorite: false,
    to_process: false,
    to_call: false,
    called: false,
    rdv: false,
  },
  initialComment = '',
  onUpdate,
}) => {
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const [status, setStatus] = useState<PropertyStatus>(initialStatus);
  const [comment, setComment] = useState(initialComment);
  const [statusActor, setStatusActor] = useState<string | null>(null);
  const [favoriteActors, setFavoriteActors] = useState<string[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [showRdvModal, setShowRdvModal] = useState(false);
  const [rdvDate, setRdvDate] = useState('');
  const [rdvTime, setRdvTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSuiviId, setCurrentSuiviId] = useState<string | null>(null);
  const [currentFavoriteId, setCurrentFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    if (activityScope.loading) return;
    fetchCurrentStatus();
    fetchFavoriteStatus();
  }, [annonceId, appUser, activityScope.loading, activityScope.userIds.join('|')]);

  const fetchCurrentStatus = async () => {
    if (!appUser) return;

    try {
      const { data, error } = await supabase
        .from('suivi_annonce')
        .select('*')
        .eq('annonce_id', annonceId)
        .in('user_id', activityScope.userIds)
        .order('date_suivi', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCurrentSuiviId(data.id);
        setStatusActor(activityScope.formatActor(data.user_id));
        const newStatus: PropertyStatus = {
          favorite: false, // Will be set by fetchFavoriteStatus
          to_process: data.statut === 'to_process',
          to_call: data.statut === 'to_call',
          called: data.statut === 'called',
          rdv: data.statut === 'rdv',
          call_date: data.statut === 'called' ? data.date_suivi : undefined,
          reminder_date: data.statut === 'to_call' ? data.date_suivi : undefined,
          rdv_date: data.statut === 'rdv' ? data.date_suivi : undefined,
        };
        setStatus(newStatus);
        setComment(data.note || '');
      } else {
        setCurrentSuiviId(null);
        setStatusActor(null);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchFavoriteStatus = async () => {
    if (!appUser) return;

    try {
      const { data, error } = await supabase
        .from('favoris')
        .select('*')
        .eq('annonce_id', annonceId)
        .in('user_id', activityScope.userIds);

      if (error) throw error;

      const ownFavorite = data?.find(favorite => favorite.user_id === appUser.id) || null;
      setFavoriteActors((data || []).map(favorite => activityScope.formatActor(favorite.user_id)));
      if (data?.length) {
        setCurrentFavoriteId(ownFavorite?.id || null);
        setStatus(prev => ({ ...prev, favorite: true }));
      } else {
        setCurrentFavoriteId(null);
        setStatus(prev => ({ ...prev, favorite: false }));
      }
    } catch (error) {
      console.error('Error fetching favorite status:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!appUser) return;

    setLoading(true);
    try {
      if (currentFavoriteId) {
        // Remove from favorites
        const { error } = await supabase
          .from('favoris')
          .delete()
          .eq('id', currentFavoriteId);

        if (error) throw error;

        setCurrentFavoriteId(null);
        setStatus(prev => ({ ...prev, favorite: false }));
        toast.success('Retiré des favoris');
      } else {
        // Add to favorites
        const { data, error } = await supabase
          .from('favoris')
          .insert({
            annonce_id: annonceId,
            user_id: appUser.id,
            agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
            date_favoris: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        setCurrentFavoriteId(data.id);
        setStatus(prev => ({ ...prev, favorite: true }));
        toast.success('Ajouté aux favoris');
      }

      onUpdate?.(status, comment);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des favoris');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: PropertyStatus, newComment: string = comment) => {
    if (!appUser) return;

    setLoading(true);
    try {
      // Determine the main status
      let mainStatus = null;
      if (newStatus.called) mainStatus = 'called';
      else if (newStatus.rdv) mainStatus = 'rdv';
      else if (newStatus.to_call) mainStatus = 'to_call';
      else if (newStatus.to_process) mainStatus = 'to_process';

      const updateData: any = {
        annonce_id: annonceId,
        user_id: appUser.id,
        agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
        statut: mainStatus,
        note: newComment,
        date_suivi: new Date().toISOString(),
      };

      // Include the current suivi ID for upsert
      if (currentSuiviId) {
        updateData.id = currentSuiviId;
      }

      // Add specific dates
      if (newStatus.called && !status.called) {
        updateData.date_suivi = new Date().toISOString();
      } else if (newStatus.to_call && newStatus.reminder_date) {
        updateData.date_suivi = newStatus.reminder_date;
      }

      const result = currentSuiviId
        ? await supabase.from('suivi_annonce').update(updateData).eq('id', currentSuiviId).select('id').single()
        : await supabase.from('suivi_annonce').insert(updateData).select('id').single();
      const { data, error } = result;

      if (error) throw error;

      if (data?.id) setCurrentSuiviId(data.id);
      setStatus(newStatus);
      setComment(newComment);
      setStatusActor(activityScope.formatActor(appUser.id));
      onUpdate?.(newStatus, newComment);
      toast.success('Statut mis à jour');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (action: keyof PropertyStatus) => {
    const newStatus = { ...status };
    
    if (action === 'favorite') {
      toggleFavorite();
      return;
    } else if (action === 'called' && !status.called) {
      // When marking as called, record current timestamp
      newStatus.called = true;
      newStatus.call_date = new Date().toISOString();
      // Reset other statuses
      newStatus.to_process = false;
      newStatus.to_call = false;
    } else if (action === 'called' && status.called) {
      // Remove called status
      newStatus.called = false;
      newStatus.call_date = undefined;
    } else if (action === 'to_call') {
      if (!status.to_call) {
        setShowReminderModal(true);
        return;
      } else {
        newStatus.to_call = false;
        newStatus.reminder_date = undefined;
        newStatus.reminder_time = undefined;
      }
    } else if (action === 'rdv') {
      if (!status.rdv) {
        setShowRdvModal(true);
        return;
      } else {
        newStatus.rdv = false;
        newStatus.rdv_date = undefined;
        newStatus.rdv_time = undefined;
      }
    } else if (action === 'to_process') {
      newStatus.to_process = !status.to_process;
      if (newStatus.to_process) {
        newStatus.called = false;
        newStatus.to_call = false;
        newStatus.rdv = false;
      }
    }

    updateStatus(newStatus);
  };

  const handleReminderSubmit = () => {
    if (!reminderDate || !reminderTime) {
      toast.error('Veuillez sélectionner une date et une heure');
      return;
    }

    // Créer la date en heure locale française
    const reminderDateTime = `${reminderDate}T${reminderTime}:00`;
    const localDate = new Date(reminderDateTime);
    // Convertir en ISO string pour le stockage
    const isoDateTime = localDate.toISOString();
    
    const newStatus = {
      ...status,
      to_call: true,
      reminder_date: isoDateTime,
      reminder_time: reminderTime,
      to_process: false,
      called: false,
    };

    updateStatus(newStatus);
    setShowReminderModal(false);
    setReminderDate('');
    setReminderTime('');
  };

  const handleRdvSubmit = () => {
    if (!rdvDate || !rdvTime) {
      toast.error('Veuillez sélectionner une date et une heure');
      return;
    }

    // Créer la date en heure locale française
    const rdvDateTime = `${rdvDate}T${rdvTime}:00`;
    const localDate = new Date(rdvDateTime);
    // Convertir en ISO string pour le stockage
    const isoDateTime = localDate.toISOString();
    
    const newStatus = {
      ...status,
      rdv: true,
      rdv_date: isoDateTime,
      rdv_time: rdvTime,
      to_process: false,
      to_call: false,
      called: false,
    };

    updateStatus(newStatus);
    setShowRdvModal(false);
    setRdvDate('');
    setRdvTime('');
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    }).format(date);
  };

  const actionButtons = [
    {
      key: 'favorite' as keyof PropertyStatus,
      icon: Heart,
      label: 'Favori',
      color: status.favorite ? 'text-red-500 bg-red-50 border-red-200' : 'text-gray-500 bg-gray-50 border-gray-200',
      activeColor: 'text-red-500 bg-red-50 border-red-200',
    },
    {
      key: 'to_process' as keyof PropertyStatus,
      icon: Clock,
      label: 'À traiter',
      color: status.to_process ? 'text-orange-500 bg-orange-50 border-orange-200' : 'text-gray-500 bg-gray-50 border-gray-200',
      activeColor: 'text-orange-500 bg-orange-50 border-orange-200',
    },
    {
      key: 'to_call' as keyof PropertyStatus,
      icon: Phone,
      label: 'À rappeler',
      color: status.to_call ? 'text-blue-500 bg-blue-50 border-blue-200' : 'text-gray-500 bg-gray-50 border-gray-200',
      activeColor: 'text-blue-500 bg-blue-50 border-blue-200',
    },
    {
      key: 'called' as keyof PropertyStatus,
      icon: CheckCircle,
      label: 'Appelé',
      color: status.called ? 'text-green-500 bg-green-50 border-green-200' : 'text-gray-500 bg-gray-50 border-gray-200',
      activeColor: 'text-green-500 bg-green-50 border-green-200',
    },
    {
      key: 'rdv' as keyof PropertyStatus,
      icon: Calendar,
      label: 'RDV',
      color: status.rdv ? 'text-purple-500 bg-purple-50 border-purple-200' : 'text-gray-500 bg-gray-50 border-gray-200',
      activeColor: 'text-purple-500 bg-purple-50 border-purple-200',
    },
  ];

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">Qualification</p>
            <h3 className="mt-1 font-semibold text-secondary-900">Actions</h3>
          </div>
          {loading && <span className="h-2 w-2 rounded-full bg-primary-500" />}
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {actionButtons.map(({ key, icon: Icon, label, color }) => {
            const isActive = status[key];
            
            return (
              <button
                key={key}
                onClick={() => handleToggle(key)}
                disabled={loading}
                className={`
                  flex min-h-[76px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-all
                  ${isActive ? color : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'}
                  ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="flex w-full items-center justify-between">
                  <Icon className="h-5 w-5" />
                  {isActive && <span className="h-2 w-2 rounded-full bg-current" />}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Details */}
        {(status.called || status.to_call || status.rdv) && (
          <div className="mt-4 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
            {statusActor && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Dernière action :</span>
                <span className="font-medium text-secondary-700">{statusActor}</span>
              </div>
            )}
            {status.called && status.call_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Appelé le :</span>
                <span className="font-medium text-green-700">
                  {formatDateTime(status.call_date)}
                </span>
              </div>
            )}
            {status.to_call && status.reminder_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Rappel prévu :</span>
                <span className="font-medium text-blue-700">
                  {formatDateTime(status.reminder_date)}
                </span>
              </div>
            )}
            {status.rdv && status.rdv_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">RDV prévu :</span>
                <span className="font-medium text-purple-700">
                  {formatDateTime(status.rdv_date)}
                </span>
              </div>
            )}
          </div>
        )}
        {favoriteActors.length > 0 && (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Favori par {favoriteActors.slice(0, 3).join(', ')}
            {favoriteActors.length > 3 ? ` +${favoriteActors.length - 3}` : ''}
          </div>
        )}

        {/* Notes */}
        <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
          <label className="block text-sm font-semibold text-secondary-800">
            Notes
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => updateStatus(status, comment)}
            placeholder="Ajouter un commentaire..."
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900">
                Programmer un rappel
              </h3>
              <button
                onClick={() => setShowReminderModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-primary-400 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Heure
                </label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-primary-400 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowReminderModal(false)}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-secondary-700 transition-colors hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleReminderSubmit}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700"
              >
                Programmer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* RDV Modal */}
      {showRdvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary-900">
                Programmer un RDV
              </h3>
              <button
                onClick={() => setShowRdvModal(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={rdvDate}
                  onChange={(e) => setRdvDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-primary-400 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Heure
                </label>
                <input
                  type="time"
                  value={rdvTime}
                  onChange={(e) => setRdvTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:border-primary-400 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowRdvModal(false)}
                className="flex-1 rounded-xl bg-gray-100 px-4 py-2 text-secondary-700 transition-colors hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleRdvSubmit}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-2 text-white transition-colors hover:bg-primary-700"
              >
                Programmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PropertyActions;
