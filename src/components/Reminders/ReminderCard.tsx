import React, { useState } from 'react';
import { 
  Clock, 
  Phone, 
  CheckCircle, 
  Calendar, 
  MapPin, 
  Edit3, 
  Trash2, 
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { ProcessedReminder } from '../../types/reminder';
import { useNavigate } from 'react-router-dom';

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

  // Helper function to process a single URL string (handles comma-separated)
  const processSingleUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    // If it's a comma-separated string, take the first part
    if (trimmed.includes(',')) {
      return trimmed.split(',')[0].trim();
    }
    return trimmed;
  };

  const getImageUrl = () => {
    const val = reminder.image_urls;
    if (!val) return null;

    const images: string[] = [];

    // Case 1: val is already an array (e.g., from JSONB directly)
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string' && item.trim()) {
          images.push(processSingleUrl(item));
        }
      }
    }
    // Case 2: val is a string (could be single URL, comma-separated, or JSON stringified)
    else if (typeof val === 'string') {
      // Try parsing as JSON array or object
      if (val.trim().startsWith('[') || val.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string' && item.trim()) {
                images.push(processSingleUrl(item));
              }
            }
          } else if (typeof parsed === 'object' && parsed !== null && typeof parsed.url === 'string' && parsed.url.startsWith('http')) {
            images.push(processSingleUrl(parsed.url));
          }
        } catch {
          // Not a valid JSON, treat as plain string
          if (val.trim()) {
            images.push(processSingleUrl(val));
          }
        }
      } else {
        // Plain string (single URL or comma-separated)
        if (val.trim()) {
          images.push(processSingleUrl(val));
        }
      }
    }

    // On retourne la première qui commence bien par http
    return images.find(x => x.startsWith('http')) || null;
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'to_process':
        return { icon: Clock, label: 'À traiter', color: 'text-orange-600 bg-orange-50 border-orange-200' };
      case 'to_call':
        return { icon: Phone, label: 'À rappeler', color: 'text-blue-600 bg-blue-50 border-blue-200' };
      case 'called':
        return { icon: CheckCircle, label: 'Appelé', color: 'text-green-600 bg-green-50 border-green-200' };
      case 'rdv':
        return { icon: Calendar, label: 'RDV', color: 'text-purple-600 bg-purple-50 border-purple-200' };
      default:
        return { icon: Clock, label: type, color: 'text-gray-600 bg-gray-50 border-gray-200' };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending': return { label: 'À faire', color: 'text-orange-600 bg-orange-50' };
      case 'completed': return { label: 'Terminé', color: 'text-green-600 bg-green-50' };
      case 'overdue': return { label: 'En retard', color: 'text-red-600 bg-red-50' };
      default: return { label: status, color: 'text-gray-600 bg-gray-50' };
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatPrice = (price: number) => {
    if (!price) return "";
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const typeConfig = getTypeConfig(reminder.type);
  const statusConfig = getStatusConfig(reminder.status);
  const TypeIcon = typeConfig.icon;
  const imageUrl = getImageUrl();

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
    <div className="motion-safe-card overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm" data-gsap-reveal>
      {/* Image */}
      {imageUrl && !imageError && (
        <div className="relative h-32 bg-gray-200 rounded-xl overflow-hidden mb-4">
          <img 
            src={imageUrl} 
            alt={reminder.annonce_title || "image annonce"}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg border ${typeConfig.color}`}>
            <TypeIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-medium text-secondary-900 text-sm">
              {typeConfig.label}
            </h3>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {reminder.status === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
              {statusConfig.label}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(reminder)}
            disabled={loading}
            className="p-1.5 text-secondary-500 hover:text-secondary-700 hover:bg-secondary-50 rounded-md transition-colors"
            title="Modifier"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-1.5 text-error-500 hover:text-error-700 hover:bg-error-50 rounded-md transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Annonce info */}
      <div className="mb-3">
        <button
          onClick={() => navigate(`/pige/${reminder.annonce_id}`)}
          className="text-left hover:text-primary-600 transition-colors group"
        >
          <h4 className="font-medium text-secondary-900 group-hover:text-primary-600 line-clamp-2 mb-1">
            {reminder.annonce_title}
          </h4>
        </button>
        
        <div className="flex items-center justify-between text-sm text-secondary-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <MapPin className="h-3 w-3 mr-1" />
              <span>{reminder.city}</span>
            </div>
            {reminder.type_de_bien && (
              <span className="px-2 py-1 bg-secondary-100 text-secondary-700 rounded text-xs">
                {reminder.type_de_bien}
              </span>
            )}
          </div>
          <span className="font-medium text-primary-600">
            {formatPrice(reminder.price)}
          </span>
        </div>
      </div>

      {/* Date and time */}
      <div className="mb-3 rounded-xl bg-gray-50 p-3">
        <div className="flex items-center text-sm text-secondary-700">
          <Calendar className="h-4 w-4 mr-2" />
          <span>
            {reminder.type === 'to_call' || reminder.type === 'rdv'
              ? `Prévu le ${formatDate(reminder.scheduled_date)}`
              : `Créé le ${formatDate(reminder.scheduled_date)}`
            }
          </span>
        </div>
      </div>

      {/* Note */}
      {reminder.note && (
        <div className="mb-3">
          <p className="text-sm text-secondary-600 bg-gray-50 p-2 rounded-md">
            {reminder.note}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          {reminder.annonce_url && (
            <a
              href={reminder.annonce_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs text-secondary-600 hover:text-secondary-700"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Voir annonce
            </a>
          )}
        </div>
        
        {reminder.status === 'pending' && (
          <button
            onClick={handleMarkCompleted}
            disabled={loading}
            className="inline-flex items-center rounded-lg bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Marquer terminé
          </button>
        )}
      </div>
    </div>
  );
};

export default ReminderCard;
