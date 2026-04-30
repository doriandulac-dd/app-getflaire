import React, { useState, useEffect } from 'react';
import { X, Save, Bell, Mail, Smartphone } from 'lucide-react';
import { useSurveillance } from '../../hooks/useSurveillance';
import { SurveillanceSettings as SurveillanceSettingsType } from '../../types/surveillance';
import toast from 'react-hot-toast';

interface SurveillanceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const SurveillanceSettings: React.FC<SurveillanceSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings } = useSurveillance();
  const [formData, setFormData] = useState<Partial<SurveillanceSettingsType>>({
    notifications_email: true,
    notifications_app: true,
    notifications_sms: false,
    frequence_email: 'immediate',
    types_modifications: ['prix_change', 'status_change', 'mise_hors_ligne'],
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        notifications_email: settings.notifications_email,
        notifications_app: settings.notifications_app,
        notifications_sms: settings.notifications_sms,
        frequence_email: settings.frequence_email,
        types_modifications: settings.types_modifications,
      });
    }
  }, [settings]);

  const modificationsOptions = [
    { value: 'prix_change', label: 'Changements de prix', icon: '💰' },
    { value: 'description_change', label: 'Modifications de description', icon: '📝' },
    { value: 'title_change', label: 'Modifications du titre', icon: '📋' },
    { value: 'status_change', label: 'Changements de statut', icon: '🔄' },
    { value: 'images_change', label: 'Modifications des photos', icon: '📸' },
    { value: 'mise_en_ligne', label: 'Mise en ligne', icon: '🟢' },
    { value: 'mise_hors_ligne', label: 'Mise hors ligne', icon: '🔴' },
    { value: 'suppression', label: 'Suppression', icon: '🗑️' },
  ];

  const frequenceOptions = [
    { value: 'immediate', label: 'Immédiate' },
    { value: 'daily', label: 'Quotidienne (résumé)' },
    { value: 'weekly', label: 'Hebdomadaire (résumé)' },
  ];

  const handleInputChange = (key: keyof SurveillanceSettingsType, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleModificationToggle = (modificationType: string, checked: boolean) => {
    const currentTypes = formData.types_modifications || [];
    const newTypes = checked
      ? [...currentTypes, modificationType]
      : currentTypes.filter(type => type !== modificationType);
    
    handleInputChange('types_modifications', newTypes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const success = await updateSettings(formData);
      if (success) {
        onClose();
      }
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-secondary-900">
            Paramètres de surveillance
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Types de notifications */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Types de notifications
            </h3>
            
            <div className="space-y-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notifications_email}
                  onChange={(e) => handleInputChange('notifications_email', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <Mail className="h-5 w-5 ml-3 mr-2 text-secondary-500" />
                <span className="text-sm font-medium text-secondary-700">
                  Notifications par email
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notifications_app}
                  onChange={(e) => handleInputChange('notifications_app', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <Bell className="h-5 w-5 ml-3 mr-2 text-secondary-500" />
                <span className="text-sm font-medium text-secondary-700">
                  Notifications dans l'application
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.notifications_sms}
                  onChange={(e) => handleInputChange('notifications_sms', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <Smartphone className="h-5 w-5 ml-3 mr-2 text-secondary-500" />
                <span className="text-sm font-medium text-secondary-700">
                  Notifications par SMS
                </span>
                <span className="ml-2 text-xs text-secondary-500">(bientôt disponible)</span>
              </label>
            </div>
          </div>

          {/* Fréquence des emails */}
          {formData.notifications_email && (
            <div>
              <h3 className="text-lg font-medium text-secondary-900 mb-4">
                Fréquence des emails
              </h3>
              
              <div className="space-y-2">
                {frequenceOptions.map(option => (
                  <label key={option.value} className="flex items-center">
                    <input
                      type="radio"
                      name="frequence_email"
                      value={option.value}
                      checked={formData.frequence_email === option.value}
                      onChange={(e) => handleInputChange('frequence_email', e.target.value)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <span className="ml-3 text-sm text-secondary-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Types de modifications à surveiller */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Types de modifications à surveiller
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {modificationsOptions.map(option => (
                <label key={option.value} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={(formData.types_modifications || []).includes(option.value)}
                    onChange={(e) => handleModificationToggle(option.value, e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-3 mr-2 text-lg">{option.icon}</span>
                  <span className="text-sm font-medium text-secondary-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Informations */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-primary-900 mb-2">
              ℹ️ Informations importantes
            </h4>
            <ul className="text-sm text-primary-800 space-y-1">
              <li>• Les modifications sont détectées automatiquement toutes les heures</li>
              <li>• Les notifications immédiates sont envoyées dès qu'une modification est détectée</li>
              <li>• Les résumés quotidiens/hebdomadaires sont envoyés le matin</li>
              <li>• Vous pouvez modifier ces paramètres à tout moment</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-secondary-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

export default SurveillanceSettings;