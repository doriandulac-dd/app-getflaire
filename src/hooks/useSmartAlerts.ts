import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Annonce, Client } from '../types';
import { useAuth } from './useAuth';
import { useActivityScope } from './useActivityScope';
import { savePropertyFavorite } from '../utils/propertyFavorites';
import { savePropertyAction } from '../utils/propertyActivities';
import type { PropertyActionType } from '../utils/propertyActivities';
import { generateOutreach } from '../utils/outreachGeneration';
import type { OutreachMode } from '../utils/outreachGeneration';
import {
  AlertMatchResult,
  AlertNotification,
  AlertResultStatus,
  ScoreBreakdown,
  SmartAlert,
  SmartAlertCriteria,
  SmartAlertFormData,
  ScoreWeights,
  WeightedKeyword,
} from '../types/smartAlerts';

export const defaultScoreWeights: ScoreWeights = {
  localisation: 25,
  budget: 20,
  type: 15,
  surface: 15,
  exterieur: 10,
  etat: 5,
  dpe: 5,
  motsCles: 5,
};

export const defaultSmartAlertCriteria: SmartAlertCriteria = {
  acceptedCities: [],
  excludedCities: [],
  locationImportance: 'high',
  propertyTypes: [],
  secondaryTypes: [],
  exterior: 'any',
  exteriorImportance: 'medium',
  parking: {
    garage: 'medium',
    parking: 'any',
    cave: 'any',
    dependance: 'any',
  },
  condition: 'any',
  forbiddenWorks: [],
  dpeAccepted: ['A', 'B', 'C', 'D', 'E'],
  dpeImportance: 'medium',
  positiveKeywords: [],
  negativeKeywords: [],
  sellerType: 'all',
  searchMode: 'balanced',
  scoreWeights: defaultScoreWeights,
  investor: {
    enabled: false,
    potential: [],
  },
};

const toNumber = (value: unknown): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeText = (value?: string | null) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const keywordWeight = (importance: WeightedKeyword['importance']) => {
  if (importance === 'required') return 1;
  if (importance === 'high') return 0.85;
  if (importance === 'medium') return 0.6;
  return 0.35;
};

const resolveScoreWeights = (weights?: Partial<ScoreWeights>): ScoreWeights => ({
  ...defaultScoreWeights,
  ...(weights || {}),
});

const weightedPoints = (ratio: number, maxPoints: number) =>
  Math.max(0, Math.min(maxPoints, Math.round(ratio * maxPoints)));

const heavyWorksKeywords = [
  'ruine',
  'a renover',
  'renovation complete',
  'gros travaux',
  'travaux a prevoir',
  'entierement a renover',
  'maison a restaurer',
  'a restaurer',
  'non habitable',
  'inhabitable',
  'chantier',
  'plateau brut',
  'grange a renover',
  'hors d eau',
  'hors d air',
];

const stringifySourceData = (sourceData: unknown) => {
  if (!sourceData || typeof sourceData !== 'object') return '';
  try {
    return JSON.stringify(sourceData);
  } catch {
    return '';
  }
};

const hasCityMatch = (city: string, target: string) =>
  Boolean(target && (city === target || city.includes(target)));

const getForbiddenWorkKeywords = (criteria: SmartAlertCriteria) => {
  const configured = criteria.forbiddenWorks || [];
  if (criteria.condition !== 'any' || configured.length) {
    return Array.from(new Set([...configured, ...heavyWorksKeywords].map(normalizeText).filter(Boolean)));
  }
  return configured.map(normalizeText).filter(Boolean);
};

const getHardRejectionReasons = (
  alert: Pick<SmartAlertFormData, 'ville' | 'postal_codes' | 'radius_km' | 'options_avancees'>,
  annonce: Annonce,
  criteria: SmartAlertCriteria,
  text: string
) => {
  const reasons: string[] = [];
  const city = normalizeText(annonce.city);
  const postalCode = normalizeText(annonce.postal_code);
  const mainCity = normalizeText(alert.ville);
  const postalCodes = (alert.postal_codes || []).map(normalizeText).filter(Boolean);
  const acceptedCities = criteria.acceptedCities.map(normalizeText).filter(Boolean);
  const excludedCities = criteria.excludedCities.map(normalizeText).filter(Boolean);
  const hasConfiguredLocation = Boolean(mainCity || postalCodes.length || acceptedCities.length);
  const hasExplicitExtendedArea = Number(alert.radius_km || 0) > 0 || acceptedCities.length > 0;
  const requiresExactLocation = Boolean(
    mainCity &&
    !hasExplicitExtendedArea &&
    (criteria.locationImportance === 'required' || criteria.searchMode !== 'opportunity')
  );

  if (excludedCities.some(excluded => hasCityMatch(city, excluded))) {
    reasons.push('Commune exclue');
  }

  if (postalCodes.length && postalCode && !postalCodes.some(code => postalCode.startsWith(code))) {
    reasons.push('Code postal hors zone demandée');
  }

  if (requiresExactLocation && !hasCityMatch(city, mainCity)) {
    reasons.push('Hors ville demandée');
  }

  if (!requiresExactLocation && hasConfiguredLocation && criteria.locationImportance === 'required') {
    const acceptedByLocation =
      (mainCity && hasCityMatch(city, mainCity)) ||
      acceptedCities.some(accepted => hasCityMatch(city, accepted)) ||
      (postalCodes.length && postalCodes.some(code => postalCode.startsWith(code)));
    if (!acceptedByLocation) reasons.push('Hors zone obligatoire');
  }

  if (getForbiddenWorkKeywords(criteria).some(keyword => text.includes(keyword))) {
    reasons.push('Travaux interdits mentionnés');
  }

  return reasons;
};

