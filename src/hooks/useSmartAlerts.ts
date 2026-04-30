import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Annonce, Client } from '../types';
import { useAuth } from './useAuth';
import {
  AlertMatchResult,
  AlertNotification,
  AlertResultStatus,
  ScoreBreakdown,
  SmartAlert,
  SmartAlertCriteria,
  SmartAlertFormData,
  WeightedKeyword,
} from '../types/smartAlerts';

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
  const cityMatch = normalized.match(/(?:autour de|a|sur|proche de)\s+([a-z-\s]+?)(?:,| avec| minimum| min| budget| proche|$)/);
  const criteria: Partial<SmartAlertFormData> = {};
  const options: Partial<SmartAlertCriteria> = {};

  if (normalized.includes('maison')) criteria.type_de_bien = 'Maison';
  if (normalized.includes('appartement')) criteria.type_de_bien = 'Appartement';
  if (normalized.includes('immeuble')) criteria.type_de_bien = 'Immeuble';
  if (priceMatch) criteria.prix_max = Number(priceMatch[1]) * 1000;
  if (surfaceMatch) criteria.surface_min = Number(surfaceMatch[1]);
  if (bedroomMatch) criteria.bedrooms_min = Number(bedroomMatch[1]);
  if (cityMatch) {
    const city = cityMatch[1].trim().replace(/\s+/g, ' ');
    criteria.ville = city.charAt(0).toUpperCase() + city.slice(1);
  }
  if (normalized.includes('jardin')) options.exterior = 'required';
  if (normalized.includes('garage')) {
    options.parking = { ...defaultSmartAlertCriteria.parking, garage: 'medium' };
  }
  if (normalized.includes('ecole')) {
    options.positiveKeywords = [{ value: 'proche écoles', importance: 'medium' }];
  }
  if (normalized.includes('sans travaux') || normalized.includes('peu de travaux')) {
    options.condition = 'light';
    options.forbiddenWorks = ['gros travaux'];
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
  alert: Pick<SmartAlertFormData, 'ville' | 'prix_min' | 'prix_max' | 'surface_min' | 'surface_max' | 'rooms_min' | 'bedrooms_min' | 'type_de_bien' | 'options_avancees'>,
  annonce: Annonce
) => {
  const criteria = { ...defaultSmartAlertCriteria, ...alert.options_avancees };
  const text = normalizeText(`${annonce.title} ${annonce.description} ${annonce.city} ${annonce.type_de_bien} ${annonce.dpe || ''}`);
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
  const mainCity = normalizeText(alert.ville);
  const acceptedCities = criteria.acceptedCities.map(normalizeText).filter(Boolean);
  const excludedCities = criteria.excludedCities.map(normalizeText).filter(Boolean);

  if (excludedCities.some(excluded => city.includes(excluded))) {
    pointsFaibles.push('Commune exclue dans la recherche');
  } else if (!mainCity && acceptedCities.length === 0) {
    breakdown.localisation = 18;
    pointsForts.push('Localisation non restrictive');
  } else if (mainCity && city.includes(mainCity)) {
    breakdown.localisation = 25;
    pointsForts.push('Ville principale correspondante');
  } else if (acceptedCities.some(accepted => city.includes(accepted))) {
    breakdown.localisation = 22;
    pointsForts.push('Commune acceptée');
  } else {
    breakdown.localisation = criteria.locationImportance === 'required' ? 2 : 10;
    pointsFaibles.push('Localisation à vérifier');
  }

  const tolerance = criteria.searchMode === 'strict' ? 0 : criteria.searchMode === 'opportunity' ? 0.1 : 0.05;
  const maxPrice = alert.prix_max ? alert.prix_max * (1 + tolerance) : undefined;
  if (!alert.prix_max && !alert.prix_min) {
    breakdown.budget = 14;
  } else if ((alert.prix_min === undefined || annonce.price >= alert.prix_min) && (maxPrice === undefined || annonce.price <= maxPrice)) {
    breakdown.budget = annonce.price <= (alert.prix_max || Infinity) ? 20 : 16;
    pointsForts.push(annonce.price <= (alert.prix_max || Infinity) ? 'Budget respecté' : 'Prix dans la tolérance');
  } else {
    breakdown.budget = 4;
    pointsFaibles.push('Budget hors cible');
  }

  if (!alert.type_de_bien) {
    breakdown.type = 10;
  } else if (normalizeText(annonce.type_de_bien).includes(normalizeText(alert.type_de_bien))) {
    breakdown.type = 15;
    pointsForts.push('Type de bien exact');
  } else if (criteria.secondaryTypes.some(type => normalizeText(annonce.type_de_bien).includes(normalizeText(type)))) {
    breakdown.type = 9;
    pointsForts.push('Type de bien accepté secondairement');
  } else {
    pointsFaibles.push('Type de bien différent');
  }

  const surfaceOk = alert.surface_min === undefined || annonce.size >= alert.surface_min;
  const surfaceMaxOk = alert.surface_max === undefined || annonce.size <= alert.surface_max;
  const roomsOk = alert.rooms_min === undefined || annonce.rooms >= alert.rooms_min;
  const bedroomsOk = alert.bedrooms_min === undefined || annonce.bedrooms >= alert.bedrooms_min;
  breakdown.surface = Math.round((Number(surfaceOk) + Number(surfaceMaxOk) + Number(roomsOk) + Number(bedroomsOk)) / 4 * 15);
  if (breakdown.surface >= 12) pointsForts.push('Surface et pièces cohérentes');
  else pointsFaibles.push('Surface ou pièces en écart');

  const hasExterior = ['jardin', 'terrain', 'terrasse', 'balcon', 'cour', 'piscine'].some(k => text.includes(k));
  if (criteria.exterior === 'any') {
    breakdown.exterieur = 6;
  } else if (hasExterior && criteria.exterior !== 'not_wanted') {
    breakdown.exterieur = 10;
    pointsForts.push('Extérieur détecté');
  } else if (!hasExterior && criteria.exterior === 'required') {
    pointsFaibles.push('Extérieur obligatoire non détecté');
  } else {
    breakdown.exterieur = 4;
  }

  const forbiddenFound = criteria.forbiddenWorks.some(work => text.includes(normalizeText(work)));
  if (forbiddenFound) {
    breakdown.etat = 1;
    pointsFaibles.push('Travaux interdits mentionnés');
  } else {
    breakdown.etat = criteria.condition === 'any' ? 4 : 5;
    pointsForts.push('Aucun signal bloquant sur les travaux');
  }

  if (!annonce.dpe || criteria.dpeAccepted.includes(annonce.dpe.toUpperCase())) {
    breakdown.dpe = annonce.dpe ? 5 : 3;
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
  breakdown.motsCles = Math.max(0, Math.min(5, Math.round(keywordScore)));

  const score = Math.max(0, Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0)));
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
  options_avancees: { ...defaultSmartAlertCriteria, ...(row.options_avancees || {}) },
  client: row.client || null,
});

