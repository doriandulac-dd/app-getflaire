import type { Annonce, CommercialProfileSettings } from '../types';
import { supabase } from '../lib/supabase';
import {
  generateCallScripts,
  generateSmsSuggestions,
  type OutreachSuggestion,
} from './pigeOutreach';

export type OutreachMode = 'call' | 'sms' | 'both';

export type OutreachUserProfile = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  agencyName?: string;
};

export type OutreachResult = {
  callScripts: OutreachSuggestion[];
  smsSuggestions: OutreachSuggestion[];
  source: 'ai' | 'fallback';
  fallbackReason?: string;
  fallbackMessage?: string;
};

type GenerateOutreachParams = {
  annonce: Annonce;
  mode: OutreachMode;
  commercialProfile?: CommercialProfileSettings;
  userProfile?: OutreachUserProfile;
};

const normalizeSuggestions = (value: unknown): OutreachSuggestion[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const suggestion = item as Partial<OutreachSuggestion>;
      if (!suggestion.title || !suggestion.body) return null;
      return {
        title: String(suggestion.title),
        angle: suggestion.angle ? String(suggestion.angle) : undefined,
        body: String(suggestion.body),
      };
    })
    .filter((item): item is OutreachSuggestion => Boolean(item))
    .slice(0, 3);
};

const fallbackOutreach = (
  annonce: Annonce,
  commercialProfile?: CommercialProfileSettings,
  fallbackReason?: string,
  fallbackMessage?: string,
): OutreachResult => ({
  callScripts: generateCallScripts(annonce, commercialProfile),
  smsSuggestions: generateSmsSuggestions(annonce, commercialProfile),
  source: 'fallback',
  fallbackReason,
  fallbackMessage,
});

const getErrorDetails = (error: any) => {
  const context = error?.context;
  const status = context?.status || error?.status;
  const rawMessage = error?.message || '';
  const code = error?.code || error?.details?.code;
  let payload: any = null;

  try {
    if (typeof context?.body === 'string') payload = JSON.parse(context.body);
    else if (context?.body && typeof context.body === 'object') payload = context.body;
  } catch {
    payload = null;
  }

  const reason = payload?.code || code || (status ? `http_${status}` : 'network_error');

  if (reason === 'missing_openai_key') {
    return {
      reason,
      message: "OPENAI_API_KEY n'est pas configurée dans les secrets Supabase.",
    };
  }

  if (status === 404 || rawMessage.toLowerCase().includes('not found')) {
    return {
      reason: 'function_not_deployed',
      message: "La fonction Supabase generate-outreach n'est pas déployée sur le projet distant.",
    };
  }

  if (reason === 'openai_error') {
    return {
      reason,
      message: "OpenAI a refusé ou échoué pendant la génération.",
    };
  }

  if (reason === 'invalid_output') {
    return {
      reason,
      message: "La réponse IA n'avait pas le format attendu.",
    };
  }

  if (reason === 'unauthorized' || status === 401) {
    return {
      reason: 'unauthorized',
      message: "La session utilisateur n'a pas été acceptée par la fonction Supabase.",
    };
  }

  return {
    reason,
    message: "La fonction IA est indisponible. Vérifiez le déploiement Supabase et les secrets OpenAI.",
  };
};

export const generateOutreach = async ({
  annonce,
  mode,
  commercialProfile,
  userProfile,
}: GenerateOutreachParams): Promise<OutreachResult> => {
  const fallback = fallbackOutreach(annonce, commercialProfile);

  const { data, error } = await supabase.functions.invoke('generate-outreach', {
    body: {
      annonce_id: annonce.id,
      mode,
      annonce: {
        id: annonce.id,
        title: annonce.title,
        description: annonce.description,
        price: annonce.price,
        size: annonce.size,
        rooms: annonce.rooms,
        bedrooms: annonce.bedrooms,
        type_de_bien: annonce.type_de_bien,
        city: annonce.city,
        postal_code: annonce.postal_code,
        adresse: annonce.adresse,
        owner_type: annonce.owner_type,
        source: annonce.source,
        dpe: annonce.dpe,
        ges: annonce.ges,
        publication_date: annonce.publication_date,
      },
      commercial_profile: commercialProfile || {},
      user_profile: userProfile || {},
    },
  });

  if (error) {
    console.error('[generate-outreach] function failed', error);
    const details = getErrorDetails(error);
    return fallbackOutreach(annonce, commercialProfile, details.reason, details.message);
  }

  const callScripts = normalizeSuggestions((data as any)?.callScripts);
  const smsSuggestions = normalizeSuggestions((data as any)?.smsSuggestions);
  const validCallScripts = callScripts.length === 3;
  const validSmsSuggestions = smsSuggestions.length === 3;

  return {
    callScripts: validCallScripts ? callScripts : fallback.callScripts,
    smsSuggestions: validSmsSuggestions ? smsSuggestions : fallback.smsSuggestions,
    source: validCallScripts || validSmsSuggestions ? 'ai' : 'fallback',
    fallbackReason: validCallScripts || validSmsSuggestions ? undefined : 'invalid_output',
    fallbackMessage: validCallScripts || validSmsSuggestions
      ? undefined
      : "La réponse IA n'avait pas le format attendu.",
  };
};
