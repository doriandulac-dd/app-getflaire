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
  nom_alerte: string;
  ville?: string | null;
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
  dpe?: string | null;
  en_ligne?: boolean | null;
  supprimee?: boolean | null;
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

function scoreAnnonce(alert: AlertRow, annonce: AnnonceRow) {
  const options = alert.options_avancees || {};
  const weights = resolveScoreWeights(options);
  const totalWeight = Math.max(1, Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0));
  const text = normalize(`${annonce.title || ''} ${annonce.description || ''} ${annonce.city || ''} ${annonce.type_de_bien || ''} ${annonce.dpe || ''}`);
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
  const targetCity = normalize(alert.ville);
  if (!targetCity) score_breakdown.localisation = weightedPoints(18 / 25, weights.localisation);
  else if (city.includes(targetCity)) {
    score_breakdown.localisation = weights.localisation;
    points_forts.push('Ville principale correspondante');
  } else {
    score_breakdown.localisation = weightedPoints(10 / 25, weights.localisation);
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

  if (!alert.type_de_bien) score_breakdown.type = weightedPoints(10 / 15, weights.type);
  else if (normalize(annonce.type_de_bien).includes(normalize(alert.type_de_bien))) {
    score_breakdown.type = weights.type;
    points_forts.push('Type de bien exact');
  } else {
    points_faibles.push('Type de bien différent');
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
  if (options.exterior === 'required' && !hasExterior) {
    points_faibles.push('Extérieur obligatoire non détecté');
  } else {
    score_breakdown.exterieur = hasExterior ? weights.exterieur : weightedPoints(6 / 10, weights.exterieur);
    if (hasExterior) points_forts.push('Extérieur détecté');
  }

  const forbiddenWorks = Array.isArray(options.forbiddenWorks) ? options.forbiddenWorks : [];
  const forbiddenFound = forbiddenWorks.some(work => text.includes(normalize(String(work))));
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
  let keywordScore = 2;
  positiveKeywords.forEach((keyword: any) => {
    const value = normalize(keyword?.value);
    if (value && text.includes(value)) {
      keywordScore += 1;
      points_forts.push(`Mot-clé détecté: ${keyword.value}`);
    }
  });
  score_breakdown.motsCles = weightedPoints(Math.min(5, keywordScore) / 5, weights.motsCles);

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

  if (scored.length) {
    const { error: upsertError } = await supabase
      .from('alertes_resultats')
      .upsert(scored.map(result => ({
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
      })), { onConflict: 'alerte_id,annonce_id' });
    if (upsertError) throw upsertError;

    const best = scored[0];
    await supabase.from('alertes_notifications').insert({
      alerte_id: alert.id,
      user_id: alert.user_id,
      type_notification: 'in_app',
      contenu: {
        title: 'Nouveau match alerte intelligente',
        message: `${scored.length} annonce(s) dépassent le seuil de ${alert.matching_threshold} %.`,
        score: best.score_pertinence,
        annonce_id: best.annonce.id,
        alerte_id: alert.id,
      },
      envoye: true,
      date_envoi: new Date().toISOString(),
    });
  }

  await supabase.from('alertes').update({ last_matching_date: new Date().toISOString() }).eq('id', alert.id);
  return scored.length;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const { alerte_id, process_jobs = false, limit = 25 } = body;

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

    return json({ error: 'Missing alerte_id or process_jobs=true' }, 400);
  } catch (error) {
    console.error('smart-alert-matcher error:', error);
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
