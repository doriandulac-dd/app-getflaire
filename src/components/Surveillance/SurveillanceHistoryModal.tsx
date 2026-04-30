import React, { useState, useEffect } from 'react';
import { X, Clock, TrendingUp, TrendingDown, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useSurveillance } from '../../hooks/useSurveillance';
import { SurveillanceHistorique } from '../../types/surveillance';

interface SurveillanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  surveillanceId: string;
  annonceTitle: string;
}

const SurveillanceHistoryModal: React.FC<SurveillanceHistoryModalProps> = ({
  isOpen,
  onClose,
  surveillanceId,
  annonceTitle,
}) => {
  const { getSurveillanceHistory } = useSurveillance();
  const [history, setHistory] = useState<SurveillanceHistorique[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && surveillanceId) {
      fetchHistory();
    }
  }, [isOpen, surveillanceId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getSurveillanceHistory(surveillanceId);
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModificationIcon = (type: string) => {
    switch (type) {
      case 'prix_change':
        return <TrendingUp className="h-5 w-5 text-primary-600" />;
      case 'mise_en_ligne':
        return <Eye className="h-5 w-5 text-success-600" />;
      case 'mise_hors_ligne':
        return <EyeOff className="h-5 w-5 text-warning-600" />;
      case 'suppression':
        return <AlertCircle className="h-5 w-5 text-error-600" />;
      default:
        return <Clock className="h-5 w-5 text-secondary-600" />;
    }
  };

  const getModificationLabel = (type: string) => {
    const labels: Record<string, string> = {
      prix_change: 'Changement de prix',
      description_change: 'Modification de description',
      title_change: 'Modification du titre',
      status_change: 'Changement de statut',
      images_change: 'Modification des photos',
      mise_en_ligne: 'Mise en ligne',
      mise_hors_ligne: 'Mise hors ligne',
      suppression: 'Suppression',
    };
    return labels[type] || type;
  };

  const getModificationColor = (type: string) => {
    switch (type) {
      case 'prix_change':
        return 'bg-primary-50 border-primary-200';
      case 'mise_en_ligne':
        return 'bg-success-50 border-success-200';
      case 'mise_hors_ligne':
        return 'bg-warning-50 border-warning-200';
      case 'suppression':
        return 'bg-error-50 border-error-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatPrice = (price: string) => {
    const num = parseFloat(price);
    if (isNaN(num)) return price;
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const renderModificationDetails = (modification: SurveillanceHistorique) => {
    switch (modification.type_modification) {
      case 'prix_change':
        const oldPrice = modification.ancienne_valeur ? parseFloat(modification.ancienne_valeur) : 0;
        const newPrice = modification.nouvelle_valeur ? parseFloat(modification.nouvelle_valeur) : 0;
        const priceDiff = newPrice - oldPrice;
        const pricePercent = oldPrice > 0 ? ((priceDiff / oldPrice) * 100) : 0;
        
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-600">Ancien prix:</span>
              <span className="font-medium">{formatPrice(modification.ancienne_valeur || '0')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-600">Nouveau prix:</span>
              <span className="font-medium">{formatPrice(modification.nouvelle_valeur || '0')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-600">Variation:</span>
              <span className={`font-medium flex items-center ${priceDiff > 0 ? 'text-error-600' : 'text-success-600'}`}>
                {priceDiff > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {formatPrice(Math.abs(priceDiff).toString())} ({pricePercent > 0 ? '+' : ''}{pricePercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        );
      
      case 'description_change':
      case 'title_change':
        return (
          <div className="space-y-2">
            {modification.ancienne_valeur && (
              <div>
                <span className="text-sm text-secondary-600">Ancien:</span>
                <p className="text-sm bg-gray-100 p-2 rounded mt-1 whitespace-pre-wrap">
                  {modification.ancienne_valeur}
                </p>
              </div>
            )}
            {modification.nouvelle_valeur && (
              <div>
                <span className="text-sm text-secondary-600">Nouveau:</span>
                <p className="text-sm bg-primary-50 p-2 rounded mt-1 whitespace-pre-wrap">
                  {modification.nouvelle_valeur}
                </p>
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div className="text-sm text-secondary-600">
            {modification.nouvelle_valeur || 'Modification détectée'}
          </div>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-xl font-semibold text-secondary-900">
              Historique des modifications
            </h2>
            <p className="text-sm text-secondary-600 mt-1">
              {annonceTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-start space-x-4">
                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-secondary-900">
                Aucune modification détectée
              </h3>
              <p className="mt-1 text-sm text-secondary-500">
                Cette annonce n'a pas encore subi de modifications depuis sa mise sous surveillance.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((modification, index) => (
                <div
                  key={modification.id}
                  className={`relative border rounded-lg p-4 ${getModificationColor(modification.type_modification)}`}
                >
                  {/* Timeline line */}
                  {index < history.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-6 bg-gray-300"></div>
                  )}
                  
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      {getModificationIcon(modification.type_modification)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-secondary-900">
                          {getModificationLabel(modification.type_modification)}
                        </h4>
                        <span className="text-xs text-secondary-500">
                          {formatDate(modification.date_modification)}
                        </span>
                      </div>
                      
                      {renderModificationDetails(modification)}
                      
                      {modification.detecte_le !== modification.date_modification && (
                        <div className="mt-2 text-xs text-secondary-500">
                          Détecté le {formatDate(modification.detecte_le)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary-100 text-secondary-700 rounded-md hover:bg-secondary-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default SurveillanceHistoryModal;