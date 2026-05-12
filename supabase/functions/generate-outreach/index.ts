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

type OutreachMode = 'call' | 'sms' | 'both';

type OutreachSuggestion = {
  title: string;
  angle: string;
  body: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalize = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const suggestionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'angle', 'body'],
  properties: {
    title: { type: 'string' },
    angle: { type: 'string' },
    body: { type: 'string' },
  },
};

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['callScripts', 'smsSuggestions'],
  properties: {
    callScripts: {
      type: 'array',
      minItems: 3,
      items: suggestionSchema,
    },
    smsSuggestions: {
      type: 'array',
      minItems: 3,
      items: suggestionSchema,
    },
  },
};

const extractOutputText = (response: any) => {
  if (typeof response?.output_text === 'string') return response.output_text;

  const chunks: string[] = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }

  return chunks.join('');
};

const normalizeSuggestions = (value: unknown): OutreachSuggestion[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      title: normalize((item as any)?.title),
      angle: normalize((item as any)?.angle),
      body: normalize((item as any)?.body),
    }))
    .filter((item) => item.title && item.angle && item.body)
    .slice(0, 3);
};

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return json({
        code: 'missing_openai_key',
        error: 'OPENAI_API_KEY is not configured',
      }, 503);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ code: 'unauthorized', error: 'Missing Authorization header' }, 401);
    }

    const token = authHeader.slice('Bearer '.length);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) return json({ code: 'unauthorized', error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const annonceId = normalize(body.annonce_id);
    const mode = (body.mode || 'both') as OutreachMode;

    if (!annonceId) return json({ code: 'invalid_request', error: 'annonce_id is required' }, 400);
    if (!['call', 'sms', 'both'].includes(mode)) return json({ code: 'invalid_request', error: 'Invalid mode' }, 400);

    const { data: annonce, error: annonceError } = await supabase
      .from('annonces')
      .select('id,title,description,price,size,rooms,bedrooms,type_de_bien,city,postal_code,adresse,owner_type,source,dpe,ges,publication_date')
      .eq('id', annonceId)
      .maybeSingle();

    if (annonceError) throw annonceError;
    if (!annonce) return json({ code: 'not_found', error: 'Annonce not found' }, 404);

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id,email,nom,Prenom,telephone,personalization_settings,agency:agencies(name)')
      .eq('id', user.id)
      .maybeSingle();

    if (userError) throw userError;
    if (!userRow) return json({ code: 'not_found', error: 'User profile not found' }, 404);

    const commercialProfile = userRow.personalization_settings?.commercial_profile || {};
    const agency = Array.isArray(userRow.agency) ? userRow.agency[0] : userRow.agency;
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';

    const promptPayload = {
      mode,
      annonce,
      utilisateur: {
        prenom: userRow.Prenom || '',
        nom: userRow.nom || '',
        email: userRow.email || user.email || '',
        telephone: userRow.telephone || '',
        agence: agency?.name || commercialProfile.agency_name || '',
      },
      profil_commercial: commercialProfile,
    };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [
              'Tu aides un professionnel immobilier à contacter un vendeur particulier depuis une annonce.',
              'Génère exactement 3 scripts d’appel et 3 SMS, même si le mode demandé ne concerne qu’un type: remplis toujours les deux listes.',
              'Les messages doivent être courts, naturels, personnalisés avec les informations disponibles, et ne jamais inventer de faits.',
              'N’utilise pas de promesse irréaliste, pas de pression, pas de formulation agressive.',
              'Les SMS doivent rester concis et envoyables tels quels.',
              'Réponds uniquement au format JSON demandé.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify(promptPayload),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'outreach_generation',
            strict: true,
            schema: responseSchema,
          },
        },
        temperature: 0.7,
        max_output_tokens: 2200,
      }),
    });

    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      console.error('[generate-outreach] OpenAI error', response.status, responseBody);
      return json({
        code: 'openai_error',
        error: 'OpenAI generation failed',
        status: response.status,
      }, 502);
    }

    const outputText = extractOutputText(responseBody);
    const parsed = JSON.parse(outputText);
    const callScripts = normalizeSuggestions(parsed.callScripts);
    const smsSuggestions = normalizeSuggestions(parsed.smsSuggestions);

    if (callScripts.length !== 3 || smsSuggestions.length !== 3) {
      return json({ code: 'invalid_output', error: 'Invalid OpenAI output shape' }, 502);
    }

    return json({ callScripts, smsSuggestions });
  } catch (error) {
    console.error('[generate-outreach] unexpected error', error);
    return json({ code: 'unexpected_error', error: 'Unexpected generation error' }, 500);
  }
});