export const getSmartAlertBadge = (score: number) => {
  if (score >= 90) return { label: 'Match excellent', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (score >= 75) return { label: 'Très pertinent', tone: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (score >= 60) return { label: 'Pertinent', tone: 'bg-primary-100 text-primary-800 border-primary-200' };
  if (score >= 40) return { label: 'Opportunité possible', tone: 'bg-amber-100 text-amber-800 border-amber-200' };
  return { label: 'Faible correspondance', tone: 'bg-gray-100 text-gray-700 border-gray-200' };
};

export const thresholdForMode = (mode: SmartAlertCriteria['searchMode']) => {
  if (mode === 'strict') return 80;
  if (mode === 'opportunity') return 45;
  return 65;
};

export const parseNaturalLanguageCriteria = (text: string): Partial<SmartAlertFormData> => {
  const normalized = normalizeText(text);
  const priceMatch = normalized.match(/(?:budget|max|maximum|jusqu.?a|moins de)\D{0,12}(\d{2,3})(?:\s?000|k)/);
  const surfaceMatch = normalized.match(/(\d{2,3})\s?m/);
  const bedroomMatch = normalized.match(/(\d+)\s?(?:chambre|chambres)/);
  const cityMatch = normalized.match(/\b(autour de|proche de|pres de|a|sur)\s+([a-z-\s]+?)(?:,| avec| minimum| min| budget| proche| sans| peu| travaux|$)/);
  const criteria: Partial<SmartAlertFormData> = {};
  const options: Partial<SmartAlertCriteria> = {};

  if (normalized.includes('maison')) criteria.type_de_bien = 'Maison';
  if (normalized.includes('appartement')) criteria.type_de_bien = 'Appartement';
  if (normalized.includes('immeuble')) criteria.type_de_bien = 'Immeuble';
  if (priceMatch) criteria.prix_max = Number(priceMatch[1]) * 1000;
  if (surfaceMatch) criteria.surface_min = Number(surfaceMatch[1]);
  if (bedroomMatch) criteria.bedrooms_min = Number(bedroomMatch[1]);
  if (cityMatch) {
    const locationPrefix = cityMatch[1];
    const city = cityMatch[2].trim().replace(/\s+/g, ' ');
    criteria.ville = city.charAt(0).toUpperCase() + city.slice(1);
    if (locationPrefix.includes('autour') || locationPrefix.includes('proche') || locationPrefix.includes('pres')) {
      options.locationImportance = 'high';
      criteria.radius_km = 10;
    } else {
      options.locationImportance = 'required';
      criteria.radius_km = 0;
    }
  }
  if (normalized.includes('jardin')) options.exterior = 'required';
  if (normalized.includes('garage')) {
    options.parking = { ...defaultSmartAlertCriteria.parking, garage: 'medium' };
  }
  if (normalized.includes('ecole')) {
    options.positiveKeywords = [{ value: 'proche écoles', importance: 'medium' }];
  }
  if (normalized.includes('sans travaux')) {
    options.condition = 'ready';
    options.forbiddenWorks = heavyWorksKeywords;
  } else if (normalized.includes('peu de travaux')) {
    options.condition = 'light';
    options.forbiddenWorks = heavyWorksKeywords;
  }

  return {
    ...criteria,
    options_avancees: {
      ...defaultSmartAlertCriteria,
      ...options,
      naturalLanguage: text,
    },
  };
};

export const scoreAnnonceForAlert = (
  alert: Pick<SmartAlertFormData, 'ville' | 'postal_codes' | 'radius_km' | 'prix_min' | 'prix_max' | 'surface_min' | 'surface_max' | 'rooms_min' | 'bedrooms_min' | 'type_de_bien' | 'options_avancees'>,
  annonce: Annonce
) => {
  const criteria = { ...defaultSmartAlertCriteria, ...alert.options_avancees };
  const weights = resolveScoreWeights(criteria.scoreWeights);
  const totalWeight = Math.max(1, Object.values(weights).reduce((sum, value) => sum + value, 0));
  const text = normalizeText(`${annonce.title} ${annonce.description} ${annonce.city} ${annonce.postal_code || ''} ${annonce.type_de_bien} ${annonce.owner_type || ''} ${annonce.dpe || ''} ${stringifySourceData(annonce.source_data)}`);
  const pointsForts: string[] = [];
  const pointsFaibles: string[] = [];
  const breakdown: ScoreBreakdown = {
    localisation: 0,
    budget: 0,
    type: 0,
    surface: 0,
    exterieur: 0,
    etat: 0,
    dpe: 0,
    motsCles: 0,
  };

  const city = normalizeText(annonce.city);
  const postalCode = normalizeText(annonce.postal_code);
  const mainCity = normalizeText(alert.ville);
  const postalCodes = (alert.postal_codes || []).map(normalizeText).filter(Boolean);
  const acceptedCities = criteria.acceptedCities.map(normalizeText).filter(Boolean);
  const excludedCities = criteria.excludedCities.map(normalizeText).filter(Boolean);
  const rejectionReasons = getHardRejectionReasons(alert, annonce, criteria, text);

  if (rejectionReasons.length) {
    return {
      score: 0,
      breakdown,
      pointsForts,
      pointsFaibles: rejectionReasons.slice(0, 5),
      resume: `Annonce écartée automatiquement: ${rejectionReasons.join(', ')}.`,
    };
  }

  if (excludedCities.some(excluded => city.includes(excluded))) {
    pointsFaibles.push('Commune exclue dans la recherche');
  } else if (postalCodes.length && postalCodes.some(code => postalCode.startsWith(code))) {
    breakdown.localisation = weights.localisation;
    pointsForts.push('Code postal correspondant');
  } else if (!mainCity && acceptedCities.length === 0) {
    breakdown.localisation = weightedPoints(18 / 25, weights.localisation);
    pointsForts.push('Localisation non restrictive');
  } else if (mainCity && city.includes(mainCity)) {
    breakdown.localisation = weights.localisation;
    pointsForts.push('Ville principale correspondante');
  } else if (acceptedCities.some(accepted => city.includes(accepted))) {
    breakdown.localisation = weightedPoints(22 / 25, weights.localisation);
    pointsForts.push('Commune acceptée');
  } else {
    const ratio = alert.radius_km > 0 && criteria.locationImportance !== 'required' ? 12 : 10;
    breakdown.localisation = weightedPoints((criteria.locationImportance === 'required' ? 2 : ratio) / 25, weights.localisation);
    pointsFaibles.push('Localisation à vérifier');
  }

  const tolerance = criteria.searchMode === 'strict' ? 0 : criteria.searchMode === 'opportunity' ? 0.1 : 0.05;
  const maxPrice = alert.prix_max ? alert.prix_max * (1 + tolerance) : undefined;
  if (!alert.prix_max && !alert.prix_min) {
    breakdown.budget = weightedPoints(14 / 20, weights.budget);
  } else if ((alert.prix_min === undefined || annonce.price >= alert.prix_min) && (maxPrice === undefined || annonce.price <= maxPrice)) {
    breakdown.budget = annonce.price <= (alert.prix_max || Infinity)
      ? weights.budget
      : weightedPoints(16 / 20, weights.budget);
    pointsForts.push(annonce.price <= (alert.prix_max || Infinity) ? 'Budget respecté' : 'Prix dans la tolérance');
  } else {
    breakdown.budget = weightedPoints(4 / 20, weights.budget);
    pointsFaibles.push('Budget hors cible');
  }

  const propertyTypes = [...criteria.propertyTypes, alert.type_de_bien].map(normalizeText).filter(Boolean);
  if (propertyTypes.length === 0) {
    breakdown.type = weightedPoints(10 / 15, weights.type);
  } else if (propertyTypes.some(type => normalizeText(annonce.type_de_bien).includes(type))) {
    breakdown.type = weights.type;
    pointsForts.push('Type de bien exact');
  } else if (criteria.secondaryTypes.some(type => normalizeText(annonce.type_de_bien).includes(normalizeText(type)))) {
    breakdown.type = weightedPoints(9 / 15, weights.type);
    pointsForts.push('Type de bien accepté secondairement');
  } else {
    pointsFaibles.push('Type de bien différent');
  }

  const sourceOwnerType = annonce.source_data && typeof annonce.source_data === 'object'
    ? String((annonce.source_data as Record<string, unknown>).owner_type || '')
    : '';
  const sellerType = normalizeText(annonce.owner_type || sourceOwnerType);
  if (criteria.sellerType === 'particulier' && sellerType && !sellerType.includes('particulier')) {
    pointsFaibles.push('Vendeur professionnel détecté');
    breakdown.type = Math.min(breakdown.type, weightedPoints(7 / 15, weights.type));
  }
  if (criteria.sellerType === 'pro' && sellerType && !sellerType.includes('pro')) {
    pointsFaibles.push('Vendeur particulier détecté');
    breakdown.type = Math.min(breakdown.type, weightedPoints(7 / 15, weights.type));
  }

  const surfaceOk = alert.surface_min === undefined || annonce.size >= alert.surface_min;
  const surfaceMaxOk = alert.surface_max === undefined || annonce.size <= alert.surface_max;
  const roomsOk = alert.rooms_min === undefined || annonce.rooms >= alert.rooms_min;
  const bedroomsOk = alert.bedrooms_min === undefined || annonce.bedrooms >= alert.bedrooms_min;
  breakdown.surface = weightedPoints((Number(surfaceOk) + Number(surfaceMaxOk) + Number(roomsOk) + Number(bedroomsOk)) / 4, weights.surface);
  if (breakdown.surface >= weightedPoints(12 / 15, weights.surface)) pointsForts.push('Surface et pièces cohérentes');
  else pointsFaibles.push('Surface ou pièces en écart');

  const hasExterior = ['jardin', 'terrain', 'terrasse', 'balcon', 'cour', 'piscine'].some(k => text.includes(k));
  const expectedParking = Object.entries(criteria.parking || {}).filter(([, importance]) => importance !== 'any');
  const parkingMatches = expectedParking.filter(([key]) => text.includes(normalizeText(key)));
  if (criteria.exterior === 'any') {
    breakdown.exterieur = weightedPoints((parkingMatches.length ? 8 : 6) / 10, weights.exterieur);
  } else if (hasExterior && criteria.exterior !== 'not_wanted') {
    breakdown.exterieur = weights.exterieur;
    pointsForts.push('Extérieur détecté');
  } else if (!hasExterior && criteria.exterior === 'required') {
    pointsFaibles.push('Extérieur obligatoire non détecté');
  } else {
    breakdown.exterieur = weightedPoints(4 / 10, weights.exterieur);
  }
  if (parkingMatches.length) pointsForts.push('Stationnement ou annexe détecté');

  const forbiddenFound = getForbiddenWorkKeywords(criteria).some(work => text.includes(work));
  if (forbiddenFound) {
    breakdown.etat = weightedPoints(1 / 5, weights.etat);
    pointsFaibles.push('Travaux interdits mentionnés');
  } else {
    breakdown.etat = criteria.condition === 'any' ? weightedPoints(4 / 5, weights.etat) : weights.etat;
    pointsForts.push('Aucun signal bloquant sur les travaux');
  }

  if (!annonce.dpe || criteria.dpeAccepted.includes(annonce.dpe.toUpperCase())) {
    breakdown.dpe = annonce.dpe ? weights.dpe : weightedPoints(3 / 5, weights.dpe);
    if (annonce.dpe) pointsForts.push('DPE compatible');
  } else {
    pointsFaibles.push('DPE hors cible');
  }

  let keywordScore = 2;
  criteria.positiveKeywords.forEach(keyword => {
    if (text.includes(normalizeText(keyword.value))) {
      keywordScore += 3 * keywordWeight(keyword.importance);
      pointsForts.push(`Mot-clé détecté: ${keyword.value}`);
    } else if (keyword.importance === 'required') {
      pointsFaibles.push(`Mot-clé obligatoire absent: ${keyword.value}`);
    }
  });
  criteria.negativeKeywords.forEach(keyword => {
    if (text.includes(normalizeText(keyword.value))) {
      keywordScore -= 4 * keywordWeight(keyword.importance);
      pointsFaibles.push(`Mot-clé exclu détecté: ${keyword.value}`);
    }
  });

  if (criteria.investor?.enabled) {
    const pricePerSqm = annonce.price && annonce.size ? annonce.price / annonce.size : null;
    if (criteria.investor.maxPricePerSqm && pricePerSqm && pricePerSqm <= criteria.investor.maxPricePerSqm) {
      keywordScore += 1;
      pointsForts.push('Prix au m² compatible investisseur');
    } else if (criteria.investor.maxPricePerSqm && pricePerSqm) {
      keywordScore -= 1;
      pointsFaibles.push('Prix au m² au-dessus de la cible');
    }
    criteria.investor.potential.forEach(signal => {
      if (text.includes(normalizeText(signal))) {
        keywordScore += 1;
        pointsForts.push(`Potentiel investisseur: ${signal}`);
      }
    });
  }
  breakdown.motsCles = weightedPoints(Math.max(0, Math.min(5, keywordScore)) / 5, weights.motsCles);

  const rawScore = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const score = Math.max(0, Math.min(100, Math.round((rawScore / totalWeight) * 100)));
  const resume = score >= 75
    ? 'Cette annonce correspond fortement à la recherche et mérite une action rapide.'
    : score >= 60
      ? 'Cette annonce présente plusieurs critères compatibles et mérite une vérification.'
      : score >= 40
        ? 'Cette annonce ne coche pas tout, mais peut rester une opportunité à qualifier.'
        : 'Cette annonce semble éloignée de la recherche actuelle.';

  return {
    score,
    breakdown,
    pointsForts: pointsForts.slice(0, 6),
    pointsFaibles: pointsFaibles.slice(0, 5),
    resume,
  };
};

const mapAlertRow = (row: any): SmartAlert => ({
  ...row,
  options_avancees: {
    ...defaultSmartAlertCriteria,
    ...(row.options_avancees || {}),
    scoreWeights: resolveScoreWeights(row.options_avancees?.scoreWeights),
  },
  client: row.client || null,
});

const validateAlertForm = (form: SmartAlertFormData) => {
  if (!form.nom_alerte.trim()) return 'Le nom de la recherche est obligatoire';
  if (form.matching_threshold < 0 || form.matching_threshold > 100) return 'Le seuil doit être compris entre 0 et 100';
  if (form.radius_km < 0) return 'Le rayon doit être positif';
  if (form.prix_min !== undefined && form.prix_max !== undefined && form.prix_min > form.prix_max) return 'Le budget minimum doit rester inférieur au budget maximum';
  if (form.surface_min !== undefined && form.surface_max !== undefined && form.surface_min > form.surface_max) return 'La surface minimum doit rester inférieure à la surface maximum';
  return null;
};

const smartAlertErrorMessage = (error: { message?: string; code?: string }) => {
  const message = error.message || '';
  if (error.code === '42P01' || message.includes('public.alertes') || message.includes('public.alertes_resultats')) {
    return "Les tables Supabase des alertes intelligentes ne sont pas encore installées. Lance les migrations Supabase avant d'enregistrer une recherche.";
  }
  if (message.includes('public.clients')) {
    return "La table clients n'est pas encore installée dans Supabase. Les alertes restent utilisables sans client associé après migration du module.";
  }
  return message || 'Erreur Supabase inconnue';
};

const alertFormPayload = (form: SmartAlertFormData, appUser: { id: string; agency_id?: string }) => ({
  user_id: appUser.id,
  agency_id: appUser.agency_id || null,
  client_id: form.client_id || null,
  nom_alerte: form.nom_alerte.trim(),
  type_recherche: form.type_recherche,
  statut: form.statut,
  priorite: form.priorite,
  ville: form.ville || null,
  postal_codes: form.postal_codes,
  radius_km: form.radius_km,
  type_de_bien: form.type_de_bien || null,
  prix_min: form.prix_min ?? null,
  prix_max: form.prix_max ?? null,
  surface_min: form.surface_min ?? null,
  surface_max: form.surface_max ?? null,
  rooms_min: form.rooms_min ?? null,
  bedrooms_min: form.bedrooms_min ?? null,
  matching_threshold: Math.max(0, Math.min(100, form.matching_threshold)),
  frequence_analyse: form.frequence_analyse,
  options_avancees: form.options_avancees,
  is_active: form.statut === 'active',
  updated_at: new Date().toISOString(),
});

export const useSmartAlerts = () => {
  const { appUser } = useAuth();
  const activityScope = useActivityScope();
  const [clients, setClients] = useState<Client[]>([]);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [results, setResults] = useState<AlertMatchResult[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAlert = useMemo(
    () => alerts.find(alert => alert.id === selectedAlertId) || alerts[0] || null,
    [alerts, selectedAlertId]
  );

  const fetchClients = useCallback(async () => {
    if (!appUser) return;
    const query = supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    const { data, error: queryError } = await query;
    if (queryError) {
      if (queryError.code === '42P01' || queryError.message.includes('does not exist')) {
        setClients([]);
        return;
      }
      throw queryError;
    }
    setClients(data || []);
  }, [appUser]);

  const fetchAlerts = useCallback(async () => {
    if (!appUser) return;
    const { data, error: queryError } = await supabase
      .from('alertes')
      .select('*')
      .order('created_at', { ascending: false });

    if (queryError) throw queryError;
    const mapped = (data || []).map(mapAlertRow);
    setAlerts(mapped);
    setSelectedAlertId(prev => prev || mapped[0]?.id || null);
  }, [appUser]);

  const fetchNotifications = useCallback(async () => {
    if (!appUser) return;
    const { data, error: queryError } = await supabase
      .from('alertes_notifications')
      .select('*')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (queryError) throw queryError;
    setNotifications(data || []);
  }, [appUser]);

  const fetchResults = useCallback(async (alertId?: string | null) => {
    const targetAlertId = alertId || selectedAlertId;
    if (!targetAlertId) {
      setResults([]);
      return;
    }
    const { data, error: queryError } = await supabase
      .from('alertes_resultats')
      .select('*, annonce:annonces(*)')
      .eq('alerte_id', targetAlertId)
      .order('score_pertinence', { ascending: false })
      .limit(100);
    if (queryError) throw queryError;
    setResults((data || []).map(row => ({
      ...row,
      score_breakdown: row.score_breakdown || {},
      points_forts: row.points_forts || [],
      points_faibles: row.points_faibles || [],
      annonce: row.annonce || null,
    })));
  }, [selectedAlertId]);

  const refresh = useCallback(async () => {
    if (!appUser) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchClients(), fetchAlerts(), fetchNotifications()]);
    } catch (err: any) {
      setError(smartAlertErrorMessage(err) || 'Impossible de charger les alertes intelligentes');
    } finally {
      setLoading(false);
    }
  }, [appUser, fetchAlerts, fetchClients, fetchNotifications]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void fetchResults(selectedAlertId);
  }, [fetchResults, selectedAlertId]);

  const createClient = async (client: Pick<Client, 'first_name' | 'last_name' | 'email' | 'phone' | 'notes'>) => {
    if (!appUser) throw new Error('Utilisateur introuvable');
    const { data, error: queryError } = await supabase
      .from('clients')
      .insert({
        ...client,
        user_id: appUser.id,
        agency_id: appUser.agency_id || null,
        status: 'active_search',
      })
      .select()
      .single();
    if (queryError) throw queryError;
    setClients(prev => [data, ...prev]);
    toast.success('Client créé');
    return data as Client;
  };

  const saveAlert = async (form: SmartAlertFormData, alertId?: string) => {
    if (!appUser) throw new Error('Utilisateur introuvable');
    const validationError = validateAlertForm(form);
    if (validationError) throw new Error(validationError);
    const payload = alertFormPayload(form, appUser);

    const query = alertId
      ? supabase.from('alertes').update(payload).eq('id', alertId)
      : supabase.from('alertes').insert(payload);

    const { data, error: queryError } = await query
      .select('*')
      .single();
    if (queryError) throw new Error(smartAlertErrorMessage(queryError));
    const alert = mapAlertRow(data);
    setAlerts(prev => alertId
      ? prev.map(item => item.id === alert.id ? alert : item)
      : [alert, ...prev]
    );
    setSelectedAlertId(alert.id);
    toast.success(alertId ? 'Recherche mise à jour' : 'Recherche sauvegardée');
    return alert;
  };

  const updateAlertStatus = async (alertId: string, statut: SmartAlert['statut']) => {
    const { data, error: queryError } = await supabase
      .from('alertes')
      .update({
        statut,
        is_active: statut === 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .select('*')
      .single();
    if (queryError) throw queryError;
    const alert = mapAlertRow(data);
    setAlerts(prev => prev.map(item => item.id === alert.id ? alert : item));
    toast.success(statut === 'active' ? 'Recherche réactivée' : statut === 'paused' ? 'Recherche mise en pause' : 'Recherche archivée');
    return alert;
  };

  const deleteAlert = async (alertId: string) => {
    const { error: queryError } = await supabase
      .from('alertes')
      .delete()
      .eq('id', alertId);
    if (queryError) throw queryError;
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    setResults(prev => prev.filter(result => result.alerte_id !== alertId));
    setSelectedAlertId(prev => prev === alertId ? null : prev);
    toast.success('Recherche supprimée');
  };

  const duplicateAlert = async (alert: SmartAlert) => {
    const duplicated = await saveAlert({
      nom_alerte: `${alert.nom_alerte} - copie`,
      type_recherche: alert.type_recherche,
      client_id: alert.client_id || undefined,
      statut: 'paused',
      priorite: alert.priorite,
      ville: alert.ville || '',
      postal_codes: alert.postal_codes || [],
      radius_km: alert.radius_km,
      type_de_bien: alert.type_de_bien || '',
      prix_min: alert.prix_min ?? undefined,
      prix_max: alert.prix_max ?? undefined,
      surface_min: alert.surface_min ?? undefined,
      surface_max: alert.surface_max ?? undefined,
      rooms_min: alert.rooms_min ?? undefined,
      bedrooms_min: alert.bedrooms_min ?? undefined,
      matching_threshold: alert.matching_threshold,
      frequence_analyse: alert.frequence_analyse,
      options_avancees: alert.options_avancees,
    });
    toast.success('Copie créée en pause');
    return duplicated;
  };

  const runMatching = async (alert: SmartAlert | SmartAlertFormData) => {
    if (!appUser) throw new Error('Utilisateur introuvable');
    setMatching(true);
    try {
      const criteriaAlert = 'id' in alert ? alert : {
        ...alert,
        id: '',
        user_id: appUser.id,
        agency_id: appUser.agency_id || null,
        client_id: alert.client_id || null,
        is_active: alert.statut === 'active',
        created_at: new Date().toISOString(),
      } as SmartAlert;

      if ('id' in alert && alert.id && alert.statut !== 'active') {
        toast.error('Seules les recherches actives peuvent lancer une analyse');
        return 0;
      }

      if ('id' in alert && alert.id) {
        const { data, error: invokeError } = await supabase.functions.invoke('smart-alert-matcher', {
          body: { alerte_id: alert.id },
        });

        if (!invokeError) {
          await fetchResults(alert.id);
          await fetchNotifications();
          await fetchAlerts();
          const matched = Number((data as any)?.matched || 0);
          toast.success(`${matched} annonce(s) matchée(s)`);
          return matched;
        }

        console.warn('[smart-alert-matcher] fallback local matching', invokeError);
      }

      const { data: annoncesData, error: annoncesError } = await supabase
        .from('annonces_with_relative_date')
        .select('*')
        .eq('supprimee', false)
        .neq('en_ligne', false)
        .limit(250);
      if (annoncesError) throw annoncesError;

      const scored = (annoncesData || [])
        .map((annonce: Annonce) => {
          const score = scoreAnnonceForAlert({
            ville: criteriaAlert.ville || '',
            postal_codes: criteriaAlert.postal_codes || [],
            radius_km: criteriaAlert.radius_km || 0,
            prix_min: criteriaAlert.prix_min ?? undefined,
            prix_max: criteriaAlert.prix_max ?? undefined,
            surface_min: criteriaAlert.surface_min ?? undefined,
            surface_max: criteriaAlert.surface_max ?? undefined,
            rooms_min: criteriaAlert.rooms_min ?? undefined,
            bedrooms_min: criteriaAlert.bedrooms_min ?? undefined,
            type_de_bien: criteriaAlert.type_de_bien || '',
            options_avancees: criteriaAlert.options_avancees,
          }, annonce);
          return { annonce, ...score };
        })
        .filter(result => result.score >= criteriaAlert.matching_threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, 80);

      if ('id' in alert && alert.id) {
        const { data: existingRows, error: existingError } = await supabase
          .from('alertes_resultats')
          .select('id, annonce_id, statut_commercial')
          .eq('alerte_id', alert.id);
        if (existingError) throw existingError;

        const keptAnnonceIds = new Set(scored.map(result => result.annonce.id));
        const staleRows = (existingRows || []).filter(row =>
          !keptAnnonceIds.has(row.annonce_id) &&
          ['new', 'viewed'].includes(String(row.statut_commercial || 'new'))
        );

        if (staleRows.length) {
          const { error: deleteStaleError } = await supabase
            .from('alertes_resultats')
            .delete()
            .in('id', staleRows.map(row => row.id));
          if (deleteStaleError) throw deleteStaleError;
        }
      }

      if ('id' in alert && alert.id && scored.length) {
        const rows = scored.map(result => ({
          alerte_id: alert.id,
          annonce_id: result.annonce.id,
          score_pertinence: result.score,
          score_breakdown: result.breakdown,
          points_forts: result.pointsForts,
          points_faibles: result.pointsFaibles,
          resume: result.resume,
          statut_commercial: 'new',
          date_matching: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        const { error: upsertError } = await supabase
          .from('alertes_resultats')
          .upsert(rows, { onConflict: 'alerte_id,annonce_id' });
        if (upsertError) throw upsertError;

        const best = scored[0];
        if (best) {
          await supabase.from('alertes_notifications').insert({
            alerte_id: alert.id,
            user_id: appUser.id,
            type_notification: 'in_app',
            contenu: {
              title: 'Nouveaux matches détectés',
              message: `${scored.length} annonce(s) dépassent le seuil de ${criteriaAlert.matching_threshold} %.`,
              score: best.score,
              annonce_id: best.annonce.id,
              alerte_id: alert.id,
            },
            envoye: true,
            date_envoi: new Date().toISOString(),
          });
        }

        await supabase
          .from('alertes')
          .update({ last_matching_date: new Date().toISOString() })
          .eq('id', alert.id);
        await fetchResults(alert.id);
        await fetchNotifications();
      } else if ('id' in alert && alert.id) {
        await supabase
          .from('alertes')
          .update({ last_matching_date: new Date().toISOString() })
          .eq('id', alert.id);
        await fetchResults(alert.id);
      } else {
        setResults(scored.map((result, index) => ({
          id: `preview-${result.annonce.id}-${index}`,
          alerte_id: '',
          annonce_id: result.annonce.id,
          score_pertinence: result.score,
          score_breakdown: result.breakdown,
          points_forts: result.pointsForts,
          points_faibles: result.pointsFaibles,
          resume: result.resume,
          statut_commercial: 'new',
          consulte: false,
          date_matching: new Date().toISOString(),
          created_at: new Date().toISOString(),
          annonce: result.annonce,
        })));
      }

      toast.success(`${scored.length} annonce(s) matchée(s)`);
      return scored.length;
    } catch (err: any) {
      toast.error(err.message || 'Erreur pendant le matching');
      throw err;
    } finally {
      setMatching(false);
    }
  };

  const updateResultStatus = async (resultId: string, status: AlertResultStatus) => {
    if (resultId.startsWith('preview-')) {
      setResults(prev => prev.map(result => result.id === resultId ? { ...result, statut_commercial: status } : result));
      return;
    }
    const { error: queryError } = await supabase
      .from('alertes_resultats')
      .update({
        statut_commercial: status,
        consulte: true,
        date_consultation: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', resultId);
    if (queryError) throw queryError;
    setResults(prev => prev.map(result => result.id === resultId ? { ...result, statut_commercial: status, consulte: true } : result));
  };

  const addFavorite = async (annonceId: string, resultId?: string) => {
    if (!appUser) throw new Error('Utilisateur introuvable');
    await savePropertyFavorite({ annonceId, userId: appUser.id, activityScope });
    if (resultId) await updateResultStatus(resultId, 'favorite');
    toast.success('Ajouté aux favoris');
  };

  const addToFollowUp = async (annonceId: string, resultId?: string, statut = 'to_process') => {
    if (!appUser) throw new Error('Utilisateur introuvable');
    const actionType: PropertyActionType =
      statut === 'to_call' ? 'reminder' :
      statut === 'called' ? 'called' :
      statut === 'rdv' ? 'rdv' :
      statut === 'hidden' ? 'hidden' :
      'to_call';

    await savePropertyAction({
      annonceId,
      userId: appUser.id,
      activityScope,
      actionType,
    });
    if (resultId) await updateResultStatus(resultId, 'followed');
    toast.success(statut === 'to_call' ? 'Rappel préparé' : 'Ajouté au suivi');
  };

  const markNotificationRead = async (notificationId: string) => {
    const { error: queryError } = await supabase
      .from('alertes_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (queryError) throw queryError;
    setNotifications(prev => prev.map(notification => notification.id === notificationId ? { ...notification, read_at: new Date().toISOString() } : notification));
  };

  const toggleNotificationRead = async (notificationId: string, read: boolean) => {
    const readAt = read ? new Date().toISOString() : null;
    const { error: queryError } = await supabase
      .from('alertes_notifications')
      .update({ read_at: readAt })
      .eq('id', notificationId);
    if (queryError) throw queryError;
    setNotifications(prev => prev.map(notification => notification.id === notificationId ? { ...notification, read_at: readAt } : notification));
  };

  const prepareOutreachMessage = async (result: AlertMatchResult, mode: OutreachMode | 'email') => {
    if (!result.annonce) throw new Error('Annonce introuvable');
    const alert = alerts.find(item => item.id === result.alerte_id) || selectedAlert;
    const clientName = alert?.client ? `${alert.client.first_name} ${alert.client.last_name}` : 'votre client';
    const highlights = result.points_forts.slice(0, 3).join(', ');

    if (mode === 'email') {
      return [
        `Bonjour ${clientName},`,
        '',
        `J'ai repéré cette annonce qui correspond bien à votre recherche: ${result.annonce.title}.`,
        `Score GetFlaire: ${result.score_pertinence}/100.`,
        highlights ? `Points forts: ${highlights}.` : '',
        `Lien: ${result.annonce.url}`,
        '',
        'Souhaitez-vous que je la qualifie pour vous rapidement ?',
      ].filter(Boolean).join('\n');
    }

    const generated = await generateOutreach({
      annonce: result.annonce,
      mode,
      commercialProfile: appUser?.personalization_settings?.commercial_profile,
      userProfile: {
        firstName: appUser?.Prenom,
        lastName: appUser?.nom,
        phone: appUser?.telephone,
        email: appUser?.email,
        agencyName: appUser?.agency?.name,
      },
    });

    const suggestion = mode === 'sms'
      ? generated.smsSuggestions[0]
      : generated.callScripts[0];

    return suggestion?.body || `Annonce compatible (${result.score_pertinence}/100): ${result.annonce.title} - ${result.annonce.url}`;
  };

  return {
    clients,
    alerts,
    selectedAlert,
    selectedAlertId,
    setSelectedAlertId,
    results,
    notifications,
    loading,
    matching,
    error,
    createClient,
    saveAlert,
    updateAlertStatus,
    deleteAlert,
    duplicateAlert,
    runMatching,
    refresh,
    fetchResults,
    updateResultStatus,
    addFavorite,
    addToFollowUp,
    markNotificationRead,
    toggleNotificationRead,
    prepareOutreachMessage,
    toNumber,
  };
};
