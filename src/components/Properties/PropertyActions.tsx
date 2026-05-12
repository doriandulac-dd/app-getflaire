import React, { useState, useEffect } from 'react';
import { Heart, Clock, Phone, CheckCircle, Calendar, Pencil, Trash2, X, MessageSquare } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useActivityScope } from '../../hooks/useActivityScope';
import toast from 'react-hot-toast';
import {
  deletePropertyFavorite,
  fetchPropertyFavorites,
  savePropertyFavorite,
  type PropertyFavoriteRow,
} from '../../utils/propertyFavorites';
import {
  deletePropertyNote,
  deletePropertyAction,
  fetchPropertyActivity,
  savePropertyAction,
  savePropertyNote,
  updatePropertyNote,
  type PropertyActionRow,
  type PropertyNoteRow,
} from '../../utils/propertyActivities';

interface PropertyStatus {
  favorite: boolean;
  to_call: boolean;
  called: boolean;
  reminder: boolean;
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
    to_call: false,
    called: false,
    reminder: false,
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
  const [favoriteRows, setFavoriteRows] = useState<PropertyFavoriteRow[]>([]);
  const [activityRows, setActivityRows] = useState<PropertyActionRow[]>([]);
  const [notes, setNotes] = useState<PropertyNoteRow[]>([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [showRdvModal, setShowRdvModal] = useState(false);
  const [rdvDate, setRdvDate] = useState('');
  const [rdvTime, setRdvTime] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentFavoriteId, setCurrentFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    if (activityScope.loading) return;
    fetchCurrentActivity();
    fetchFavoriteStatus();
  }, [annonceId, appUser, activityScope.loading, activityScope.userIds.join('|')]);

