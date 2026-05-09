import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Bed,
  Clock3,
  ExternalLink,
  History,
  MapPin,
  ShieldCheck,
  Square,
  Trash2,
  TrendingUp,
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
  const [modificationsCount, setModificationsCount] = useState<number>(surveillance.nb_modifications || 0);
  const [loadingModifications, setLoadingModifications] = useState(true);

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
        setModificationsCount(count || surveillance.nb_modifications || 0);
      } catch (error) {
        console.error('Error fetching modifications count:', error);
        setModificationsCount(surveillance.nb_modifications || 0);
      } finally {
        setLoadingModifications(false);
      }
    };

    fetchModificationsCount();
  }, [surveillance.annonce_id, surveillance.nb_modifications]);

  const handleRemove = async () => {
    if (confirm('Êtes-vous sûr de vouloir retirer cette annonce de la surveillance ?')) {
      const success = await removeFromSurveillance(surveillance.id);
      if (success) {
        onRemove();
      }
    }
  };

  const openDetails = () => {
    if (onCardClick) {
      onCardClick(surveillance.annonce_id);
      return;
    }
    navigate(`/pige/${surveillance.annonce_id}`);
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price || 0);

  const formatDate = (date?: string) => {
    if (!date) return 'Non renseigné';
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'Non renseigné';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dateObj);
  };

  const daysSincePublication = useMemo(() => {
    const publicationDate = (surveillance as SurveillanceWithDetails & { publication_date?: string }).publication_date;
    if (!publicationDate) return null;
    const pubDate = new Date(publicationDate);
    if (isNaN(pubDate.getTime())) return null;
    const now = new Date();
    return Math.floor(Math.abs(now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [surveillance]);

  const status = useMemo(() => {
    if (surveillance.supprimee) {
      return {
        label: 'Supprimée',
        className: 'bg-red-50 text-red-700 ring-red-200',
        dot: 'bg-red-500',
      };
    }
    if (!surveillance.en_ligne) {
      return {
        label: 'Hors ligne',
        className: 'bg-amber-50 text-amber-700 ring-amber-200',
        dot: 'bg-amber-500',
      };
    }
    return {
      label: 'En ligne',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      dot: 'bg-emerald-500',
    };
  }, [surveillance.en_ligne, surveillance.supprimee]);

  const processSingleUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    return trimmed.includes(',') ? trimmed.split(',')[0].trim() : trimmed;
  };

  const imageUrl = useMemo(() => {
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

    if (surveillance.image_urls) {
      try {
        let images: string[] = [];
        if (typeof surveillance.image_urls === 'string') {
          const parsed = JSON.parse(surveillance.image_urls);
          if (Array.isArray(parsed)) {
            images = parsed.flatMap((url) =>
              typeof url === 'string' && url.includes(',') ? url.split(',').map((item) => item.trim()) : url
            ).filter((url): url is string => Boolean(url) && typeof url === 'string');
          }
        } else if (Array.isArray(surveillance.image_urls)) {
          images = surveillance.image_urls.filter((url): url is string => Boolean(url) && typeof url === 'string');
        }
        if (images.length > 0) return processSingleUrl(images[0]);
      } catch {
        return null;
      }
    }

    return null;
  }, [surveillance.image_url, surveillance.image_urls]);

  const hasModifications = !loadingModifications && modificationsCount > 0;

  return (
    <>
      <article
        className="group h-full overflow-hidden rounded-3xl border border-white bg-white shadow-sm ring-1 ring-secondary-100 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-secondary-900/12"
      >
        <button type="button" onClick={openDetails} className="block w-full text-left">
          <div className="relative h-56 overflow-hidden bg-secondary-100">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={surveillance.title}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary-100 to-secondary-200 text-sm font-bold text-secondary-400">
                Pas d'image
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-secondary-950/75 via-secondary-950/10 to-transparent" />

            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1 ${status.className}`}>
                <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {hasModifications && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-3 py-1 text-xs font-black text-white shadow-lg shadow-primary-900/25">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {modificationsCount} modif{modificationsCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <span className="absolute right-4 top-4 rounded-full bg-secondary-950/85 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
              {surveillance.source || 'Source'}
            </span>

            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                    Surveillée depuis {formatDate(surveillance.date_surveillance)}
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">{formatPrice(surveillance.price)}</p>
                </div>
                <span className="rounded-full bg-white/15 p-2 text-white backdrop-blur transition group-hover:bg-white group-hover:text-secondary-950">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </button>

        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {surveillance.type_de_bien && (
                <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-bold text-secondary-700">
                  {surveillance.type_de_bien}
                </span>
              )}
              {hasModifications && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  À relire
                </span>
              )}
            </div>
            <button type="button" onClick={openDetails} className="text-left">
              <h3 className="line-clamp-2 text-lg font-black leading-tight text-secondary-950 transition group-hover:text-primary-700">
                {surveillance.title}
              </h3>
            </button>
            <div className="flex items-center text-sm font-semibold text-secondary-500">
              <MapPin className="mr-1.5 h-4 w-4 text-primary-500" />
              {surveillance.city || 'Ville non renseignée'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-secondary-50 p-3">
              <Square className="mb-2 h-4 w-4 text-secondary-400" />
              <p className="text-sm font-black text-secondary-900">{surveillance.size || '-'} m²</p>
            </div>
            <div className="rounded-2xl bg-secondary-50 p-3">
              <Bed className="mb-2 h-4 w-4 text-secondary-400" />
              <p className="text-sm font-black text-secondary-900">{surveillance.rooms || '-'} pièces</p>
            </div>
            <div className="rounded-2xl bg-secondary-50 p-3">
              <ShieldCheck className="mb-2 h-4 w-4 text-secondary-400" />
              <p className="text-sm font-black text-secondary-900">{modificationsCount || 0} suivi{modificationsCount > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-secondary-100 bg-secondary-50/70 p-3">
            <div className="flex items-start gap-2 text-sm text-secondary-700">
              <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" />
              <div>
                {surveillance.derniere_modification ? (
                  <>
                    <p className="font-bold text-secondary-950">Dernière modification</p>
                    <p className="text-xs font-medium text-secondary-500">
                      {surveillance.type_derniere_modification || 'Changement'} · {formatDate(surveillance.derniere_modification)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-secondary-950">Aucun changement récent</p>
                    <p className="text-xs font-medium text-secondary-500">
                      {daysSincePublication !== null
                        ? `Annonce en ligne depuis ${daysSincePublication} jour${daysSincePublication > 1 ? 's' : ''}`
                        : 'Historique prêt dès la prochaine détection'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 border-t border-secondary-100 pt-4">
            <button
              type="button"
              onClick={openDetails}
              className="col-span-2 inline-flex items-center justify-center rounded-2xl bg-secondary-950 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-secondary-800"
            >
              Détail
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowHistory(true);
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-secondary-200 bg-white px-3 py-2.5 text-secondary-700 transition hover:border-primary-200 hover:text-primary-700"
              title="Voir l'historique"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (surveillance.annonce_url) window.open(surveillance.annonce_url, '_blank');
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-secondary-200 bg-white px-3 py-2.5 text-secondary-700 transition hover:border-primary-200 hover:text-primary-700"
              title="Voir l'annonce originale"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleRemove();
              }}
              className="col-span-4 inline-flex items-center justify-center rounded-2xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Retirer de la surveillance
            </button>
          </div>
        </div>
      </article>

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
