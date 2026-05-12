import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Edit3,
  ExternalLink,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ProcessedReminder } from '../../types/reminder';

interface ReminderCardProps {
  reminder: ProcessedReminder;
  onEdit: (reminder: ProcessedReminder) => void;
  onDelete: (id: string) => void;
  onMarkCompleted: (id: string) => void;
}

const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onEdit,
  onDelete,
  onMarkCompleted,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = useMemo(() => {
    const processSingleUrl = (url: string): string => {
      if (!url || typeof url !== 'string') return '';
      const trimmed = url.trim();
      return trimmed.includes(',') ? trimmed.split(',')[0].trim() : trimmed;
    };

    const value = reminder.image_urls;
    if (!value) return null;

    const images: string[] = [];

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string' && item.trim()) images.push(processSingleUrl(item));
      });
    } else if (typeof value === 'string') {
      if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              if (typeof item === 'string' && item.trim()) images.push(processSingleUrl(item));
            });
          } else if (typeof parsed === 'object' && parsed !== null && typeof parsed.url === 'string') {
            images.push(processSingleUrl(parsed.url));
          }
        } catch {
          if (value.trim()) images.push(processSingleUrl(value));
        }
      } else if (value.trim()) {
        images.push(processSingleUrl(value));
      }
    }

    return images.find((item) => item.startsWith('http')) || null;
  }, [reminder.image_urls]);

  const typeConfig = useMemo(() => {
    switch (reminder.type) {
      case 'to_call':
        return { icon: Clock, label: 'À appeler', className: 'bg-orange-50 text-orange-700 ring-orange-200' };
      case 'reminder':
        return { icon: Phone, label: 'À rappeler', className: 'bg-blue-50 text-blue-700 ring-blue-200' };
      case 'called':
        return { icon: CheckCircle, label: 'Appelé', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
      case 'rdv':
        return { icon: Calendar, label: 'RDV', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' };
      default:
        return { icon: Clock, label: reminder.type, className: 'bg-secondary-50 text-secondary-700 ring-secondary-200' };
    }
  }, [reminder.type]);

  const statusConfig = useMemo(() => {
    switch (reminder.status) {
      case 'pending':
        return { label: 'À faire', className: 'bg-primary-50 text-primary-700 ring-primary-200' };
      case 'completed':
        return { label: 'Terminé', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' };
      case 'overdue':
        return { label: 'En retard', className: 'bg-red-50 text-red-700 ring-red-200' };
      default:
        return { label: reminder.status, className: 'bg-secondary-50 text-secondary-700 ring-secondary-200' };
    }
  }, [reminder.status]);

  const schedule = useMemo(() => {
    const date = new Date(reminder.scheduled_date);
    if (isNaN(date.getTime())) {
      return { label: 'Date non renseignée', relative: '' };
    }

    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const label = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    let relative = "Aujourd'hui";
    if (diffDays < 0) relative = `En retard de ${Math.abs(diffDays)} jour${Math.abs(diffDays) > 1 ? 's' : ''}`;
    if (diffDays > 0) relative = `Dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;

    return { label, relative };
  }, [reminder.scheduled_date]);

  const formatPrice = (price: number) => {
    if (!price) return '';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const TypeIcon = typeConfig.icon;

  const handleMarkCompleted = async () => {
    setLoading(true);
    await onMarkCompleted(reminder.id);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce rappel ?')) {
      setLoading(true);
      await onDelete(reminder.id);
      setLoading(false);
    }
  };

  return (
    <article className="group overflow-hidden rounded-3xl border border-white bg-white shadow-sm ring-1 ring-secondary-100 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-secondary-900/10">
      <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
        <button
          type="button"
          onClick={() => navigate(`/pige/${reminder.annonce_id}`)}
          className="relative min-h-56 overflow-hidden bg-secondary-100 text-left lg:min-h-full"
        >
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={reminder.annonce_title || 'image annonce'}
              className="h-full min-h-56 w-full object-cover transition duration-700 group-hover:scale-105"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full min-h-56 w-full items-center justify-center bg-gradient-to-br from-secondary-100 to-secondary-200 text-sm font-bold text-secondary-400">
              Pas d'image
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-secondary-950/75 via-secondary-950/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1 ${typeConfig.className}`}>
              <TypeIcon className="h-3.5 w-3.5" />
              {typeConfig.label}
            </span>
            <p className="mt-3 line-clamp-2 text-lg font-black leading-tight text-white">{reminder.annonce_title}</p>
          </div>
        </button>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1 ${statusConfig.className}`}>
                  {reminder.status === 'overdue' && <AlertCircle className="h-3.5 w-3.5" />}
                  {statusConfig.label}
                </span>
                {reminder.actor_name && (
                  <span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-bold text-secondary-700">
                    Par {reminder.actor_name}
                  </span>
                )}
                {reminder.type_de_bien && (
                  <span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-bold text-secondary-700">
                    {reminder.type_de_bien}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/pige/${reminder.annonce_id}`)}
                className="mt-3 text-left"
              >
                <h3 className="line-clamp-2 text-xl font-black leading-tight text-secondary-950 transition group-hover:text-primary-700">
                  {reminder.title || reminder.annonce_title}
                </h3>
              </button>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-secondary-500">
                {reminder.city && (
                  <span className="inline-flex items-center">
                    <MapPin className="mr-1.5 h-4 w-4 text-primary-500" />
                    {reminder.city}
                  </span>
                )}
                {formatPrice(reminder.price) && (
                  <span className="font-black text-primary-700">{formatPrice(reminder.price)}</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-secondary-100 bg-secondary-50/80 p-3 text-sm">
              <div className="flex items-center gap-2 font-black text-secondary-950">
                <Calendar className="h-4 w-4 text-primary-500" />
                {schedule.label}
              </div>
              <p className={`mt-1 text-xs font-bold ${reminder.status === 'overdue' ? 'text-red-600' : 'text-secondary-500'}`}>
                {schedule.relative}
              </p>
            </div>
          </div>

          {reminder.note && (
            <div className="rounded-2xl border border-primary-100 bg-primary-50 p-3 text-sm text-primary-900">
              <div className="mb-1 flex items-center gap-2 font-black">
                <MessageSquare className="h-4 w-4" />
                Note
              </div>
              <p className="leading-6">{reminder.note}</p>
            </div>
          )}

          <div className="mt-auto flex flex-col gap-3 border-t border-secondary-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(reminder)}
                disabled={loading}
                className="inline-flex items-center rounded-2xl border border-secondary-200 bg-white px-3 py-2 text-sm font-bold text-secondary-700 transition hover:border-primary-200 hover:text-primary-700 disabled:opacity-50"
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Modifier
              </button>
              {reminder.annonce_url && (
                <a
                  href={reminder.annonce_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-2xl border border-secondary-200 bg-white px-3 py-2 text-sm font-bold text-secondary-700 transition hover:border-primary-200 hover:text-primary-700"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Source
                </a>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </button>
            </div>

            {reminder.status === 'pending' || reminder.status === 'overdue' ? (
              <button
                type="button"
                onClick={handleMarkCompleted}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? (
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Terminer
              </button>
            ) : (
              <span className="inline-flex items-center rounded-2xl bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Action terminée
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default ReminderCard;