  const fetchCurrentActivity = async () => {
    if (!appUser) return;

    try {
      const data = await fetchPropertyActivity({
        annonceId,
        userId: appUser.id,
        activityScope,
      });

      setStatusActor(data.statusActor ? activityScope.formatActor(data.statusActor) : null);
      setActivityRows(data.actions);
      setNotes(data.notes);
      setComment('');
      setStatus(prev => ({
        ...prev,
        to_call: data.to_call,
        called: data.called,
        reminder: data.reminder,
        rdv: data.rdv,
        call_date: data.calledAt || undefined,
        reminder_date: data.reminderAt || undefined,
        rdv_date: data.rdvAt || undefined,
      }));
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const fetchFavoriteStatus = async () => {
    if (!appUser) return;

    try {
      const data = await fetchPropertyFavorites({
        annonceId,
        userId: appUser.id,
        activityScope,
      });

      setFavoriteRows(data || []);
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
        await deletePropertyFavorite({ annonceId, userId: appUser.id, activityScope });

        setCurrentFavoriteId(null);
        setStatus(prev => ({ ...prev, favorite: false }));
        toast.success('Retiré des favoris');
      } else {
        // Add to favorites
        const data = await savePropertyFavorite({ annonceId, userId: appUser.id, activityScope });

        setCurrentFavoriteId(data.id);
        setStatus(prev => ({ ...prev, favorite: true }));
        toast.success('Ajouté aux favoris');
      }

      onUpdate?.(status, comment);
    } catch (error) {
      console.error('[favorite-update] actions update failed', error);
      toast.error('Erreur lors de la mise à jour des favoris');
    } finally {
      setLoading(false);
    }
  };

  const toggleAction = async (
    action: 'to_call' | 'called' | 'reminder' | 'rdv',
    enabled: boolean,
    scheduledAt?: string
  ) => {
    if (!appUser) return;

    setLoading(true);
    try {
      if (enabled) {
        await savePropertyAction({
          annonceId,
          userId: appUser.id,
          activityScope,
          actionType: action,
          scheduledAt: scheduledAt || (action === 'called' ? new Date().toISOString() : undefined),
        });
      } else {
        await deletePropertyAction({
          annonceId,
          userId: appUser.id,
          activityScope,
          actionType: action,
        });
      }
      await fetchCurrentActivity();
      toast.success('Action mise à jour');
    } catch (error) {
      console.error('[status-update] actions update failed', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (action: keyof PropertyStatus) => {
    if (action === 'favorite') {
      toggleFavorite();
      return;
    }

    if (action === 'called') {
      toggleAction('called', !status.called);
      return;
    }

    if (action === 'to_call') {
      toggleAction('to_call', !status.to_call);
      return;
    }

    if (action === 'reminder') {
      if (!status.reminder) {
        setShowReminderModal(true);
        return;
      }
      toggleAction('reminder', false);
      return;
    }

    if (action === 'rdv') {
      if (!status.rdv) {
        setShowRdvModal(true);
        return;
      }
      toggleAction('rdv', false);
    }
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
    
    toggleAction('reminder', true, isoDateTime);
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
    
    toggleAction('rdv', true, isoDateTime);
    setShowRdvModal(false);
    setRdvDate('');
    setRdvTime('');
  };

  const handleSaveNote = async () => {
    if (!appUser || !comment.trim()) return;

    setLoading(true);
    try {
      if (editingNoteId) {
        await updatePropertyNote({
          noteId: editingNoteId,
          annonceId,
          userId: appUser.id,
          activityScope,
          content: comment,
        });
      } else {
        await savePropertyNote({
          annonceId,
          userId: appUser.id,
          activityScope,
          content: comment,
        });
      }
      setComment('');
      setEditingNoteId(null);
      await fetchCurrentActivity();
      toast.success(editingNoteId ? 'Note mise à jour' : 'Note ajoutée');
    } catch (error) {
      console.error('[pige-activity] note save failed', error);
      toast.error(editingNoteId ? 'Erreur lors de la mise à jour de la note' : 'Erreur lors de l’ajout de la note');
    } finally {
      setLoading(false);
    }
  };

  const handleEditNote = (note: PropertyNoteRow) => {
    setEditingNoteId(note.id);
    setComment(note.content);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!appUser) return;

    setLoading(true);
    try {
      await deletePropertyNote({
        noteId,
        annonceId,
        userId: appUser.id,
        activityScope,
      });
      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setComment('');
      }
      await fetchCurrentActivity();
      toast.success('Note supprimée');
    } catch (error) {
      console.error('[pige-activity] note delete failed', error);
      toast.error('Erreur lors de la suppression de la note');
    } finally {
      setLoading(false);
    }
  };

  const cancelNoteEdition = () => {
    setEditingNoteId(null);
    setComment('');
  };

  const openReminderEdition = () => {
    if (status.reminder_date) {
      const reminderDateValue = new Date(status.reminder_date);
      setReminderDate(reminderDateValue.toISOString().split('T')[0]);
      setReminderTime(reminderDateValue.toTimeString().slice(0, 5));
    }
    setShowReminderModal(true);
  };

  const deleteReminder = () => {
    toggleAction('reminder', false);
  };

  const buildTimeline = () => {
    const favoritesTimeline = favoriteRows.map((favorite) => ({
      id: `favorite-${favorite.id}`,
      label: 'Favori ajouté',
      actor: activityScope.formatActor(favorite.user_id),
      date: favorite.date_favoris || null,
      tone: 'text-red-700 bg-red-50 border-red-100',
    }));

    const actionsTimeline = activityRows.map((action) => {
      const labelMap: Record<string, string> = {
        to_call: 'Annonce marquée à appeler',
        called: 'Annonce marquée appelée',
        reminder: 'Rappel programmé',
        rdv: 'RDV programmé',
        hidden: 'Annonce masquée',
        viewed: 'Annonce consultée',
      };

      return {
        id: `action-${action.id}`,
        label: labelMap[action.action_type] || action.action_type,
        actor: activityScope.formatActor(action.user_id),
        date: action.scheduled_at || action.updated_at || action.created_at || null,
        tone: 'text-secondary-700 bg-secondary-50 border-secondary-100',
      };
    });

    const notesTimeline = notes.map((note) => ({
      id: `note-${note.id}`,
      label: 'Note ajoutée',
      actor: activityScope.formatActor(note.user_id),
      date: note.updated_at || note.created_at || null,
      tone: 'text-blue-700 bg-blue-50 border-blue-100',
    }));

    return [...favoritesTimeline, ...actionsTimeline, ...notesTimeline].sort((a, b) =>
      new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  };

  const timelineItems = buildTimeline().slice(0, 8);

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
      key: 'to_call' as keyof PropertyStatus,
      icon: Clock,
      label: 'À appeler',
      color: status.to_call ? 'text-orange-500 bg-orange-50 border-orange-200' : 'text-gray-500 bg-gray-50 border-gray-200',
      activeColor: 'text-orange-500 bg-orange-50 border-orange-200',
    },
    {
      key: 'reminder' as keyof PropertyStatus,
      icon: Phone,
      label: 'À rappeler',
      color: status.reminder ? 'text-blue-500 bg-blue-50 border-blue-200' : 'text-gray-500 bg-gray-50 border-gray-200',
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
        {(status.called || status.reminder || status.rdv || status.to_call) && (
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
            {status.to_call && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Prospection :</span>
                <span className="font-medium text-orange-700">À appeler</span>
              </div>
            )}
            {status.reminder && status.reminder_date && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Rappel prévu :</span>
                  <span className="font-medium text-blue-700">
                    {formatDateTime(status.reminder_date)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openReminderEdition}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={deleteReminder}
                    className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
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
            placeholder="Ajouter une note horodatée..."
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={loading || !comment.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-secondary-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-secondary-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageSquare className="h-4 w-4" />
            {editingNoteId ? 'Mettre à jour la note' : 'Ajouter la note'}
          </button>
          {editingNoteId && (
            <button
              type="button"
              onClick={cancelNoteEdition}
              className="ml-2 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-secondary-700 transition hover:bg-gray-50"
            >
              Annuler
            </button>
          )}
          {notes.length > 0 && (
            <div className="space-y-2">
              {notes.slice(0, 6).map((note) => (
                <div key={note.id} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-2 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-secondary-500">
                    <span>{activityScope.formatActor(note.user_id)}</span>
                    {note.created_at && <span>{formatDateTime(note.created_at)}</span>}
                  </div>
                  <p className="whitespace-pre-wrap text-secondary-700">{note.content}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditNote(note)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-secondary-700 transition hover:bg-gray-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {timelineItems.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
            <label className="block text-sm font-semibold text-secondary-800">
              Historique des actions
            </label>
            <div className="space-y-2">
              {timelineItems.map((item) => (
                <div key={item.id} className={`rounded-xl border px-3 py-2 text-sm ${item.tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{item.label}</span>
                    {item.date && <span className="text-xs font-semibold opacity-80">{formatDateTime(item.date)}</span>}
                  </div>
                  <p className="mt-1 text-xs font-semibold opacity-80">Par {item.actor}</p>
                </div>
              ))}
            </div>
          </div>
        )}
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