export const useSmartAlerts = () => {
  const { appUser } = useAuth();
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
    if (queryError) throw queryError;
    setClients(data || []);
  }, [appUser]);

  const fetchAlerts = useCallback(async () => {
    if (!appUser) return;
    const { data, error: queryError } = await supabase
      .from('alertes')
      .select('*, client:clients(*)')
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
      setError(err.message || 'Impossible de charger les alertes intelligentes');
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

  const saveAlert = async (form: SmartAlertFormData) => {
    if (!appUser) throw new Error('Utilisateur introuvable');
    const payload = {
      user_id: appUser.id,
      agency_id: appUser.agency_id || null,
      client_id: form.client_id || null,
      nom_alerte: form.nom_alerte,
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
      matching_threshold: form.matching_threshold,
      frequence_analyse: form.frequence_analyse,
      options_avancees: form.options_avancees,
      is_active: form.statut === 'active',
      updated_at: new Date().toISOString(),
    };

    const { data, error: queryError } = await supabase
      .from('alertes')
      .insert(payload)
      .select('*, client:clients(*)')
      .single();
    if (queryError) throw queryError;
    const alert = mapAlertRow(data);
    setAlerts(prev => [alert, ...prev]);
    setSelectedAlertId(alert.id);
    toast.success('Recherche sauvegardée');
    return alert;
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
    const { data: existing, error: existingError } = await supabase
      .from('favoris')
      .select('id')
      .eq('annonce_id', annonceId)
      .eq('user_id', appUser.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      const { error: queryError } = await supabase
        .from('favoris')
        .insert({
          annonce_id: annonceId,
          user_id: appUser.id,
          date_favoris: new Date().toISOString(),
        });
      if (queryError) throw queryError;
    }
    if (resultId) await updateResultStatus(resultId, 'favorite');
    toast.success('Ajouté aux favoris');
  };

  const addToFollowUp = async (annonceId: string, resultId?: string, statut = 'to_process') => {
    if (!appUser) throw new Error('Utilisateur introuvable');
    const { error: queryError } = await supabase
      .from('suivi_annonce')
      .upsert({
        annonce_id: annonceId,
        user_id: appUser.id,
        statut,
        date_suivi: new Date().toISOString(),
      });
    if (queryError) throw queryError;
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
    runMatching,
    refresh,
    fetchResults,
    updateResultStatus,
    addFavorite,
    addToFollowUp,
    markNotificationRead,
    toNumber,
  };
};
