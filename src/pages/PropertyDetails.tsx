import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import {
  AlertCircle,
  ArrowLeft,
  Bed,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Phone,
  Pencil,
  Square,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { Annonce } from '../types';
import { supabase } from '../lib/supabase';
import PropertyActions from '../components/Properties/PropertyActions';
import toast from 'react-hot-toast';
import { useGsapReveal } from '../hooks/useGsapReveal';
import { gsap } from '../lib/animations';
import { useAuth } from '../hooks/useAuth';
import { useActivityScope } from '../hooks/useActivityScope';
import { savePropertyAction } from '../utils/propertyActivities';
import { generateCallScripts, generateSmsSuggestions } from '../utils/pigeOutreach';

type ModificationLog = {
  id: string;
  champ_modifie: string;
  ancienne_valeur?: string | null;
  nouvelle_valeur?: string | null;
  date_modification: string;
};

type SourceDetails = Record<string, unknown>;

interface PropertyDetailsProps {
  id?: string;
  onClose?: () => void;
}

function getDpeColorClasses(dpe?: string | null) {
  switch ((dpe || '').toUpperCase()) {
    case 'A':
      return 'bg-green-600 text-white';
    case 'B':
      return 'bg-green-400 text-white';
    case 'C':
      return 'bg-lime-300 text-gray-900';
    case 'D':
      return 'bg-yellow-300 text-gray-900';
    case 'E':
      return 'bg-orange-400 text-white';
    case 'F':
      return 'bg-orange-600 text-white';
    case 'G':
      return 'bg-red-600 text-white';
    default:
      return 'bg-gray-200 text-gray-700';
  }
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price || 0);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

const parseUrgencyMotifs = (typeUrgence?: string | null) => {
  if (!typeUrgence || !typeUrgence.trim()) return [];

  try {
    if (typeUrgence.startsWith('[')) {
      const parsed = JSON.parse(typeUrgence);
      if (Array.isArray(parsed)) {
        return parsed.filter((motif) => typeof motif === 'string' && motif.trim() !== '');
      }
    }
  } catch {
    return [typeUrgence].filter(Boolean);
  }

  return [typeUrgence];
};

const parseSourceDetails = (sourceData: unknown): SourceDetails => {
  try {
    if (sourceData && typeof sourceData === 'string') return JSON.parse(sourceData);
    if (sourceData && typeof sourceData === 'object') return sourceData as SourceDetails;
  } catch {
    return {};
  }
  return {};
};

const getContactName = (sourceDetails: SourceDetails) => {
  const candidateKeys = [
    'contact_name',
    'contactName',
    'nom_contact',
    'seller_name',
    'owner_name',
    'name',
  ];

  for (const key of candidateKeys) {
    const value = sourceDetails[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
};

const PropertyDetails: React.FC<PropertyDetailsProps> = ({ id: propId, onClose }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const annonceId = propId || id;

  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [modifications, setModifications] = useState<ModificationLog[]>([]);

  const pageRef = useGsapReveal<HTMLDivElement>([loading, annonce?.id, modifications.length], {
    selector: '[data-gsap-reveal]',
    y: 18,
    stagger: 0.05,
  });
  const heroRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (annonceId) {
      fetchAnnonce();
      fetchModifications();
    }
  }, [annonceId]);

  useEffect(() => {
    if (!annonceId || !appUser || activityScope.loading) return;

    void savePropertyAction({
      annonceId,
      userId: appUser.id,
      activityScope,
      actionType: 'viewed',
    }).catch((error) => {
      console.error('[pige-activity] viewed save failed', error);
    });
  }, [annonceId, appUser?.id, activityScope.loading, activityScope.agencyId, activityScope.isAgencyScope]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [annonce]);

  useGSAP(
    () => {
      if (!heroRef.current || !annonce) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop: '(min-width: 1024px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { isDesktop, reduceMotion } = context.conditions as {
            isDesktop: boolean;
            reduceMotion: boolean;
          };

          if (reduceMotion) {
            gsap.set('[data-detail-media], [data-detail-summary], [data-detail-sidebar], [data-detail-thumb]', {
              autoAlpha: 1,
              x: 0,
              y: 0,
              clearProps: 'transform,opacity,visibility',
            });
            return;
          }

          const tl = gsap.timeline({ defaults: { duration: 0.55, ease: 'power3.out' } });
          tl.from('[data-detail-media]', { autoAlpha: 0, y: 18 })
            .from('[data-detail-summary]', { autoAlpha: 0, y: 18 }, '-=0.32')
            .from('[data-detail-sidebar]', { autoAlpha: 0, x: isDesktop ? 24 : 0, y: isDesktop ? 0 : 16 }, '-=0.32')
            .from('[data-detail-thumb]', { autoAlpha: 0, y: 10, stagger: 0.035 }, '-=0.22');
        }
      );

      return () => mm.revert();
    },
    { scope: heroRef, dependencies: [annonce?.id] }
  );

  useGSAP(
    () => {
      if (!imageRef.current) return;
      gsap.fromTo(
        imageRef.current,
        { autoAlpha: 0, scale: 1.015 },
        { autoAlpha: 1, scale: 1, duration: 0.28, ease: 'power2.out', clearProps: 'transform,opacity,visibility' }
      );
    },
    { dependencies: [currentImageIndex], scope: heroRef, revertOnUpdate: true }
  );

  const fetchAnnonce = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('annonces_with_relative_date')
        .select('*')
        .eq('id', annonceId)
        .single();

      if (error) throw error;
      setAnnonce(data);
    } catch (error) {
      console.error('Error fetching annonce:', error);
      toast.error("Erreur lors du chargement de l'annonce");
      if (onClose) onClose();
      else navigate('/pige');
    } finally {
      setLoading(false);
    }
  };

  const fetchModifications = async () => {
    try {
      const { data, error } = await supabase
        .from('annonce_logs')
        .select('*')
        .eq('annonce_id', annonceId)
        .order('date_modification', { ascending: false });

      if (error) throw error;
      setModifications((data || []) as ModificationLog[]);
    } catch (error) {
      console.error('Erreur lors de la recuperation des modifications:', error);
      toast.error("Erreur lors du chargement de l'historique des modifications");
    }
  };

  const images = useMemo(() => {
    if (!annonce) return [];
    let parsedImages: string[] = [];

    if (annonce.image_urls) {
      try {
        const parsed = typeof annonce.image_urls === 'string' ? JSON.parse(annonce.image_urls) : annonce.image_urls;
        if (Array.isArray(parsed)) {
          if (parsed.length === 1 && typeof parsed[0] === 'string' && parsed[0].includes(',')) {
            parsedImages = parsed[0].split(',').map((url) => url.trim()).filter(Boolean);
          } else {
            parsedImages = parsed.filter((url) => url && typeof url === 'string');
          }
        }
      } catch (error) {
        console.error('Error parsing image_urls:', error);
      }
    }

    if (parsedImages.length === 0 && annonce.image_url) {
      if (typeof annonce.image_url === 'string') parsedImages = [annonce.image_url];
      else if (Array.isArray(annonce.image_url)) {
        parsedImages = annonce.image_url.filter((url) => url && typeof url === 'string');
      }
    }

    return parsedImages;
  }, [annonce]);

  const currentImageUrl = images.length > 0 ? images[currentImageIndex] : null;
  const isUrgent = Boolean(annonce?.urgence || annonce?.urgence_detectee);
  const urgencyMotifs = useMemo(() => parseUrgencyMotifs(annonce?.type_urgence), [annonce?.type_urgence]);
  const sourceDetails = useMemo(() => parseSourceDetails((annonce as any)?.source_data), [annonce]);

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  const goBack = () => {
    if (onClose) onClose();
    else navigate('/pige');
  };

  const getModificationIcon = (champ: string) => {
    switch (champ) {
      case 'price':
        return <TrendingUp className="h-5 w-5 text-primary-600" />;
      case 'description':
      case 'title':
        return <Pencil className="h-5 w-5 text-secondary-600" />;
      default:
        return <Clock className="h-5 w-5 text-secondary-600" />;
    }
  };

  const getModificationLabel = (champ: string) => {
    const labels: Record<string, string> = {
      price: 'Changement de prix',
      description: 'Modification de description',
      title: 'Modification du titre',
    };
    return labels[champ] || champ;
  };

  const getModificationColor = (champ: string) => {
    switch (champ) {
      case 'price':
        return 'border-primary-200 bg-primary-50';
      case 'description':
      case 'title':
        return 'border-secondary-200 bg-secondary-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const renderModificationDetails = (modification: ModificationLog) => {
    switch (modification.champ_modifie) {
      case 'price': {
        const oldPrice = modification.ancienne_valeur ? parseFloat(modification.ancienne_valeur) : 0;
        const newPrice = modification.nouvelle_valeur ? parseFloat(modification.nouvelle_valeur) : 0;
        const priceDiff = newPrice - oldPrice;
        const pricePercent = oldPrice > 0 ? (priceDiff / oldPrice) * 100 : 0;

        return (
          <div className="grid gap-2 text-sm">
            <InfoRow label="Ancien prix" value={formatPrice(oldPrice)} />
            <InfoRow label="Nouveau prix" value={formatPrice(newPrice)} />
            <div className="flex items-center justify-between gap-4">
              <span className="text-secondary-600">Variation</span>
              <span className={`flex items-center font-semibold ${priceDiff > 0 ? 'text-error-600' : 'text-success-600'}`}>
                {priceDiff > 0 ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                {formatPrice(Math.abs(priceDiff))} ({pricePercent > 0 ? '+' : ''}{pricePercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        );
      }

      case 'description':
      case 'title':
        return (
          <div className="space-y-3 text-sm">
            {modification.ancienne_valeur && (
              <div>
                <span className="font-medium text-secondary-600">Ancien</span>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-white/80 p-3 text-secondary-700">
                  {modification.ancienne_valeur}
                </p>
              </div>
            )}
            {modification.nouvelle_valeur && (
              <div>
                <span className="font-medium text-secondary-600">Nouveau</span>
                <p className="mt-1 whitespace-pre-wrap rounded-lg bg-primary-50 p-3 text-secondary-800">
                  {modification.nouvelle_valeur}
                </p>
              </div>
            )}
          </div>
        );

      default:
        return <div className="text-sm text-secondary-600">{modification.nouvelle_valeur || 'Modification detectee'}</div>;
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-10 w-56 rounded-xl bg-gray-200" />
        <div className="h-[460px] rounded-2xl bg-gray-200" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-52 rounded-2xl bg-gray-200 lg:col-span-2" />
          <div className="h-52 rounded-2xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!annonce) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
        <p className="text-secondary-500">Annonce non trouvée</p>
        <button onClick={goBack} className="mt-4 font-medium text-primary-600 hover:text-primary-700">
          {onClose ? 'Fermer' : 'Retour à la pige'}
        </button>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-gsap-reveal>
        <div className="flex items-start gap-3">
          <button
            onClick={goBack}
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700"
            aria-label={onClose ? 'Fermer' : 'Retour à la pige'}
          >
            {onClose ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary-900 px-3 py-1 text-xs font-semibold text-white">{annonce.source}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${annonce.en_ligne ? 'bg-success-50 text-success-600' : 'bg-error-50 text-error-600'}`}>
                {annonce.en_ligne ? 'En ligne' : 'Hors ligne'}
              </span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Urgente
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-secondary-900">Detail de l'annonce</h1>
            <p className="mt-1 text-sm text-secondary-600">Publie le {formatDate(annonce.publication_date)}</p>
          </div>
        </div>
      </header>

      <div ref={heroRef} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" data-detail-media>
            <div className="relative h-[360px] bg-gray-100 sm:h-[480px]">
              {currentImageUrl ? (
                <img ref={imageRef} src={currentImageUrl} alt={annonce.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg text-gray-400">Pas d'image disponible</div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur transition hover:bg-black/70"
                    aria-label="Image precedente"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-2 text-white backdrop-blur transition hover:bg-black/70"
                    aria-label="Image suivante"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white backdrop-blur">
                    {currentImageIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t border-gray-100 p-3">
                {images.map((imageUrl, index) => (
                  <button
                    key={imageUrl}
                    data-detail-thumb
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      index === currentImageIndex ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={imageUrl} alt={`Image ${index + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:hidden" data-detail-sidebar>
            <ContactPanel annonce={annonce} formatDate={formatDate} commercialProfile={appUser?.personalization_settings?.commercial_profile} />
            <div className="mt-5 border-t border-gray-100 pt-5">
              <PropertyActions annonceId={annonce.id} onUpdate={() => {}} />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" data-detail-summary>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  {annonce.type_de_bien && (
                    <span className="rounded-full bg-secondary-100 px-3 py-1 text-sm font-medium text-secondary-800">
                      {annonce.type_de_bien}
                    </span>
                  )}
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">{annonce.owner_type}</span>
                  {urgencyMotifs.map((motif) => (
                    <span key={motif} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      {motif}
                    </span>
                  ))}
                </div>
                <h2 className="text-2xl font-bold leading-tight text-secondary-900 lg:text-3xl">{annonce.title}</h2>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-secondary-600">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-secondary-400" />
                    {annonce.city} ({annonce.postal_code})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Square className="h-4 w-4 text-secondary-400" />
                    {annonce.size} m²
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Bed className="h-4 w-4 text-secondary-400" />
                    {annonce.rooms} pieces
                  </span>
                </div>
              </div>
              <div className="rounded-xl bg-primary-50 px-5 py-4 text-left lg:min-w-[190px] lg:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">Prix affiche</p>
                <p className="mt-2 text-3xl font-bold text-primary-700">{formatPrice(annonce.price)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={Square} label="Surface" value={`${annonce.size} m²`} />
              <Metric icon={Bed} label="Pieces" value={String(annonce.rooms || '-')} />
              {annonce.bedrooms ? <Metric icon={Bed} label="Chambres" value={String(annonce.bedrooms)} /> : null}
              {annonce.dpe ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold shadow ${getDpeColorClasses(annonce.dpe)}`}>
                    {annonce.dpe}
                  </div>
                  <p className="mt-3 text-sm text-secondary-500">DPE</p>
                  <p className="font-semibold text-secondary-900">{(annonce as any).dpe_value ? `${(annonce as any).dpe_value} kWh/m².an` : 'Renseigne'}</p>
                </div>
              ) : null}
            </div>
          </section>

          {annonce.description && (
            <ContentSection title="Description">
              <p className="whitespace-pre-wrap leading-7 text-secondary-700">{annonce.description}</p>
            </ContentSection>
          )}

          <ContentSection title="Localisation">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 text-secondary-500" />
              <div>
                <p className="font-semibold text-secondary-900">{annonce.city}</p>
                <p className="text-secondary-600">{annonce.postal_code}</p>
                {annonce.adresse && <p className="mt-1 text-sm text-secondary-500">{annonce.adresse}</p>}
              </div>
            </div>
          </ContentSection>

          {Object.keys(sourceDetails).length > 0 && (
            <ContentSection title="Details supplementaires">
              <div className="divide-y divide-gray-100">
                {Object.entries(sourceDetails).map(([key, value]) => {
                  if (value === null || value === undefined || value === '') return null;
                  const formattedValue =
                    typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : typeof value === 'object' ? JSON.stringify(value) : String(value);

                  return <InfoRow key={key} label={key} value={formattedValue} />;
                })}
              </div>
            </ContentSection>
          )}

          {modifications.length > 0 && (
            <ContentSection title="Historique des modifications">
              <div className="space-y-4">
                {modifications.map((modification, index) => (
                  <div key={modification.id} className={`relative rounded-xl border p-4 ${getModificationColor(modification.champ_modifie)}`}>
                    {index < modifications.length - 1 && <div className="absolute left-6 top-12 h-6 w-0.5 bg-gray-300" />}
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">{getModificationIcon(modification.champ_modifie)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-sm font-semibold text-secondary-900">{getModificationLabel(modification.champ_modifie)}</h4>
                          <span className="text-xs text-secondary-500">{formatDate(modification.date_modification)}</span>
                        </div>
                        {renderModificationDetails(modification)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ContentSection>
          )}
        </main>

        <aside className="hidden lg:block" data-detail-sidebar>
          <div className="sticky top-24 space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <ContactPanel annonce={annonce} formatDate={formatDate} commercialProfile={appUser?.personalization_settings?.commercial_profile} />
            </section>
            <PropertyActions annonceId={annonce.id} onUpdate={() => {}} />
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-secondary-900">Informations rapides</h3>
              <div className="mt-4 space-y-1 text-sm">
                <InfoRow label="Département" value={annonce.departement} compact />
                <InfoRow label="Source" value={annonce.source} compact />
                <InfoRow label="Publication source" value={formatDate(annonce.publication_date)} compact />
                <InfoRow label="Première détection GetFlaire" value={formatDate(annonce.created_at)} compact />
                <InfoRow label="Date de récupération" value={formatDate(annonce.created_at)} compact />
                {annonce.ges && <InfoRow label="GES" value={annonce.ges} compact />}
                <InfoRow label="En ligne" value={annonce.en_ligne ? 'Oui' : 'Non'} compact />
                {annonce.maj_prix && <InfoRow label="Prix modifié" value="Oui" compact />}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
};

type PanelAnnonce = Annonce & {
  dpe_value?: string | number | null;
  source_data?: unknown;
};

const ContactPanel = ({
  annonce,
  formatDate,
  commercialProfile,
}: {
  annonce: PanelAnnonce;
  formatDate: (date: string) => string;
  commercialProfile?: import('../types').CommercialProfileSettings;
}) => {
  const sourceDetails = parseSourceDetails(annonce.source_data);
  const contactName = getContactName(sourceDetails);
  const callScripts = generateCallScripts(annonce, commercialProfile);
  const smsSuggestions = generateSmsSuggestions(annonce, commercialProfile);

  const copyPhone = async () => {
    if (!annonce.phone) return;
    try {
      await navigator.clipboard.writeText(annonce.phone);
      toast.success('Numéro copié');
    } catch {
      toast.error('Impossible de copier le numéro');
    }
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Impossible de copier le texte');
    }
  };

  return (
    <div>
    <h3 className="font-semibold text-secondary-900">Contact</h3>
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-3">
        <User className="h-5 w-5 text-secondary-500" />
        <span className="text-secondary-700">Vendeur {annonce.owner_type}</span>
      </div>
      {annonce.phone && (
        <div className="space-y-3">
          {contactName && (
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-secondary-500" />
              <span className="text-secondary-700">Nom du contact : {contactName}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-secondary-500" />
            <a href={`tel:${annonce.phone}`} className="font-semibold text-primary-600 hover:text-primary-700">
              {annonce.phone}
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`tel:${annonce.phone}`}
              className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-700"
            >
              Appeler
            </a>
            <a
              href={`sms:${annonce.phone}`}
              className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
            >
              SMS
            </a>
            <button
              type="button"
              onClick={copyPhone}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-secondary-700 transition hover:bg-gray-50"
            >
              Copier
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-secondary-500" />
        <span className="text-sm text-secondary-600">{formatDate(annonce.publication_date)}</span>
      </div>
    </div>
    <div className="mt-5 border-t border-gray-100 pt-4">
      <a
        href={annonce.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-secondary-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-secondary-800"
      >
        <ExternalLink className="h-4 w-4" />
        Voir l'annonce originale
      </a>
    </div>
    {annonce.phone && (
      <div className="mt-5 border-t border-gray-100 pt-4 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-secondary-900">3 scénarios d'appel</h4>
          <div className="mt-3 space-y-2">
            {callScripts.map((script) => (
              <div key={script.title} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary-500">{script.title}</p>
                  <button
                    type="button"
                    onClick={() => copyText(script.body, 'Script copié')}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-secondary-700 transition hover:bg-gray-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </button>
                </div>
                <p className="mt-2 text-sm leading-6 text-secondary-700">{script.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-secondary-900">3 SMS proposés</h4>
          <div className="mt-3 space-y-2">
            {smsSuggestions.map((sms) => (
              <div key={sms.title} className="rounded-xl border border-gray-100 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary-500">{sms.title}</p>
                  <button
                    type="button"
                    onClick={() => copyText(sms.body, 'SMS copié')}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-secondary-700 transition hover:bg-gray-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copier
                  </button>
                </div>
                <p className="mt-2 text-sm leading-6 text-secondary-700">{sms.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

const Metric = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
    <Icon className="h-5 w-5 text-secondary-500" />
    <p className="mt-3 text-sm text-secondary-500">{label}</p>
    <p className="font-semibold text-secondary-900">{value}</p>
  </div>
);

const ContentSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6" data-gsap-reveal>
    <h3 className="mb-4 font-semibold text-secondary-900">{title}</h3>
    {children}
  </section>
);

const InfoRow = ({ label, value, compact = false }: { label: string; value: React.ReactNode; compact?: boolean }) => (
  <div className={`flex items-start justify-between gap-4 ${compact ? 'py-2' : 'py-3'}`}>
    <span className="min-w-0 flex-shrink-0 text-sm font-medium text-secondary-500">{label}</span>
    <span className="break-words text-right text-sm font-semibold text-secondary-900">{value}</span>
  </div>
);

export default PropertyDetails;
