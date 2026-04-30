import React, { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Square, 
  Bed, 
  ExternalLink, 
  Trash2, 
  TrendingUp,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { SurveillanceWithDetails } from '../../types/surveillance';
import { useSurveillance } from '../../hooks/useSurveillance';
import { supabase } from '../../lib/supabase';
import SurveillanceHistoryModal from './SurveillanceHistoryModal';

interface SurveillanceCardProps {
  surveillance: SurveillanceWithDetails;
  onRemove: () => void;
  onCardClick?: (annonceId: string) => void;
}

const SurveillanceCard: React.FC<SurveillanceCardProps> = ({ surveillance, onRemove, onCardClick }) => {
  const navigate = useNavigate();
  const { removeFromSurveillance } = useSurveillance();
  const [showHistory, setShowHistory] = useState(false);
  const [modificationsCount, setModificationsCount] = useState<number>(0);
  const [loadingModifications, setLoadingModifications] = useState(true);

  // Fetch modifications count from annonce_logs
  useEffect(() => {
    const fetchModificationsCount = async () => {
      if (!surveillance.annonce_id) {
        setLoadingModifications(false);
        return;
      }

      try {
        const { count, error } = await supabase
          .from('annonce_logs')
          .select('*', { count: 'exact', head: true })
          .eq('annonce_id', surveillance.annonce_id);

        if (error) throw error;
        setModificationsCount(count || 0);
      } catch (error) {
        console.error('Error fetching modifications count:', error);
        setModificationsCount(0);
      } finally {
        setLoadingModifications(false);
      }
    };

    fetchModificationsCount();
  }, [surveillance.annonce_id]);
  const handleRemove = async () => {
    if (confirm('Êtes-vous sûr de vouloir retirer cette annonce de la surveillance ?')) {
      const success = await removeFromSurveillance(surveillance.id);
      if (success) {
        onRemove();
      }
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);
  };

  const getDaysSincePublication = () => {
    if (!surveillance.publication_date) return null;
    const pubDate = new Date(surveillance.publication_date);
    if (isNaN(pubDate.getTime())) return null;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - pubDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = () => {
    if (surveillance.supprimee) return 'bg-red-100 text-red-800';
    if (!surveillance.en_ligne) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = () => {
    if (surveillance.supprimee) return 'Supprimée';
    if (!surveillance.en_ligne) return 'Hors ligne';
    return 'En ligne';
  };

  // Fonction utilitaire pour traiter une URL qui peut contenir plusieurs URLs séparées par des virgules
  const processSingleUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.includes(',')) {
      return trimmed.split(',')[0].trim();
    }
    return trimmed;
  };

const getImageUrl = () => {
    // 1. image_url (string ou tableau)
    if (surveillance.image_url) {
      if (typeof surveillance.image_url === 'string' && surveillance.image_url.trim()) {
        return processSingleUrl(surveillance.image_url);
      } 
      if (Array.isArray(surveillance.image_url) && surveillance.image_url.length > 0) {
        const firstImage = surveillance.image_url[0];
        if (typeof firstImage === 'string' && firstImage.trim()) {
          return processSingleUrl(firstImage);
        }
      }
    }
    // 2. image_urls (JSON string ou tableau)
    if (surveillance.image_urls) {
      try {
        let images: string[] = [];
        if (typeof surveillance.image_urls === 'string') {
          const parsed = JSON.parse(surveillance.image_urls);
          if (Array.isArray(parsed)) {
            if (parsed.length === 1 && typeof parsed[0] === 'string' && parsed[0].includes(',')) {
              images = parsed[0].split(',').map(url => url.trim()).filter(Boolean);
            } else {
              images = parsed.filter(url => url && typeof url === 'string');
            }
          }
        } else if (Array.isArray(surveillance.image_urls)) {
          images = surveillance.image_urls.filter(url => url && typeof url === 'string');
        }
        if (images.length > 0) {
          return processSingleUrl(images[0]);
        }
      } catch {
        // ignore
      }
    }
    return null;
  };

  return (
    <>
      <div 
        className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => {
          if (onCardClick) {
            onCardClick(surveillance.annonce_id);
          } else {
            navigate(`/pige/${surveillance.annonce_id}`);
          }
        }}
      >
        {/* Image */}
        <div className="relative h-48 bg-gray-200 rounded-t-lg overflow-hidden">
          {getImageUrl() ? (
            <img 
              src={getImageUrl()!} 
              alt={surveillance.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-gray-400">Pas d'image</span>
            </div>
          )}
          
          {/* Status badge */}
          <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>

          {/* Source badge */}
          <div className="absolute top-3 right-3 px-2 py-1 bg-secondary-900 text-white rounded-full text-xs font-medium">
            {surveillance.source}
          </div>

          {/* Modifications badge */}
          {!loadingModifications && modificationsCount > 0 && (
            <div className="absolute bottom-3 left-3 px-2 py-1 bg-primary-600 text-white rounded-full text-xs font-medium flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              {modificationsCount} modif{modificationsCount > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2 gap-2">
            <h3
              className="font-semibold text-secondary-900 text-sm flex-1 flex items-center"
              title={surveillance.title}
            >
              {surveillance.title}
              {!loadingModifications && modificationsCount > 0 && (
                <AlertCircle className="h-4 w-4 ml-2 text-warning-600 flex-shrink-0" title={`${modificationsCount} modification${modificationsCount > 1 ? 's' : ''} détectée${modificationsCount > 1 ? 's' : ''}`} />
              )}
            </h3>
            <span className="text-lg font-bold text-primary-600 flex-shrink-0">
              {formatPrice(surveillance.price)}
            </span>
          </div>

          {/* Property type */}
          {surveillance.type_de_bien && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                {surveillance.type_de_bien}
              </span>
            </div>
          )}

          <div className="flex items-center text-secondary-500 text-sm mb-3">
            <MapPin className="h-4 w-4 mr-1" />
            <span>{surveillance.city}</span>
          </div>

          <div className="flex items-center space-x-4 text-sm text-secondary-600 mb-4">
            <div className="flex items-center">
              <Square className="h-4 w-4 mr-1" />
              <span>{surveillance.size} m²</span>
            </div>
            <div className="flex items-center">
              <Bed className="h-4 w-4 mr-1" />
              <span>{surveillance.rooms} pièces</span>
            </div>
          </div>

          {/* Surveillance info */}
          <div className="border-t border-gray-100 pt-3 mb-4">
            <div className="flex items-center justify-between text-sm text-secondary-600 mb-2">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                <span>Surveillée depuis le {formatDate(surveillance.date_surveillance)}</span>
              </div>
            </div>

            {getDaysSincePublication() !== null && (
              <div className="flex items-center text-xs text-secondary-600 mb-2">
                <Calendar className="h-3 w-3 mr-1" />
                <span>
                  En ligne depuis {getDaysSincePublication()} jour{getDaysSincePublication() !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {surveillance.derniere_modification && (
              <div className="flex items-center text-xs text-warning-600">
                <AlertCircle className="h-3 w-3 mr-1" />
                <span>
                  Dernière modif: {surveillance.type_derniere_modification} le {formatDate(surveillance.derniere_modification)}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Ouvre l'annonce externe (pas de popup)
                  window.open(surveillance.annonce_url, '_blank');
                }}
                className="p-2 text-secondary-600 hover:text-secondary-700 hover:bg-secondary-50 rounded-md transition-colors"
                title="Voir l'annonce originale"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="p-2 text-error-600 hover:text-error-700 hover:bg-error-50 rounded-md transition-colors"
                title="Retirer de la surveillance"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <button 
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              onClick={(e) => {
                e.stopPropagation();
                if (onCardClick) {
                  onCardClick(surveillance.annonce_id);
                } else {
                  navigate(`/pige/${surveillance.annonce_id}`);
                }
              }}
            >
              Voir détails
            </button>
          </div>
        </div>
      </div>

      {/* Modal Historique */}
      <SurveillanceHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        surveillanceId={surveillance.id}
        annonceTitle={surveillance.title}
      />
    </>
  );
};

export default SurveillanceCard;
