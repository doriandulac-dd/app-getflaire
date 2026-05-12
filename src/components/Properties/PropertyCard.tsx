import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bed,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  Heart,
  MapPin,
  Phone,
  Square,
  TrendingUp,
} from 'lucide-react';
import { Annonce, AnnonceStatus } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useSurveillance } from '../../hooks/useSurveillance';
import { useActivityScope } from '../../hooks/useActivityScope';
import toast from 'react-hot-toast';
import { deletePropertyFavorite, fetchPropertyFavorites, savePropertyFavorite } from '../../utils/propertyFavorites';
import { deletePropertyAction, fetchPropertyActivity, savePropertyAction } from '../../utils/propertyActivities';

interface PropertyCardProps {
  annonce: Annonce;
  onStatusChange?: (annonceId: string, status: AnnonceStatus['status']) => void;
  showSurveillanceButton?: boolean;
  onCardClick?: (annonceId: string) => void;
  variant?: 'grid' | 'list';
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  annonce,
  onStatusChange,
  showSurveillanceButton = false,
  onCardClick,
  variant = 'grid',
}) => {
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const { isSurveilled } = useSurveillance();
  const navigate = useNavigate();
  const [currentStatus, setCurrentStatus] = useState({
    favorite: false,
    to_call: false,
    called: false,
    reminder: false,
    hidden: false,
    viewed: false,
  });
  const [statusActor, setStatusActor] = useState<string | null>(annonce.activity_actor || null);
  const [favoriteActors, setFavoriteActors] = useState<string[]>(annonce.favorite_actors || []);
  const [currentOwnFavoriteId, setCurrentOwnFavoriteId] = useState<string | null>(null);
  const [nextActionAt, setNextActionAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUnderSurveillance, setIsUnderSurveillance] = useState(false);

  useEffect(() => {
    if (appUser && !activityScope.loading) {
      fetchCurrentStatus();
      if (showSurveillanceButton) {
        checkSurveillanceStatus();
      }
    }
    // eslint-disable-next-line
  }, [annonce.id, appUser, activityScope.loading, activityScope.userIds.join('|')]);

  const checkSurveillanceStatus = async () => {
    const surveilled = await isSurveilled(annonce.id);
    setIsUnderSurveillance(surveilled);
  };

  const handleAddToSurveillance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);

    try {
      if (isUnderSurveillance) {
        const { data: surveillanceData, error: fetchError } = await supabase
          .from('surveillances')
          .select('id')
          .eq('annonce_id', annonce.id)
          .eq('active', true)
          .in('user_id', activityScope.userIds)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (surveillanceData) {
          const { error: updateError } = await supabase
            .from('surveillances')
            .update({ active: false, user_id: appUser?.id, agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null })
            .eq('id', surveillanceData.id);

          if (updateError) throw updateError;
          toast.success('Surveillance arretee');
          await checkSurveillanceStatus();
        } else {
          toast.error('Aucune surveillance active trouvee');
        }
      } else {
        const { data: existing, error: fetchError } = await supabase
          .from('surveillances')
          .select('id, active')
          .eq('annonce_id', annonce.id)
          .in('user_id', activityScope.userIds)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existing) {
          const { error: updateError } = await supabase
            .from('surveillances')
            .update({ active: true, user_id: appUser?.id, agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null })
            .eq('id', existing.id);

          if (updateError) throw updateError;
          toast.success('Surveillance reactivee');
        } else {
          const { error: insertError } = await supabase.from('surveillances').insert({
            user_id: appUser?.id,
            agency_id: activityScope.isAgencyScope ? activityScope.agencyId : null,
            annonce_id: annonce.id,
            active: true,
            created_at: new Date().toISOString(),
          });

          if (insertError) throw insertError;
          toast.success('Annonce surveillee');
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
      const activityData = await fetchPropertyActivity({
        annonceId: annonce.id,
        userId: appUser.id,
        activityScope,
      });

      const favoriteData = await fetchPropertyFavorites({
        annonceId: annonce.id,
        userId: appUser.id,
        activityScope,
      });

      const ownFavorite = favoriteData?.find(favorite => favorite.user_id === appUser.id) || null;
      setCurrentOwnFavoriteId(ownFavorite?.id || null);
      setStatusActor(activityData.statusActor ? activityScope.formatActor(activityData.statusActor) : null);
      setFavoriteActors((favoriteData || []).map(favorite => activityScope.formatActor(favorite.user_id)));

      setCurrentStatus({
        favorite: Boolean(favoriteData?.length),
        to_call: activityData.to_call,
        called: activityData.called,
        reminder: activityData.reminder,
        hidden: activityData.hidden,
        viewed: activityData.viewed,
      });
      setNextActionAt(activityData.reminderAt || activityData.rdvAt || null);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const statusConfig = {
    favorite: {
      icon: Heart,
      color: currentStatus.favorite
        ? 'text-red-500 bg-red-50 border-red-100'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-transparent',
      label: 'Favori',
    },
    to_call: {
      icon: Clock,
      color: currentStatus.to_call
        ? 'text-orange-500 bg-orange-50 border-orange-100'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-transparent',
      label: 'A appeler',
    },
    reminder: {
      icon: Phone,
      color: currentStatus.reminder
        ? 'text-blue-500 bg-blue-50 border-blue-100'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-transparent',
      label: 'A rappeler',
    },
    called: {
      icon: CheckCircle,
      color: currentStatus.called
        ? 'text-green-500 bg-green-50 border-green-100'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-transparent',
      label: 'Appele',
    },
    hidden: {
      icon: EyeOff,
      color: currentStatus.hidden
        ? 'text-gray-600 bg-gray-100 border-gray-200'
        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-transparent',
      label: 'Masque',
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
        if (currentOwnFavoriteId) {
          await deletePropertyFavorite({
            annonceId: annonce.id,
            userId: appUser.id,
            activityScope,
          });
          toast.success('Retire des favoris');
        } else {
          await savePropertyFavorite({
            annonceId: annonce.id,
            userId: appUser.id,
            activityScope,
          });
          toast.success('Ajoute aux favoris');
        }
      } else {
        await savePropertyAction({
          annonceId: annonce.id,
          userId: appUser.id,
          activityScope,
          actionType: statusKey as 'to_call' | 'called' | 'reminder' | 'hidden',
        });
        toast.success(`Statut mis a jour : ${statusConfig[statusKey].label}`);
      }

      await fetchCurrentStatus();
      onStatusChange?.(annonce.id, statusKey as AnnonceStatus['status']);
    } catch (error) {
      console.error(statusKey === 'favorite' ? '[favorite-update] card update failed' : '[status-update] card update failed', error);
      toast.error(statusKey === 'favorite' ? 'Erreur lors de la mise a jour du favori' : 'Erreur lors de la mise a jour du statut');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (statusKey: keyof typeof currentStatus) => {
    if (!appUser) return;

    if (statusKey === 'favorite') {
      await handleStatusChange('favorite');
    } else {
      const newStatus = !currentStatus[statusKey];
      if (newStatus) {
        await handleStatusChange(statusKey);
      } else {
        setLoading(true);
        try {
          await deletePropertyAction({
            annonceId: annonce.id,
            userId: appUser.id,
            activityScope,
            actionType: statusKey as 'to_call' | 'called' | 'reminder' | 'hidden',
          });
          await fetchCurrentStatus();
          toast.success('Statut supprime');
        } catch (error) {
          console.error('[status-update] card delete failed', error);
          toast.error('Erreur lors de la suppression du statut');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);

  const getUrgencyLevel = () => ((annonce.urgence || annonce.urgence_detectee) ? 'urgent' : 'normal');

  const getImageUrl = () => {
    if (annonce.image_url) {
      if (Array.isArray(annonce.image_url)) return annonce.image_url[0] || null;
      return annonce.image_url;
    }
    if (annonce.image_urls) {
      if (Array.isArray(annonce.image_urls)) return annonce.image_urls[0] || null;
      return annonce.image_urls;
    }
    return null;
  };

  const openDetails = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onCardClick) {
      onCardClick(annonce.id);
    } else {
      navigate(`/pige/${annonce.id}`);
    }
  };

  const isList = variant === 'list';
  const imageUrl = getImageUrl();
  const urgency = getUrgencyLevel();
  const nextActionLabel = nextActionAt
    ? new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(nextActionAt))
    : null;
  const isNewAnnonce = (() => {
    const detectedAt = new Date(annonce.created_at || annonce.publication_date);
    if (isNaN(detectedAt.getTime())) return false;
    return Date.now() - detectedAt.getTime() <= 2 * 24 * 60 * 60 * 1000;
  })();

  return (
    <div
      className={`motion-safe-card group cursor-pointer overflow-hidden border border-gray-200 bg-white shadow-sm transition-all ${
        isList ? 'rounded-3xl' : 'rounded-[28px]'
      }`}
      data-gsap-reveal
      onClick={() => openDetails()}
    >
      <div className={isList ? 'flex flex-col lg:flex-row' : ''}>
        <div className={`relative overflow-hidden bg-gray-100 ${isList ? 'lg:h-auto lg:w-[280px] lg:flex-shrink-0' : 'h-52'}`}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={annonce.title}
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                isList ? 'min-h-[220px]' : ''
              }`}
            />
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-gray-400">
              Pas d'image
            </div>
          )}

          {urgency === 'urgent' && (
            <div className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${urgencyConfig[urgency].color}`}>
              {urgencyConfig[urgency].label}
            </div>
          )}

          <div className="absolute right-4 top-4 rounded-full bg-secondary-900/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            {annonce.source}
          </div>
        </div>

        <div className={`flex flex-1 flex-col ${isList ? 'p-5 lg:p-6' : 'p-4'}`}>
          <div className={`flex gap-4 ${isList ? 'flex-col xl:flex-row xl:items-start xl:justify-between' : 'flex-col'}`}>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {annonce.type_de_bien && (
                  <span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-semibold text-secondary-800">
                    {annonce.type_de_bien}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    annonce.owner_type === 'Particulier'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-orange-50 text-orange-700'
                  }`}
                >
                  {annonce.owner_type}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    annonce.en_ligne === true ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {annonce.en_ligne === true ? 'En ligne' : 'Hors ligne'}
                </span>
                {isNewAnnonce && (
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                    Nouveau
                  </span>
                )}
                {annonce.phone ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Avec telephone
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Sans telephone
                  </span>
                )}
                {annonce.maj_prix && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Baisse de prix
                  </span>
                )}
                {Boolean(annonce.nb_modifications) && annonce.nb_modifications > 0 && (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    Modifie
                  </span>
                )}
                {currentStatus.favorite && (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    Favori
                  </span>
                )}
                {currentStatus.to_call && (
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    A appeler
                  </span>
                )}
                {currentStatus.called && (
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    Deja contacte
                  </span>
                )}
                {currentStatus.reminder && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    A rappeler
                  </span>
                )}
                {currentStatus.viewed && (
                  <span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-semibold text-secondary-700">
                    Deja vu
                  </span>
                )}
              </div>

              {!isList && (
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <p className="min-w-0 flex-1 text-xs font-medium text-secondary-400">{annonce.published_relative}</p>
                  <p className="flex-shrink-0 text-right text-xl font-bold text-primary-600">{formatPrice(annonce.price)}</p>
                </div>
              )}

              <h3 className={`font-semibold text-secondary-900 ${isList ? 'text-xl leading-7' : 'line-clamp-3 text-base leading-6'}`} title={annonce.title}>
                {annonce.title}
              </h3>

              <div className={`mt-3 text-sm text-secondary-600 ${isList ? 'flex flex-wrap items-center gap-4' : 'grid grid-cols-2 gap-2'}`}>
                <div className={`flex items-center gap-1.5 ${isList ? '' : 'col-span-2 min-w-0'}`}>
                  <MapPin className="h-4 w-4 text-secondary-400" />
                  <span className={isList ? '' : 'truncate'}>
                    {annonce.city} ({annonce.postal_code})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Square className="h-4 w-4 text-secondary-400" />
                  <span>{annonce.size} m²</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Bed className="h-4 w-4 text-secondary-400" />
                  <span>{annonce.rooms} pieces</span>
                </div>
                {annonce.nb_modifications !== undefined && annonce.nb_modifications > 0 && (
                  <div className="flex items-center gap-1.5 text-primary-700">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-medium">
                      {annonce.nb_modifications} modif{annonce.nb_modifications > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {isList && (
              <div className="flex-shrink-0 xl:min-w-[168px] xl:text-right">
                <p className="text-2xl font-bold text-primary-600">{formatPrice(annonce.price)}</p>
                <p className="mt-2 text-xs font-medium text-secondary-400">{annonce.published_relative}</p>
              </div>
            )}
          </div>

          <div className={`mt-4 ${isList ? 'grid gap-4 xl:grid-cols-[1fr_auto]' : ''}`}>
            <div className="rounded-2xl border border-gray-100 bg-slate-50/80 px-3 py-3">
              <div className="flex items-center justify-between gap-3 text-sm text-secondary-600">
                <div className="flex min-w-0 items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0 text-secondary-400" />
                  <span className="truncate font-medium text-secondary-700">{annonce.phone || 'Numero non renseigne'}</span>
                </div>
                {showSurveillanceButton && (
                  <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                    {isUnderSurveillance ? 'Surveillee' : 'Surveillance'}
                  </span>
                )}
              </div>
              {(statusActor || favoriteActors.length > 0) && !showSurveillanceButton && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-secondary-500">
                  {statusActor && <span>Derniere action par {statusActor}</span>}
                  {favoriteActors.length > 0 && <span>Favori par {favoriteActors.slice(0, 2).join(', ')}{favoriteActors.length > 2 ? ` +${favoriteActors.length - 2}` : ''}</span>}
                </div>
              )}
              {nextActionLabel && !showSurveillanceButton && (
                <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                  Prochaine action {currentStatus.reminder ? 'de rappel' : 'de suivi'} le {nextActionLabel}
                </div>
              )}
            </div>

            <div className={`mt-4 flex ${isList ? 'items-center gap-3 xl:mt-0 xl:justify-end' : 'flex-col items-stretch gap-3'}`}>
              {showSurveillanceButton ? (
                <button
                  onClick={handleAddToSurveillance}
                  disabled={loading}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isUnderSurveillance
                      ? 'border border-red-200 bg-red-100 text-red-700 hover:bg-red-200'
                      : 'border border-primary-200 bg-primary-100 text-primary-700 hover:bg-primary-200'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  {isUnderSurveillance ? 'Arreter surveillance' : 'Surveiller'}
                </button>
              ) : (
                <div className={`flex flex-wrap gap-2 ${isList ? '' : 'justify-between'}`}>
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
                        className={`relative rounded-2xl border p-2.5 transition ${config.color}`}
                        title={config.label}
                      >
                        <Icon className="h-4 w-4" />
                        {isActive && <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-current" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {!showSurveillanceButton && (
                <button
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary-900 px-4 py-3 text-xs font-semibold text-white transition hover:bg-secondary-800 ${isList ? '' : 'w-full'}`}
                  onClick={(e) => openDetails(e)}
                >
                  Voir details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
