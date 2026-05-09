import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Clock, Mail, Save, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { useSurveillance } from '../../hooks/useSurveillance';
import { SurveillanceSettings as SurveillanceSettingsType } from '../../types/surveillance';
import { gsap } from '../../lib/animations';
import toast from 'react-hot-toast';

interface SurveillanceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type SurveillanceSettingValue = SurveillanceSettingsType[keyof SurveillanceSettingsType];

const modificationsOptions = [
  { value: 'prix_change', label: 'Changements de prix', short: 'Prix' },
  { value: 'description_change', label: 'Modifications de description', short: 'Description' },
  { value: 'title_change', label: 'Modifications du titre', short: 'Titre' },
  { value: 'status_change', label: 'Changements de statut', short: 'Statut' },
  { value: 'images_change', label: 'Modifications des photos', short: 'Photos' },
  { value: 'mise_en_ligne', label: 'Mise en ligne', short: 'En ligne' },
  { value: 'mise_hors_ligne', label: 'Mise hors ligne', short: 'Hors ligne' },
  { value: 'suppression', label: 'Suppression', short: 'Suppression' },
];

const frequenceOptions = [
  { value: 'immediate', label: 'Immédiate', description: 'Alerte dès détection' },
  { value: 'daily', label: 'Quotidienne', description: 'Résumé chaque matin' },
  { value: 'weekly', label: 'Hebdomadaire', description: 'Synthèse de la semaine' },
];

const SurveillanceSettings: React.FC<SurveillanceSettingsProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useSurveillance();
  const modalRef = useRef<HTMLDivElement | null>(null);
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

  useGSAP(
    () => {
      if (!isOpen) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('[data-settings-backdrop], [data-settings-modal], [data-settings-item]', { autoAlpha: 1, y: 0, scale: 1 });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('[data-settings-backdrop]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 })
          .fromTo('[data-settings-modal]', { autoAlpha: 0, y: 30, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42 }, '<')
          .fromTo('[data-settings-item]', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.32, stagger: 0.04 }, '-=0.18');
      });

      return () => mm.revert();
    },
    { scope: modalRef, dependencies: [isOpen], revertOnUpdate: true }
  );

  const handleInputChange = (key: keyof SurveillanceSettingsType, value: SurveillanceSettingValue) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleModificationToggle = (modificationType: string, checked: boolean) => {
    const currentTypes = formData.types_modifications || [];
    const newTypes = checked
      ? [...currentTypes, modificationType]
      : currentTypes.filter((type) => type !== modificationType);

    handleInputChange('types_modifications', newTypes);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const success = await updateSettings(formData);
      if (success) {
        onClose();
      }
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const notificationChannels = [
    {
      key: 'notifications_app' as const,
      title: "Dans l'application",
      description: 'Notifications visibles dans GetFlaire',
      icon: Bell,
      disabled: false,
    },
    {
      key: 'notifications_email' as const,
      title: 'Email',
      description: 'Recevoir les changements importants',
      icon: Mail,
      disabled: false,
    },
    {
      key: 'notifications_sms' as const,
      title: 'SMS',
      description: 'Bientôt disponible',
      icon: Smartphone,
      disabled: false,
    },
  ];

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        data-settings-backdrop
        aria-label="Fermer les paramètres"
        onClick={onClose}
        className="absolute inset-0 bg-secondary-950/70 backdrop-blur-sm"
      />

      <div
        data-settings-modal
        className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
      >
        <div className="relative overflow-hidden bg-secondary-950 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,183,77,0.25),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.12),transparent_28%)]" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Surveillance
              </div>
              <h2 className="text-2xl font-black tracking-tight">Paramètres de surveillance</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary-200">
                Choisissez les canaux et les changements à surveiller pour rester réactif sans bruit inutile.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-150px)] overflow-y-auto p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <section data-settings-item className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Canaux</p>
                <h3 className="mt-1 text-lg font-black text-secondary-950">Notifications</h3>
              </div>

              <div className="space-y-3">
                {notificationChannels.map((channel) => {
                  const Icon = channel.icon;
                  const checked = Boolean(formData[channel.key]);
                  return (
                    <button
                      key={channel.key}
                      type="button"
                      disabled={channel.disabled}
                      onClick={() => handleInputChange(channel.key, !checked)}
                      className={`flex w-full items-center gap-3 rounded-3xl border p-4 text-left transition ${
                        checked
                          ? 'border-primary-200 bg-primary-50 text-primary-900 shadow-sm'
                          : 'border-secondary-100 bg-secondary-50/70 text-secondary-700 hover:border-secondary-200 hover:bg-white'
                      } ${channel.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <span className={`rounded-2xl p-3 ${checked ? 'bg-primary-500 text-white' : 'bg-white text-secondary-500'}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-black">{channel.title}</span>
                        <span className="block text-xs font-medium text-secondary-500">{channel.description}</span>
                      </span>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full ${checked ? 'bg-primary-500 text-white' : 'bg-white text-secondary-300 ring-1 ring-secondary-200'}`}>
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {formData.notifications_email && (
                <div data-settings-item className="rounded-3xl border border-secondary-100 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary-500" />
                    <h3 className="text-sm font-black text-secondary-950">Fréquence email</h3>
                  </div>
                  <div className="space-y-2">
                    {frequenceOptions.map((option) => {
                      const selected = formData.frequence_email === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleInputChange('frequence_email', option.value)}
                          className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? 'border-secondary-950 bg-secondary-950 text-white'
                              : 'border-secondary-100 bg-secondary-50 text-secondary-700 hover:bg-white'
                          }`}
                        >
                          <span className="block text-sm font-black">{option.label}</span>
                          <span className={`block text-xs font-medium ${selected ? 'text-secondary-200' : 'text-secondary-500'}`}>
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section data-settings-item className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Détection</p>
                <h3 className="mt-1 text-lg font-black text-secondary-950">Types de modifications</h3>
                <p className="mt-1 text-sm font-medium text-secondary-500">
                  {formData.types_modifications?.length || 0} type{(formData.types_modifications?.length || 0) > 1 ? 's' : ''} sélectionné{(formData.types_modifications?.length || 0) > 1 ? 's' : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {modificationsOptions.map((option) => {
                  const selected = (formData.types_modifications || []).includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleModificationToggle(option.value, !selected)}
                      className={`rounded-3xl border p-4 text-left transition ${
                        selected
                          ? 'border-primary-200 bg-primary-50 text-primary-900 shadow-sm'
                          : 'border-secondary-100 bg-secondary-50/70 text-secondary-700 hover:border-secondary-200 hover:bg-white'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <span className="block text-sm font-black">{option.short}</span>
                          <span className="mt-1 block text-xs font-medium text-secondary-500">{option.label}</span>
                        </span>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${selected ? 'bg-primary-500 text-white' : 'bg-white text-secondary-300 ring-1 ring-secondary-200'}`}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div data-settings-item className="rounded-3xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-900">
                <p className="font-black">À savoir</p>
                <p className="mt-1 leading-6">
                  Les modifications sont détectées automatiquement. Les alertes immédiates partent dès qu'un changement surveillé est repéré, selon vos canaux actifs.
                </p>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col gap-3 border-t border-secondary-100 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end lg:-mx-6 lg:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-secondary-100 px-5 py-3 text-sm font-bold text-secondary-700 transition hover:bg-secondary-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-2xl bg-primary-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
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
