import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Square, 
  Bed, 
  Phone, 
  Heart, 
  Clock, 
  CheckCircle,
  Eye,
  EyeOff,
  TrendingUp
} from 'lucide-react';
import { Annonce, AnnonceStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useSurveillance } from '../../hooks/useSurveillance';
import toast from 'react-hot-toast';

interface PropertyCardProps {
  annonce: Annonce;
  onStatusChange?: (annonceId: string, status: AnnonceStatus['status']) => void;
  showSurveillanceButton?: boolean;
  onCardClick?: (annonceId: string) => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ 
  annonce, 
  onStatusChange, 
  showSurveillanceButton = false,
  onCardClick
}) => {
  const { appUser } = useAuth();
  const { isSurveilled } = useSurveillance();
  const navigate = useNavigate();
  const [currentStatus, setCurrentStatus] = useState<{
    favorite: boolean;
    to_process: boolean;
    to_call: boolean;
    called: boolean;
    hidden: boolean;
  }>({
    favorite: false,
    to_process: false,
    to_call: false,
    called: false,
    hidden: false,
  });
  const [loading, setLoading] = useState(false);
  const [isUnderSurveillance, setIsUnderSurveillance] = useState(false);

  useEffect(() => {
    if (appUser) {
      fetchCurrentStatus();
      if (showSurveillanceButton) {
        checkSurveillanceStatus();
      }
    }
    // eslint-disable-next-line
  }, [annonce.id, appUser]);

  const checkSurveillanceStatus = async () => {
    const surveilled = await isSurveilled(annonce.id);
    setIsUnderSurveillance(surveilled);
  };

  // NOUVELLE FONCTION CENTRALISÉE DE SURVEILLANCE
  const handleAddToSurveillance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);

    try {
      if (isUnderSurveillance) {
        // Désactiver la surveillance (update active=false)
        const { data: surveillanceData, error: fetchError } = await supabase
          .from('surveillances')
          .select('id')
          .eq('user_id', appUser?.id)
          .eq('annonce_id', annonce.id)
          .eq('active', true)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (surveillanceData) {
          // Mettre active à false
          const { error: updateError } = await supabase
            .from('surveillances')
            .update({ active: false })
            .eq('id', surveillanceData.id);

          if (updateError) throw updateError;
          toast.success('Surveillance arrêtée');
          await checkSurveillanceStatus();
        } else {
          toast.error('Aucune surveillance active trouvée');
        }
      } else {
        // Activer (ou réactiver) la surveillance
        // 1. Cherche si une ligne existe déjà (même inactive)
        const { data: existing, error: fetchError } = await supabase
          .from('surveillances')
          .select('id, active')
          .eq('user_id', appUser?.id)
          .eq('annonce_id', annonce.id)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existing) {
          // Si la surveillance existe déjà, réactive-la
          const { error: updateError } = await supabase
            .from('surveillances')
            .update({ active: true })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          toast.success('Surveillance réactivée');
        } else {
          // Sinon, insert une nouvelle surveillance
          const { error: insertError } = await supabase
            .from('surveillances')
            .insert({
              user_id: appUser?.id,
              annonce_id: annonce.id,
              active: true,
              created_at: new Date().toISOString(),
            });

          if (insertError) throw insertError;
          toast.success('Annonce surveillée');
        }
        await checkSurveillanceStatus();
      }
    } catch {
      toast.error('Erreur lors du changement de surveillance');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentStatus = async () => {
    if (!appUser) return;

    try {
      // Fetch suivi_annonce status
      const { data: suiviData } = await supabase
        .from('suivi_annonce')
        .select('*')
        .eq('annonce_id', annonce.id)
        .eq('user_id', appUser.id)
        .order('date_suivi', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch favorite status
      const { data: favoriteData } = await supabase
        .from('favoris')
        .select('*')
        .eq('annonce_id', annonce.id)
        .eq('user_id', appUser.id)
        .maybeSingle();

      setCurrentStatus({
        favorite: !!favoriteData,
        to_process: suiviData?.statut === 'to_process',
        to_call: suiviData?.statut === 'to_call',
        called: suiviData?.statut === 'called',
        hidden: suiviData?.statut === 'hidden',
      });
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const statusConfig = {
    favorite: { 
      icon: Heart, 
      color: currentStatus.favorite ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50', 
      label: 'Favori' 
    },
    to_process: { 
      icon: Clock, 
      color: currentStatus.to_process ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50', 
      label: 'À traiter' 
    },
    to_call: { 
      icon: Phone, 
      color: currentStatus.to_call ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50', 
      label: 'À rappeler' 
    },
    called: { 
      icon: CheckCircle, 
      color: currentStatus.called ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50', 
      label: 'Appelé' 
    },
    hidden: { 
      icon: EyeOff, 
      color: currentStatus.hidden ? 'text-gray-600 bg-gray-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50', 
      label: 'Masqué' 
    },
  };

  const urgencyConfig = {
    normal: { color: 'bg-gray-100 text-gray-800', label: 'Normale' },
    urgent: { color: 'bg-red-600 text-white shadow-lg border border-red-700', label: 'Urgente' },
  };

  const handleStatusChange = async (statusKey: keyof typeof currentStatus) => {
    if (!appUser) return;
    
    setLoading(true);
    try {
      if (statusKey === 'favorite') {
        if (currentStatus.favorite) {
          // Remove from favorites
          const { error } = await supabase
            .from('favoris')
            .delete()
            .eq('annonce_id', annonce.id)
            .eq('user_id', appUser.id);

          if (error) throw error;
          toast.success('Retiré des favoris');
        } else {
          // Add to favorites
          const { error } = await supabase
            .from('favoris')
            .insert({
              annonce_id: annonce.id,
              user_id: appUser.id,
              date_favoris: new Date().toISOString(),
            });

          if (error) throw error;
          toast.success('Ajouté aux favoris');
        }
      } else {
        // Handle other statuses
        let statut = null;
        if (statusKey === 'called') statut = 'called';
        else if (statusKey === 'to_call') statut = 'to_call';
        else if (statusKey === 'to_process') statut = 'to_process';
        else if (statusKey === 'hidden') statut = 'hidden';

        const { error } = await supabase
          .from('suivi_annonce')
          .upsert({
            annonce_id: annonce.id,
            user_id: appUser.id,
            statut: statut,
            date_suivi: new Date().toISOString(),
          });

        if (error) throw error;
        toast.success(`Statut mis à jour : ${statusConfig[statusKey].label}`);
      }

      // Refresh status
      await fetchCurrentStatus();
      onStatusChange?.(annonce.id, statusKey as AnnonceStatus['status']);
    } catch {
      toast.error('Erreur lors de la mise à jour du statut');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (statusKey: keyof typeof currentStatus) => {
    if (statusKey === 'favorite') {
      await handleStatusChange('favorite');
    } else {
      // For other statuses, toggle them
      const newStatus = !currentStatus[statusKey];
      if (newStatus) {
        await handleStatusChange(statusKey);
      } else {
        // Remove status by setting it to null
        setLoading(true);
        try {
          const { error } = await supabase
            .from('suivi_annonce')
            .delete()
            .eq('annonce_id', annonce.id)
            .eq('user_id', appUser.id);

          if (error) throw error;
          await fetchCurrentStatus();
          toast.success('Statut supprimé');
        } catch {
          toast.error('Erreur lors de la suppression du statut');
        } finally {
          setLoading(false);
        }
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

  const getUrgencyLevel = () => {
    if (annonce.urgence || annonce.urgence_detectee) {
      return 'urgent';
    }
    return 'normal';
  };

  const getImageUrl = () => {
    if (annonce.image_url) {
      return annonce.image_url;
    }
    return null;
  };
  return (
    <div 
      className="motion-safe-card group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm cursor-pointer"
      data-gsap-reveal
      onClick={() => {
        if (onCardClick) {
          onCardClick(annonce.id);
        } else {
          navigate(`/pige/${annonce.id}`);
        }
      }}
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-200 overflow-hidden">
        {getImageUrl() ? (
          <img 
            src={getImageUrl()!} 
            alt={annonce.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-400">Pas d'image</span>
          </div>
        )}
        
        {/* Urgency badge - only show if urgent */}
        {getUrgencyLevel() === 'urgent' && (
          <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium ${urgencyConfig[getUrgencyLevel()].color}`}>
            {urgencyConfig[getUrgencyLevel()].label}
          </div>
        )}

        {/* Source badge */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-secondary-900/90 backdrop-blur text-white rounded-full text-xs font-medium">
          {annonce.source}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2 gap-2">
          <h3
            className="font-semibold text-secondary-900 text-sm flex-1 leading-5"
            title={annonce.title}
          >
            {annonce.title}
          </h3>
          <span className="text-lg font-bold text-primary-600 flex-shrink-0">
            {formatPrice(annonce.price)}
          </span>
        </div>

        {/* Property type */}
        {annonce.type_de_bien && (
          <div className="mb-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
              {annonce.type_de_bien}
            </span>
            {/* Owner type */}
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 ${
              annonce.owner_type === 'Particulier' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-orange-100 text-orange-800'
            }`}>
              {annonce.owner_type}
            </span>
            {/* Online status */}
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ml-2 ${
              annonce.en_ligne === true
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {annonce.en_ligne === true ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
        )}

        
        <div className="flex items-center text-secondary-500 text-sm mb-3">
          <MapPin className="h-4 w-4 mr-1" />
          <span>{annonce.city} ({annonce.postal_code})</span>
        </div>

        <div className="flex items-center space-x-4 text-sm text-secondary-600 mb-4">
          <div className="flex items-center">
            <Square className="h-4 w-4 mr-1" />
            <span>{annonce.size} m²</span>
          </div>
          <div className="flex items-center">
            <Bed className="h-4 w-4 mr-1" />
            <span>{annonce.rooms} pièces</span>
          </div>
          {/* Afficher le nombre de modifications si disponible */}
          {annonce.nb_modifications !== undefined && annonce.nb_modifications > 0 && (
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-1 text-primary-500" />
              <span className="text-primary-600 font-medium">{annonce.nb_modifications} modif{annonce.nb_modifications > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="border-t border-gray-100 pt-3 mb-4">
          <div className="flex items-center justify-between text-sm text-secondary-600">
            <div className="flex items-center">
              <Phone className="h-4 w-4 mr-1" />
              <span className="whitespace-nowrap">{annonce.phone}</span>
            </div>
            <span className="text-xs text-secondary-400 text-right">
              {annonce.published_relative}
            </span>
          </div>
        </div>

        {/* Status actions */}
        <div className="flex items-center justify-between">
          {showSurveillanceButton ? (
            // Mode surveillance - seulement le bouton de surveillance
            <div className="flex items-center justify-center w-full">
              <button
                onClick={handleAddToSurveillance}
                disabled={loading}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors font-medium
                  ${isUnderSurveillance 
                    ? 'text-red-700 bg-red-100 hover:bg-red-200 border border-red-200' 
                    : 'text-primary-700 bg-primary-100 hover:bg-primary-200 border border-primary-200'
                  }
                `}
              >
                <Eye className="h-4 w-4" />
                <span className="text-sm">
                  {isUnderSurveillance ? 'Arrêter surveillance' : 'Surveiller'}
                </span>
              </button>
            </div>
          ) : (
            // Mode normal - tous les boutons de statut
            <div className="flex space-x-1 flex-1">
              {Object.entries(statusConfig).map(([statusKey, config]) => {
                const Icon = config.icon;
                const isActive = currentStatus[statusKey as keyof typeof currentStatus];
                
                return (
                  <button
                    key={statusKey}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStatus(statusKey as keyof typeof currentStatus);
                    }}
                    disabled={loading}
                    className={`
                      relative p-2 rounded-lg transition-colors
                      ${config.color}
                    `}
                    title={config.label}
                  >
                    <Icon className="h-4 w-4" />
                    {isActive && (
                      <div className="absolute -top-1 -right-1 h-2 w-2 bg-current rounded-full"></div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!showSurveillanceButton && (
            <button 
              className="rounded-lg px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50"
              onClick={(e) => {
                e.stopPropagation();
                if (onCardClick) {
                  onCardClick(annonce.id);
                } else {
                  navigate(`/pige/${annonce.id}`);
                }
              }}
            >
              Voir détails
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
