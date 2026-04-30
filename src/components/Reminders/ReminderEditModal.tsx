import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Clock, MessageSquare } from 'lucide-react';
import { ProcessedReminder } from '../../types/reminder';

interface ReminderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: ProcessedReminder | null;
  onSave: (id: string, updates: any) => Promise<boolean>;
}

const ReminderEditModal: React.FC<ReminderEditModalProps> = ({
  isOpen,
  onClose,
  reminder,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    note: '',
    type: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reminder && isOpen) {
      const date = new Date(reminder.scheduled_date);
      setFormData({
        date: date.toISOString().split('T')[0],
        time: date.toTimeString().slice(0, 5),
        note: reminder.note || '',
        type: reminder.type,
      });
    }
  }, [reminder, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminder) return;

    if (!formData.date || !formData.time) {
      alert('Veuillez sélectionner une date et une heure');
      return;
    }

    setLoading(true);
    
    const dateTime = `${formData.date}T${formData.time}:00`;
    const localDate = new Date(dateTime);
    const isoDateTime = localDate.toISOString();

    const success = await onSave(reminder.id, {
      date_suivi: isoDateTime,
      note: formData.note,
      statut: formData.type,
    });

    if (success) {
      onClose();
    }
    
    setLoading(false);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'to_process': return 'À traiter';
      case 'to_call': return 'À rappeler';
      case 'called': return 'Appelé';
      case 'rdv': return 'RDV';
      default: return type;
    }
  };

  if (!isOpen || !reminder) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-secondary-900">
            Modifier le rappel
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type (read-only) */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Type de rappel
            </label>
            <select
              value={formData.type || reminder.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="to_process">À traiter</option>
              <option value="to_call">À rappeler</option>
              <option value="called">Appelé</option>
              <option value="rdv">RDV</option>
            </select>
          </div>

          {/* Annonce (read-only) */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Annonce
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-secondary-600 line-clamp-2">
              {reminder.annonce_title}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <Clock className="h-4 w-4 inline mr-1" />
              Heure
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              Note
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="Ajouter une note..."
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-secondary-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderEditModal;