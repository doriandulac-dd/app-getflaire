import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: { name: 'GetFlaire Integration', version: '1.0.0' },
});

// CORS helpers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

function corsJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return corsJson({ error: 'Method not allowed' }, 405);
    }

    // --- Inputs ---
    const json = await req.json().catch(() => ({}));
    const return_url_input = (json?.return_url ?? '') as string;

    // --- Auth guard ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return corsJson({ error: 'Missing/invalid Authorization header' }, 401);
    }
    const token = authHeader.slice('Bearer '.length);

    // --- User ---
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
    if (getUserError || !user) {
      return corsJson({ error: 'Failed to authenticate user' }, 401);
    }

    // --- Customer mapping ---
    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (getCustomerError) {
      console.error('DB error (stripe_customers):', getCustomerError);
      return corsJson({ error: 'Failed to fetch customer mapping' }, 500);
    }
    if (!customer?.customer_id) {
      // Le portail nécessite un customer existant : proposer de passer par Checkout d’abord
      return corsJson({ error: 'Customer not found (create a subscription first)' }, 404);
    }

    // --- return_url ---
    // Priorité: body.return_url -> header Origin -> env fallback
    const originHeader = req.headers.get('origin') || req.headers.get('Origin') || '';
    const envSiteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || '';
    const fallbackOrigin = originHeader || envSiteUrl;

    let return_url = `${fallbackOrigin || ''}/settings?tab=billing`;
    if (typeof return_url_input === 'string' && return_url_input.trim().length > 0) {
      // Valider l’URL utilisateur (éviter une string invalide)
      try {
        const u = new URL(return_url_input);
        return_url = u.toString();
      } catch {
        // ignore et garder fallback
      }
    }

    // --- Créer la session de portail ---
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.customer_id,
      return_url,
    });

    return corsJson({ url: session.url }, 200);
  } catch (error: any) {
    console.error('Portal error:', error);
    return corsJson({ error: error?.message || 'Internal error' }, 500);
  }
});