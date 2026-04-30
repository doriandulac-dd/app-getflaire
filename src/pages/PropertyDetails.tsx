import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, X, MapPin, Square, Bed, Phone, ExternalLink,
  Calendar, User, AlertCircle, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Pencil, Clock
} from 'lucide-react';
import { Annonce } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PropertyActions from '../components/Properties/PropertyActions';
import toast from 'react-hot-toast';

// --- Couleur officielle DPE (fond + texte) ---
function getDpeColorClasses(dpe) {
  switch ((dpe || '').toUpperCase()) {
    case 'A': return 'bg-green-600 text-white';
    case 'B': return 'bg-green-400 text-white';
    case 'C': return 'bg-lime-300 text-gray-900';
    case 'D': return 'bg-yellow-300 text-gray-900';
    case 'E': return 'bg-orange-400 text-white';
    case 'F': return 'bg-orange-600 text-white';
    case 'G': return 'bg-red-600 text-white';
    default:  return 'bg-gray-200 text-gray-700';
  }
}

interface PropertyDetailsProps {
  id?: string;
  onClose?: () => void;
}

const PropertyDetails: React.FC<PropertyDetailsProps> = ({ id: propId, onClose }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  
  const annonceId = propId || id;
  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [modifications, setModifications] = useState<any[]>([]);

  useEffect(() => {
    if (annonceId) {
      fetchAnnonce();
      fetchModifications();
    }
  }, [annonceId]);

  const fetchAnnonce = async () => {
    try {
      const { data, error } = await supabase
        .from('annonces_with_relative_date')
        .select('*')
        .eq('id', annonceId)
        .single();

      if (error) throw error;
      setAnnonce(data);
    } catch (error) {
      console.error('Error fetching annonce:', error);
      toast.error('Erreur lors du chargement de l\'annonce');
      if (onClose) {
        onClose();
      } else {
        navigate('/pige');
      }
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
      setModifications(data || []);
    } catch (error) {
      console.error('Erreur lors de la récupération des modifications:', error);
      toast.error('Erreur lors du chargement de l\'historique des modifications');
    }
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
        return 'bg-primary-50 border-primary-200';
      case 'description':
      case 'title':
        return 'bg-secondary-50 border-secondary-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const renderModificationDetails = (modification: any) => {
    switch (modification.champ_modifie) {
      case 'price':
        const oldPrice = modification.ancienne_valeur ? parseFloat(modification.ancienne_valeur) : 0;
        const newPrice = modification.nouvelle_valeur ? parseFloat(modification.nouvelle_valeur) : 0;
        const priceDiff = newPrice - oldPrice;
        const pricePercent = oldPrice > 0 ? ((priceDiff / oldPrice) * 100) : 0;
        
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-600">Ancien prix:</span>
              <span className="font-medium">{formatPrice(oldPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-600">Nouveau prix:</span>
              <span className="font-medium">{formatPrice(newPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-secondary-600">Variation:</span>
              <span className={`font-medium flex items-center ${priceDiff > 0 ? 'text-error-600' : 'text-success-600'}`}>
                {priceDiff > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {formatPrice(Math.abs(priceDiff))} ({pricePercent > 0 ? '+' : ''}{pricePercent.toFixed(1)}%)
              </span>
            </div>
          </div>
        );
      
      case 'description':
      case 'title':
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
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(price);
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

  const getImageUrls = () => {
    if (!annonce) return [];
    let images: string[] = [];
    if (annonce.image_urls) {
      try {
        let parsed;
        if (typeof annonce.image_urls === 'string') {
          parsed = JSON.parse(annonce.image_urls);
        } else if (Array.isArray(annonce.image_urls)) {
          parsed = annonce.image_urls;
        }
        if (Array.isArray(parsed)) {
          if (parsed.length === 1 && typeof parsed[0] === 'string' && parsed[0].includes(',')) {
            images = parsed[0].split(',').map(url => url.trim()).filter(Boolean);
          } else {
            images = parsed.filter(url => url && typeof url === 'string');
          }
        }
      } catch (e) {
        console.error('Error parsing image_urls:', e);
      }
    }
    if (images.length === 0 && annonce.image_url) {
      if (typeof annonce.image_url === 'string') {
        images = [annonce.image_url];
      } else if (Array.isArray(annonce.image_url)) {
        images = annonce.image_url.filter(url => url && typeof url === 'string');
      }
    }
    return images;
  };

  const images = getImageUrls();
  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  useEffect(() => { setCurrentImageIndex(0); }, [annonce]);
  const getCurrentImageUrl = () => images.length > 0 ? images[currentImageIndex] : null;
  const isUrgent = annonce?.urgence || annonce?.urgence_detectee;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
        <div className="bg-gray-200 h-96 rounded-lg mb-6"></div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-200 h-20 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!annonce) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary-500">Annonce non trouvée</p>
        <button
          onClick={() => navigate('/pige')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
         {onClose ? 'Fermer' : 'Retour à la pige'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => {
            if (onClose) {
              onClose();
            } else {
              navigate('/pige');
            }
          }}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          {onClose ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Détails de l'annonce</h1>
          <p className="text-secondary-600 mt-1">
            Publié le {formatDate(annonce.publication_date)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Carousel */}
          <div className="relative h-96 bg-gray-200 rounded-lg overflow-hidden">
            {getCurrentImageUrl() ? (
              <img 
                src={getCurrentImageUrl()!} 
                alt={annonce.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400 text-lg">Pas d'image disponible</span>
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {images.length}
              </div>
            )}
            {isUrgent && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium shadow-lg border border-red-700">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                Urgente
              </div>
            )}
            <div className="absolute top-4 right-4 px-3 py-1 bg-secondary-900 text-white rounded-full text-sm font-medium">
              {annonce.source}
            </div>
          </div>
          {images.length > 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex space-x-2 overflow-x-auto">
                {images.map((imageUrl, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      index === currentImageIndex 
                        ? 'border-primary-500 ring-2 ring-primary-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={imageUrl}
                      alt={`Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:hidden">
            {/* Contact */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-secondary-900 mb-4">Contact</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-secondary-500" />
                  <span className="text-secondary-700">{annonce.owner_type}</span>
                </div>
                {annonce.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-secondary-500" />
                    <a 
                      href={`tel:${annonce.phone}`}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {annonce.phone}
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-secondary-500" />
                  <span className="text-sm text-secondary-600">
                    Publié le {formatDate(annonce.publication_date)}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <a
                  href={annonce.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Voir l'annonce originale</span>
                </a>
              </div>
            </div>
            {/* Actions */}
            <div>
              <PropertyActions
                annonceId={annonce.id}
                onUpdate={() => {}}
              />
            </div>
          </div>
          {/* Title and description */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-secondary-900 mb-2">
                  {annonce.title}
                </h2>
                {/* Affichage du motif d'urgence */}
                {(annonce.urgence || annonce.urgence_detectee) && annonce.type_urgence && (() => {
                  let motifs = [];
                  try {
                    // Si c'est un string qui ressemble à un JSON array
                    if (typeof annonce.type_urgence === 'string' && annonce.type_urgence.startsWith('[')) {
                      const parsed = JSON.parse(annonce.type_urgence);
                      if (Array.isArray(parsed)) {
                        motifs = parsed.filter(motif => motif && motif.trim() !== '');
                      } else {
                        motifs = [annonce.type_urgence];
                      }
                    } else if (typeof annonce.type_urgence === 'string' && annonce.type_urgence.trim()) {
                      motifs = [annonce.type_urgence];
                    }
                  } catch (e) {
                    // Si le parsing échoue, traiter comme un string simple
                    if (typeof annonce.type_urgence === 'string' && annonce.type_urgence.trim()) {
                      motifs = [annonce.type_urgence];
                    }
                  }
                  return motifs.length > 0;
                })() && (
                  <div className="mb-3">
                    {(() => {
                      let motifs = [];
                      try {
                        // Si c'est un string qui ressemble à un JSON array
                        if (typeof annonce.type_urgence === 'string' && annonce.type_urgence.startsWith('[')) {
                          const parsed = JSON.parse(annonce.type_urgence);
                          if (Array.isArray(parsed)) {
                            motifs = parsed.filter(motif => motif && motif.trim() !== '');
                          } else {
                            motifs = [annonce.type_urgence];
                          }
                        } else if (typeof annonce.type_urgence === 'string' && annonce.type_urgence.trim()) {
                          motifs = [annonce.type_urgence];
                        }
                      } catch (e) {
                        // Si le parsing échoue, traiter comme un string simple
                        if (typeof annonce.type_urgence === 'string' && annonce.type_urgence.trim()) {
                          motifs = [annonce.type_urgence];
                        }
                      }
                      
                      return (
                        <div className="flex flex-wrap gap-2">
                          {motifs.map((motif, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              {motif}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {annonce.type_de_bien && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-secondary-100 text-secondary-800">
                    {annonce.type_de_bien}
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary-600">
                  {formatPrice(annonce.price)}
                </div>
              </div>
            </div>
            {annonce.description && (
              <div className="mt-4">
                <h3 className="font-semibold text-secondary-900 mb-2">Description</h3>
                <p className="text-secondary-700 whitespace-pre-wrap">
                  {annonce.description}
                </p>
              </div>
            )}
          </div>
          {/* Property details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-secondary-900 mb-4">Caractéristiques</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Square className="h-5 w-5 text-secondary-500" />
                <div>
                  <p className="text-sm text-secondary-500">Surface</p>
                  <p className="font-medium text-secondary-900">{annonce.size} m²</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Bed className="h-5 w-5 text-secondary-500" />
                <div>
                  <p className="text-sm text-secondary-500">Pièces</p>
                  <p className="font-medium text-secondary-900">{annonce.rooms}</p>
                </div>
              </div>
              {annonce.bedrooms && (
                <div className="flex items-center space-x-2">
                  <Bed className="h-5 w-5 text-secondary-500" />
                  <div>
                    <p className="text-sm text-secondary-500">Chambres</p>
                    <p className="font-medium text-secondary-900">{annonce.bedrooms}</p>
                  </div>
                </div>
              )}
              {/* --- DPE COLORED --- */}
              {annonce.dpe && (
                <div className="flex items-center space-x-2">
                  <div className={`h-8 w-8 rounded font-bold flex items-center justify-center text-lg shadow ${getDpeColorClasses(annonce.dpe)}`}>
                    {annonce.dpe}
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">DPE</p>
                    <p className="font-medium text-secondary-900">
                      {annonce.dpe_value ? `${annonce.dpe_value} kWh/m².an` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Source data details */}
            {(() => {
              let details = {};
              try {
                if (annonce.source_data && typeof annonce.source_data === "string") {
                  details = JSON.parse(annonce.source_data);
                } else if (typeof annonce.source_data === "object" && annonce.source_data !== null) {
                  details = annonce.source_data;
                }
              } catch (e) { details = {}; }
              return (
                details && Object.keys(details).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h4 className="font-medium text-secondary-900 mb-3">Détails supplémentaires</h4>
                    <div className="space-y-3">
                      {Object.entries(details).map(([key, value]) => {
                        if (value === null || value === undefined || value === '') return null;
                        const formatValue = (value: any) => {
                          if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
                          if (typeof value === 'object' && value !== null) return JSON.stringify(value);
                          return String(value);
                        };
                        return (
                          <div key={key} className="flex justify-between items-start py-2 border-b border-gray-50 last:border-b-0">
                            <span className="text-sm text-secondary-600 font-medium min-w-0 flex-shrink-0 mr-4">{key}</span>
                            <span className="text-sm text-secondary-900 text-right break-words">{formatValue(value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              );
            })()}
          </div>
          {/* Location */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-secondary-900 mb-4">Localisation</h3>
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-secondary-500 mt-1" />
              <div>
                <p className="font-medium text-secondary-900">{annonce.city}</p>
                <p className="text-secondary-600">{annonce.postal_code}</p>
                {annonce.adresse && (
                  <p className="text-sm text-secondary-500 mt-1">{annonce.adresse}</p>
                )}
              </div>
            </div>
          </div>

          {/* Historique des modifications */}
          {modifications.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-secondary-900 mb-4">Historique des modifications</h3>
              <div className="space-y-4">
                {modifications.map((modification, index) => (
                  <div
                    key={modification.id}
                    className={`relative border rounded-lg p-4 ${getModificationColor(modification.champ_modifie)}`}
                  >
                    {/* Timeline line */}
                    {index < modifications.length - 1 && (
                      <div className="absolute left-6 top-12 w-0.5 h-6 bg-gray-300"></div>
                    )}
                    
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {getModificationIcon(modification.champ_modifie)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-secondary-900">
                            {getModificationLabel(modification.champ_modifie)}
                          </h4>
                          <span className="text-xs text-secondary-500">
                            {formatDate(modification.date_modification)}
                          </span>
                        </div>
                        
                        {renderModificationDetails(modification)}
                        
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact - Desktop only */}
          <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-secondary-900 mb-4">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-secondary-500" />
                <span className="text-secondary-700">{annonce.owner_type}</span>
              </div>
              {annonce.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-5 w-5 text-secondary-500" />
                  <a 
                    href={`tel:${annonce.phone}`}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {annonce.phone}
                  </a>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-secondary-500" />
                <span className="text-sm text-secondary-600">
                  Publié le {formatDate(annonce.publication_date)}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <a
                href={annonce.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Voir l'annonce originale</span>
              </a>
            </div>
          </div>
          {/* Status actions - Desktop only */}
          <div className="hidden lg:block">
            <PropertyActions
              annonceId={annonce.id}
              onUpdate={() => {}}
            />
          </div>
          {/* Property info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-secondary-900 mb-4">Informations</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-500">Département</span>
                <span className="text-secondary-900 font-medium">{annonce.departement}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-500">Source</span>
                <span className="text-secondary-900 font-medium">{annonce.source}</span>
              </div>
              {annonce.ges && (
                <div className="flex justify-between">
                  <span className="text-secondary-500">GES</span>
                  <span className="text-secondary-900 font-medium">{annonce.ges}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary-500">En ligne</span>
                <span className={`font-medium ${annonce.en_ligne ? 'text-success-600' : 'text-error-600'}`}>
                  {annonce.en_ligne ? 'Oui' : 'Non'}
                </span>
              </div>
              {annonce.maj_prix && (
                <div className="flex justify-between">
                  <span className="text-secondary-500">Prix modifié</span>
                  <span className="text-warning-600 font-medium">Oui</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetails;
