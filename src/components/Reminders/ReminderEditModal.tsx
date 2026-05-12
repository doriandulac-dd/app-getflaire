import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Check, Clock, MessageSquare, Save, X } from 'lucide-react';
import { useGSAP } from '@gsap/react';
import { ProcessedReminder, ReminderFromSuivi } from '../../types/reminder';
import { gsap } from '../../lib/animations';

interface ReminderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: ProcessedReminder | null;
  onSave: (id: string, updates: Partial<ReminderFromSuivi>) => Promise<boolean>;
}

const typeOptions = [
  { value: 'to_call', label: 'À appeler' },
  { value: 'reminder', label: 'À rappeler' },
  { value: 'called', label: 'Appelé' },
  { value: 'rdv', label: 'RDV' },
] as const;

const ReminderEditModal: React.FC<ReminderEditModalProps> = ({
  isOpen,
  onClose,
  reminder,
  onSave,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    note: '',
    type: 'reminder' as ReminderFromSuivi['statut'],
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

  useGSAP(
    () => {
      if (!isOpen) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('[data-reminder-modal-backdrop], [data-reminder-modal], [data-reminder-modal-item]', {
          autoAlpha: 1,
          y: 0,
          scale: 1,
        });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.fromTo('[data-reminder-modal-backdrop]', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 })
          .fromTo(
            '[data-reminder-modal]',
            { autoAlpha: 0, y: 28, scale: 0.97 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.42 },
            '<'
          )
          .fromTo(
            '[data-reminder-modal-item]',
            { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.04 },
            '-=0.16'
          );
      });

      return () => mm.revert();
    },
    { scope: modalRef, dependencies: [isOpen], revertOnUpdate: true }
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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

  if (!isOpen || !reminder) return null;

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <button
        type="button"
        data-reminder-modal-backdrop
        aria-label="Fermer la modification du rappel"
        onClick={onClose}
        className="absolute inset-0 bg-secondary-950/70 backdrop-blur-sm"
      />

      <div data-reminder-modal className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="relative overflow-hidden bg-secondary-950 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,183,77,0.26),transparent_36%),radial-gradient(circle_at_85%_0%,rgba(255,255,255,0.12),transparent_30%)]" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary-100">
                <Calendar className="h-3.5 w-3.5" />
                Relance
              </div>
              <h2 className="text-2xl font-black tracking-tight">Modifier le rappel</h2>
              <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-6 text-secondary-200">{reminder.annonce_title}</p>
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

        <form onSubmit={handleSubmit} className="space-y-5 p-5 lg:p-6">
          <section data-reminder-modal-item>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-secondary-500">Type de rappel</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {typeOptions.map((option) => {
                const selected = formData.type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: option.value }))}
                    className={`rounded-2xl px-3 py-3 text-sm font-black ring-1 transition ${
                      selected
                        ? 'bg-secondary-950 text-white ring-secondary-950'
                        : 'bg-secondary-50 text-secondary-700 ring-secondary-100 hover:bg-secondary-100'
                    }`}
                  >
                    {selected && <Check className="mr-1 inline h-3.5 w-3.5" />}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <div data-reminder-modal-item className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.16em] text-secondary-500">
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                Date
              </span>
              <input
                type="date"
                value={formData.date}
                onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className="w-full rounded-2xl border border-secondary-200 bg-secondary-50/80 px-4 py-3 text-sm font-medium outline-none transition focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.16em] text-secondary-500">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Heure
              </span>
              <input
                type="time"
                value={formData.time}
                onChange={(event) => setFormData((prev) => ({ ...prev, time: event.target.value }))}
                className="w-full rounded-2xl border border-secondary-200 bg-secondary-50/80 px-4 py-3 text-sm font-medium outline-none transition focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
                required
              />
            </label>
          </div>

          <label data-reminder-modal-item className="block">
            <span className="mb-2 flex items-center text-xs font-black uppercase tracking-[0.16em] text-secondary-500">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Note
            </span>
            <textarea
              value={formData.note}
              onChange={(event) => setFormData((prev) => ({ ...prev, note: event.target.value }))}
              rows={4}
              className="w-full resize-none rounded-2xl border border-secondary-200 bg-secondary-50/80 px-4 py-3 text-sm font-medium outline-none transition placeholder:text-secondary-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
              placeholder="Ajouter une note de contexte, objection, disponibilité..."
            />
          </label>

          <div className="flex flex-col gap-3 border-t border-secondary-100 pt-5 sm:flex-row sm:justify-end">
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

export default ReminderEditModal;
