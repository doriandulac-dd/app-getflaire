import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AlertRow = {
  id: string;
  user_id: string;
  statut?: string | null;
  is_active?: boolean | null;
  nom_alerte: string;
  ville?: string | null;
  postal_codes?: string[] | null;
  radius_km?: number | null;
  type_de_bien?: string | null;
  prix_min?: number | null;
  prix_max?: number | null;
  surface_min?: number | null;
  surface_max?: number | null;
  rooms_min?: number | null;
  bedrooms_min?: number | null;
  matching_threshold: number;
  options_avancees?: Record<string, unknown> | null;
};

type AnnonceRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  price?: number | null;
  size?: number | null;
  rooms?: number | null;
  bedrooms?: number | null;
  type_de_bien?: string | null;
  city?: string | null;
  postal_code?: string | null;
  owner_type?: string | null;
  dpe?: string | null;
  en_ligne?: boolean | null;
  supprimee?: boolean | null;
  source_data?: Record<string, unknown> | null;
};

const defaultScoreWeights = {
  localisation: 25,
  budget: 20,
  type: 15,
  surface: 15,
  exterieur: 10,
  etat: 5,
  dpe: 5,
  motsCles: 5,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalize = (value?: string | null) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const resolveScoreWeights = (options: Record<string, unknown>) => ({
  ...defaultScoreWeights,
  ...((options.scoreWeights && typeof options.scoreWeights === 'object') ? options.scoreWeights as Record<string, number> : {}),
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

const keywordWeight = (importance: string) => {
  if (importance === 'required') return 1;
  if (importance === 'high') return 0.85;
  if (importance === 'medium') return 0.6;
  return 0.35;
};

const optionList = (options: Record<string, unknown>, key: string) =>
  Array.isArray(options[key]) ? options[key] as unknown[] : [];

const normalizedOptionList = (options: Record<string, unknown>, key: string) =>
  optionList(options, key).map(item => normalize(String(item))).filter(Boolean);

const getForbiddenWorkKeywords = (options: Record<string, unknown>) => {
  const configured = Array.isArray(options.forbiddenWorks) ? options.forbiddenWorks.map(item => String(item)) : [];
  const condition = String(options.condition || 'any');
  if (condition !== 'any' || configured.length) {
    return Array.from(new Set([...configured, ...heavyWorksKeywords].map(normalize).filter(Boolean)));
  }
  return configured.map(normalize).filter(Boolean);
};

function getHardRejectionReasons(alert: AlertRow, annonce: AnnonceRow, options: Record<string, unknown>, text: string) {
  const reasons: string[] = [];
  const city = normalize(annonce.city);
  const postalCode = normalize(annonce.postal_code);
  const targetCity = normalize(alert.ville);
  const postalCodes = (alert.postal_codes || []).map(normalize).filter(Boolean);
  const acceptedCities = normalizedOptionList(options, 'acceptedCities');
  const excludedCities = normalizedOptionList(options, 'excludedCities');
  const locationImportance = String(options.locationImportance || 'high');
  const searchMode = String(options.searchMode || 'balanced');
  const hasConfiguredLocation = Boolean(targetCity || postalCodes.length || acceptedCities.length);
  const hasExplicitExtendedArea = Number(alert.radius_km || 0) > 0 || acceptedCities.length > 0;
  const requiresExactLocation = Boolean(
    targetCity &&
    !hasExplicitExtendedArea &&
    (locationImportance === 'required' || searchMode !== 'opportunity')
  );

  if (excludedCities.some(excluded => hasCityMatch(city, excluded))) {
    reasons.push('Commune exclue');
  }

  if (postalCodes.length && postalCode && !postalCodes.some(code => postalCode.startsWith(code))) {
    reasons.push('Code postal hors zone demandée');
  }

  if (requiresExactLocation && !hasCityMatch(city, targetCity)) {
    reasons.push('Hors ville demandée');
  }

  if (!requiresExactLocation && hasConfiguredLocation && locationImportance === 'required') {
    const acceptedByLocation =
      (targetCity && hasCityMatch(city, targetCity)) ||
      acceptedCities.some(accepted => hasCityMatch(city, accepted)) ||
      (postalCodes.length && postalCodes.some(code => postalCode.startsWith(code)));
    if (!acceptedByLocation) reasons.push('Hors zone obligatoire');
  }

  if (getForbiddenWorkKeywords(options).some(keyword => text.includes(keyword))) {
    reasons.push('Travaux interdits mentionnés');
  }

  return reasons;
}

function scoreAnnonce(alert: AlertRow, annonce: AnnonceRow) {
  const options = alert.options_avancees || {};
  const weights = resolveScoreWeights(options);
  const totalWeight = Math.max(1, Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0));
  const text = normalize(`${annonce.title || ''} ${annonce.description || ''} ${annonce.city || ''} ${annonce.postal_code || ''} ${annonce.type_de_bien || ''} ${annonce.owner_type || ''} ${annonce.dpe || ''} ${stringifySourceData(annonce.source_data)}`);
  const points_forts: string[] = [];
  const points_faibles: string[] = [];
  const score_breakdown = {
    localisation: 0,
    budget: 0,
    type: 0,
    surface: 0,
    exterieur: 0,
    etat: 0,
    dpe: 0,
    motsCles: 0,
  };

  const city = normalize(annonce.city);
  const postalCode = normalize(annonce.postal_code);
  const targetCity = normalize(alert.ville);
  const postalCodes = (alert.postal_codes || []).map(normalize).filter(Boolean);
  const acceptedCities = normalizedOptionList(options, 'acceptedCities');
  const excludedCities = normalizedOptionList(options, 'excludedCities');
  const locationImportance = String(options.locationImportance || 'high');
  const rejectionReasons = getHardRejectionReasons(alert, annonce, options, text);

  if (rejectionReasons.length) {
    return {
      score_pertinence: 0,
      score_breakdown,
      points_forts,
      points_faibles: rejectionReasons.slice(0, 5),
      resume: `Annonce écartée automatiquement: ${rejectionReasons.join(', ')}.`,
    };
  }

  if (excludedCities.some(excluded => city.includes(excluded))) {
    points_faibles.push('Commune exclue dans la recherche');
  } else if (postalCodes.length && postalCodes.some(code => postalCode.startsWith(code))) {
    score_breakdown.localisation = weights.localisation;
    points_forts.push('Code postal correspondant');
  } else if (!targetCity && acceptedCities.length === 0) score_breakdown.localisation = weightedPoints(18 / 25, weights.localisation);
  else if (city.includes(targetCity)) {
    score_breakdown.localisation = weights.localisation;
    points_forts.push('Ville principale correspondante');
  } else if (acceptedCities.some(accepted => city.includes(accepted))) {
    score_breakdown.localisation = weightedPoints(22 / 25, weights.localisation);
    points_forts.push('Commune acceptée');
  } else {
    const ratio = Number(alert.radius_km || 0) > 0 && locationImportance !== 'required' ? 12 : 10;
    score_breakdown.localisation = weightedPoints((locationImportance === 'required' ? 2 : ratio) / 25, weights.localisation);
    points_faibles.push('Localisation à vérifier');
  }

  const price = Number(annonce.price || 0);
  const tolerance = options.searchMode === 'opportunity' ? 1.1 : options.searchMode === 'strict' ? 1 : 1.05;
  if (!alert.prix_max || price <= Number(alert.prix_max) * tolerance) {
    score_breakdown.budget = alert.prix_max && price > Number(alert.prix_max)
      ? weightedPoints(16 / 20, weights.budget)
      : weights.budget;
    points_forts.push('Budget compatible');
  } else {
    score_breakdown.budget = weightedPoints(4 / 20, weights.budget);
    points_faibles.push('Budget hors cible');
  }

  const propertyTypes = [...normalizedOptionList(options, 'propertyTypes'), normalize(alert.type_de_bien)].filter(Boolean);
  if (propertyTypes.length === 0) score_breakdown.type = weightedPoints(10 / 15, weights.type);
  else if (propertyTypes.some(type => normalize(annonce.type_de_bien).includes(type))) {
    score_breakdown.type = weights.type;
    points_forts.push('Type de bien exact');
  } else if (normalizedOptionList(options, 'secondaryTypes').some(type => normalize(annonce.type_de_bien).includes(type))) {
    score_breakdown.type = weightedPoints(9 / 15, weights.type);
    points_forts.push('Type de bien accepté secondairement');
  } else {
    points_faibles.push('Type de bien différent');
  }

  const sellerType = normalize(annonce.owner_type || String(annonce.source_data?.owner_type || ''));
  if (options.sellerType === 'particulier' && sellerType && !sellerType.includes('particulier')) {
    points_faibles.push('Vendeur professionnel détecté');
    score_breakdown.type = Math.min(score_breakdown.type, weightedPoints(7 / 15, weights.type));
  }
  if (options.sellerType === 'pro' && sellerType && !sellerType.includes('pro')) {
    points_faibles.push('Vendeur particulier détecté');
    score_breakdown.type = Math.min(score_breakdown.type, weightedPoints(7 / 15, weights.type));
  }

  const checks = [
    !alert.surface_min || Number(annonce.size || 0) >= Number(alert.surface_min),
    !alert.surface_max || Number(annonce.size || 0) <= Number(alert.surface_max),
    !alert.rooms_min || Number(annonce.rooms || 0) >= Number(alert.rooms_min),
    !alert.bedrooms_min || Number(annonce.bedrooms || 0) >= Number(alert.bedrooms_min),
  ];
  score_breakdown.surface = weightedPoints(checks.filter(Boolean).length / checks.length, weights.surface);
  if (score_breakdown.surface >= weightedPoints(12 / 15, weights.surface)) points_forts.push('Surface et pièces cohérentes');
  else points_faibles.push('Surface ou pièces en écart');

  const hasExterior = ['jardin', 'terrain', 'terrasse', 'balcon', 'cour', 'piscine'].some(keyword => text.includes(keyword));
  const parking = options.parking && typeof options.parking === 'object' ? options.parking as Record<string, unknown> : {};
  const parkingMatches = Object.entries(parking)
    .filter(([, importance]) => importance !== 'any')
    .filter(([key]) => text.includes(normalize(key)));
  if (options.exterior === 'required' && !hasExterior) {
    points_faibles.push('Extérieur obligatoire non détecté');
  } else {
    score_breakdown.exterieur = hasExterior ? weights.exterieur : weightedPoints((parkingMatches.length ? 8 : 6) / 10, weights.exterieur);
    if (hasExterior) points_forts.push('Extérieur détecté');
  }
  if (parkingMatches.length) points_forts.push('Stationnement ou annexe détecté');

  const forbiddenFound = getForbiddenWorkKeywords(options).some(work => text.includes(work));
  score_breakdown.etat = forbiddenFound ? weightedPoints(1 / 5, weights.etat) : weights.etat;
  if (forbiddenFound) points_faibles.push('Travaux interdits mentionnés');

  const dpeAccepted = Array.isArray(options.dpeAccepted) ? options.dpeAccepted.map(String) : ['A', 'B', 'C', 'D', 'E'];
  if (!annonce.dpe || dpeAccepted.includes(String(annonce.dpe).toUpperCase())) {
    score_breakdown.dpe = annonce.dpe ? weights.dpe : weightedPoints(3 / 5, weights.dpe);
    if (annonce.dpe) points_forts.push('DPE compatible');
  } else {
    points_faibles.push('DPE hors cible');
  }

  const positiveKeywords = Array.isArray(options.positiveKeywords) ? options.positiveKeywords : [];
  const negativeKeywords = Array.isArray(options.negativeKeywords) ? options.negativeKeywords : [];
  let keywordScore = 2;
  positiveKeywords.forEach((keyword: any) => {
    const value = normalize(keyword?.value);
    if (value && text.includes(value)) {
      keywordScore += 3 * keywordWeight(String(keyword?.importance || 'medium'));
      points_forts.push(`Mot-clé détecté: ${keyword.value}`);
    } else if (keyword?.importance === 'required') {
      points_faibles.push(`Mot-clé obligatoire absent: ${keyword.value}`);
    }
  });
  negativeKeywords.forEach((keyword: any) => {
    const value = normalize(keyword?.value);
    if (value && text.includes(value)) {
      keywordScore -= 4 * keywordWeight(String(keyword?.importance || 'medium'));
      points_faibles.push(`Mot-clé exclu détecté: ${keyword.value}`);
    }
  });

  const investor = options.investor && typeof options.investor === 'object' ? options.investor as Record<string, unknown> : null;
  if (investor?.enabled) {
    const maxPricePerSqm = Number(investor.maxPricePerSqm || 0);
    const pricePerSqm = annonce.price && annonce.size ? Number(annonce.price) / Number(annonce.size) : null;
    if (maxPricePerSqm && pricePerSqm && pricePerSqm <= maxPricePerSqm) {
      keywordScore += 1;
      points_forts.push('Prix au m² compatible investisseur');
    } else if (maxPricePerSqm && pricePerSqm) {
      keywordScore -= 1;
      points_faibles.push('Prix au m² au-dessus de la cible');
    }
    if (Array.isArray(investor.potential)) {
      investor.potential.forEach((signal) => {
        if (text.includes(normalize(String(signal)))) {
          keywordScore += 1;
          points_forts.push(`Potentiel investisseur: ${signal}`);
        }
      });
    }
  }
  score_breakdown.motsCles = weightedPoints(Math.max(0, Math.min(5, keywordScore)) / 5, weights.motsCles);

  const rawScore = Object.values(score_breakdown).reduce((sum, value) => sum + value, 0);
  const score_pertinence = Math.max(0, Math.min(100, Math.round((rawScore / totalWeight) * 100)));
  const resume = score_pertinence >= 75
    ? 'Cette annonce correspond fortement à la recherche et mérite une action rapide.'
    : score_pertinence >= 60
      ? 'Cette annonce présente plusieurs critères compatibles et mérite une vérification.'
      : score_pertinence >= 40
        ? 'Cette annonce peut être une opportunité à qualifier.'
        : 'Cette annonce semble éloignée de la recherche actuelle.';

  return {
    score_pertinence,
    score_breakdown,
    points_forts: points_forts.slice(0, 6),
    points_faibles: points_faibles.slice(0, 5),
    resume,
  };
}

async function runAlertMatching(alert: AlertRow, annonceId?: string) {
  if (alert.statut && alert.statut !== 'active') return 0;
  if (alert.is_active === false) return 0;

  let query = supabase
    .from('annonces')
    .select('*')
    .eq('supprimee', false)
    .neq('en_ligne', false)
    .limit(300);

  if (annonceId) query = query.eq('id', annonceId);
  if (alert.type_de_bien) query = query.eq('type_de_bien', alert.type_de_bien);

  const { data: annonces, error: annoncesError } = await query;
  if (annoncesError) throw annoncesError;

  const scored = (annonces || [])
    .map((annonce: AnnonceRow) => ({ annonce, ...scoreAnnonce(alert, annonce) }))
    .filter(result => result.score_pertinence >= alert.matching_threshold)
    .sort((a, b) => b.score_pertinence - a.score_pertinence);

  const { data: existingRows, error: existingError } = await supabase
    .from('alertes_resultats')
    .select('id, annonce_id, statut_commercial')
    .eq('alerte_id', alert.id);
  if (existingError) throw existingError;

  if (!annonceId) {
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

  if (scored.length) {
    const existingIds = new Set((existingRows || []).map(row => row.annonce_id));
    const newResults = scored.filter(result => !existingIds.has(result.annonce.id));
    const existingResults = scored.filter(result => existingIds.has(result.annonce.id));

    if (newResults.length) {
      const { error: insertError } = await supabase
        .from('alertes_resultats')
        .insert(newResults.map(result => ({
          alerte_id: alert.id,
          annonce_id: result.annonce.id,
          score_pertinence: result.score_pertinence,
          score_breakdown: result.score_breakdown,
          points_forts: result.points_forts,
          points_faibles: result.points_faibles,
          resume: result.resume,
          statut_commercial: 'new',
          date_matching: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })));
      if (insertError) throw insertError;
    }

    for (const result of existingResults) {
      const { error: updateError } = await supabase
        .from('alertes_resultats')
        .update({
          score_pertinence: result.score_pertinence,
          score_breakdown: result.score_breakdown,
          points_forts: result.points_forts,
          points_faibles: result.points_faibles,
          resume: result.resume,
          date_matching: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('alerte_id', alert.id)
        .eq('annonce_id', result.annonce.id);
      if (updateError) throw updateError;
    }

    if (newResults.length) {
      const best = newResults[0];
      await supabase.from('alertes_notifications').insert({
        alerte_id: alert.id,
        user_id: alert.user_id,
        type_notification: 'in_app',
        contenu: {
          title: 'Nouveau match alerte intelligente',
          message: `${newResults.length} nouvelle(s) annonce(s) dépassent le seuil de ${alert.matching_threshold} %.`,
          score: best.score_pertinence,
          annonce_id: best.annonce.id,
          alerte_id: alert.id,
        },
        envoye: true,
        date_envoi: new Date().toISOString(),
      });
    }
  }

  await supabase.from('alertes').update({ last_matching_date: new Date().toISOString() }).eq('id', alert.id);
  return scored.length;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const { alerte_id, process_jobs = false, process_due = false, limit = 25 } = body;

    if (alerte_id) {
      const { data: alert, error } = await supabase.from('alertes').select('*').eq('id', alerte_id).single();
      if (error) throw error;
      const matched = await runAlertMatching(alert);
      return json({ matched });
    }

    if (process_jobs) {
      const { data: jobs, error: jobsError } = await supabase
        .from('alertes_matching_jobs')
        .select('*, alerte:alertes(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);
      if (jobsError) throw jobsError;

      let processed = 0;
      for (const job of jobs || []) {
        try {
          await supabase.from('alertes_matching_jobs').update({ status: 'processing', attempts: job.attempts + 1 }).eq('id', job.id);
          const matched = await runAlertMatching(job.alerte, job.annonce_id);
          await supabase.from('alertes_matching_jobs').update({ status: 'done', processed_at: new Date().toISOString() }).eq('id', job.id);
          processed += matched;
        } catch (error) {
          await supabase.from('alertes_matching_jobs').update({
            status: 'failed',
            last_error: error instanceof Error ? error.message : 'Unknown error',
            processed_at: new Date().toISOString(),
          }).eq('id', job.id);
        }
      }
      return json({ jobs: jobs?.length || 0, processed });
    }

    if (process_due) {
      const { data: alerts, error: alertsError } = await supabase
        .from('alertes')
        .select('*')
        .eq('is_active', true)
        .eq('statut', 'active')
        .in('frequence_analyse', ['hourly', 'twice_daily', 'daily'])
        .limit(limit);
      if (alertsError) throw alertsError;

      const now = Date.now();
      const dueAlerts = (alerts || []).filter((alert: AlertRow & { frequence_analyse?: string | null; last_matching_date?: string | null }) => {
        const lastRun = alert.last_matching_date ? new Date(alert.last_matching_date).getTime() : 0;
        const intervalMs =
          alert.frequence_analyse === 'daily' ? 24 * 60 * 60 * 1000 :
          alert.frequence_analyse === 'twice_daily' ? 12 * 60 * 60 * 1000 :
          60 * 60 * 1000;
        return !lastRun || now - lastRun >= intervalMs;
      });

      let processed = 0;
      for (const alert of dueAlerts) {
        processed += await runAlertMatching(alert);
      }
      return json({ alerts: dueAlerts.length, processed });
    }

    return json({ error: 'Missing alerte_id, process_jobs=true or process_due=true' }, 400);
  } catch (error) {
    console.error('smart-alert-matcher error:', error);
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
