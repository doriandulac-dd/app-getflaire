import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { PRODUCTS_DATA, getPlanPriceId, getDeptAddonPriceId, getUserAddonPriceId } from './stripe-config.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: { name: 'Bolt Integration', version: '1.0.0' },
});

// Helper CORS
function corsResponse(body: string | object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return corsResponse({}, 204);
    if (req.method !== 'POST') return corsResponse({ error: 'Method not allowed' }, 405);

    // ------- Inputs (SANS régions) -------
    const body = await req.json().catch(() => ({}));
    const {
      plan,                  // 'independant' | 'agence'
      cadence,               // 'month' | 'quarter' | 'year'
      extraDepartments = 0,  // number >= 0
      extraUsers = 0,        // number >= 0 (utilisé seulement pour 'agence')
      selectedDepartments = [], // string[]
      success_url,           // string
      cancel_url,            // string
    } = body;

    // ------- Validation -------
    const validationError = validateParameters(
      { plan, cadence, success_url, cancel_url },
      {
        plan: { values: ['independant', 'agence'] },
        cadence: { values: ['month', 'quarter', 'year'] },
        success_url: 'string',
        cancel_url: 'string',
      },
    );
    if (validationError) return corsResponse({ error: validationError }, 400);

    if (typeof extraDepartments !== 'number' || extraDepartments < 0)
      return corsResponse({ error: 'extraDepartments must be a non-negative number' }, 400);
    if (typeof extraUsers !== 'number' || extraUsers < 0)
      return corsResponse({ error: 'extraUsers must be a non-negative number' }, 400);
    if (!Array.isArray(selectedDepartments))
      return corsResponse({ error: 'selectedDepartments must be an array' }, 400);

    // ------- Auth (garde propre) -------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return corsResponse({ error: 'Missing/invalid Authorization header' }, 401);
    }
    const token = authHeader.slice('Bearer '.length);

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser(token);
    if (getUserError) return corsResponse({ error: 'Failed to authenticate user' }, 401);
    if (!user) return corsResponse({ error: 'User not found' }, 404);

    // ------- Récup/Création customer -------
    const { data: customer, error: getCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (getCustomerError) {
      console.error('Failed to fetch customer information from the database', getCustomerError);
      return corsResponse({ error: 'Failed to fetch customer information' }, 500);
    }

    let customerId: string;

    if (!customer?.customer_id) {
      const newCustomer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });

      const { error: createCustomerError } = await supabase
        .from('stripe_customers')
        .insert({ user_id: user.id, customer_id: newCustomer.id });

      if (createCustomerError) {
        console.error('Failed to save customer information in the database', createCustomerError);
        try {
          await stripe.customers.del(newCustomer.id);
          await supabase.from('stripe_subscriptions').delete().eq('customer_id', newCustomer.id);
        } catch (e) {
          console.error('Cleanup after mapping error:', e);
        }
        return corsResponse({ error: 'Failed to create customer mapping' }, 500);
      }

      const { error: createSubscriptionError } = await supabase
        .from('stripe_subscriptions')
        .insert({ customer_id: newCustomer.id, status: 'not_started' });
      if (createSubscriptionError) {
        console.error('Failed to save subscription in the database', createSubscriptionError);
        try { await stripe.customers.del(newCustomer.id); } catch {}
        return corsResponse({ error: 'Unable to save the subscription in the database' }, 500);
      }

      customerId = newCustomer.id;
    } else {
      customerId = customer.customer_id;

      const { data: subscription, error: getSubscriptionError } = await supabase
        .from('stripe_subscriptions')
        .select('status')
        .eq('customer_id', customerId)
        .maybeSingle();
      if (getSubscriptionError) {
        console.error('Failed to fetch subscription information from the database', getSubscriptionError);
        return corsResponse({ error: 'Failed to fetch subscription information' }, 500);
      }
      if (!subscription) {
        const { error: createSubscriptionError } = await supabase
          .from('stripe_subscriptions')
          .insert({ customer_id: customerId, status: 'not_started' });
        if (createSubscriptionError) {
          console.error('Failed to create subscription record for existing customer', createSubscriptionError);
          return corsResponse({ error: 'Failed to create subscription record for existing customer' }, 500);
        }
      }
    }

    // ------- Line items (même cadence) -------
    const profile: 'individual' | 'agency' = plan === 'independant' ? 'individual' : 'agency';
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    const basePriceId = getPlanPriceId(profile, cadence);
    if (!basePriceId) return corsResponse({ error: 'Base plan priceId introuvable (plan/cadence non mappé)' }, 400);
    lineItems.push({ price: basePriceId, quantity: 1 });

    if (extraDepartments > 0) {
      const deptPriceId = getDeptAddonPriceId(profile, cadence);
      if (!deptPriceId) return corsResponse({ error: 'Dept addon priceId introuvable' }, 400);
      lineItems.push({ price: deptPriceId, quantity: extraDepartments });
    }

    if (profile === 'agency' && extraUsers > 0) {
      const userPriceId = getUserAddonPriceId(cadence);
      if (!userPriceId) return corsResponse({ error: 'User addon priceId introuvable' }, 400);
      lineItems.push({ price: userPriceId, quantity: extraUsers });
    }

    // Sanity locale (cadence produits)
    for (const li of lineItems) {
      const prod = PRODUCTS_DATA.find(p => p.priceId === li.price);
      if (!prod) return corsResponse({ error: `PriceId inconnu: ${li.price}` }, 400);
      if (prod.cadence !== cadence) {
        return corsResponse({ error: `Incohérence d'intervalle local: ${prod.name} est ${prod.cadence}, attendu ${cadence}` }, 400);
      }
    }

    // Vérification Stripe (source de vérité)
    const fetchedPrices = await Promise.all(lineItems.map(li => stripe.prices.retrieve(li.price as string)));
    const expected = cadence === 'year'
      ? { interval: 'year', count: 1 }
      : cadence === 'quarter'
        ? { interval: 'month', count: 3 }
        : { interval: 'month', count: 1 };

    const wrong = fetchedPrices.filter(
      p => !(p.recurring?.interval === expected.interval && p.recurring?.interval_count === expected.count)
    );
    if (wrong.length) {
      return corsResponse({
        error: `Wrong interval on: ${wrong.map(p => `${p.id}(${p.recurring?.interval}:${p.recurring?.interval_count})`).join(', ')} — expected ${expected.interval}:${expected.count}.`
      }, 400);
    }

    // Metadata (sans régions)
    const metadata = {
      plan,
      cadence,
      extraDepartments: String(extraDepartments),
      extraUsers: String(extraUsers),
      selectedDepartments: selectedDepartments.join(','),
    };

    // Création session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      metadata,
      subscription_data: {
        trial_period_days: 14,
        metadata: { selectedDepartments: selectedDepartments.join(',') },
      },
      success_url,
      cancel_url,
    });

    console.log(`Created checkout session ${session.id} for customer ${customerId}`);
    return corsResponse({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return corsResponse({ error: error.message }, 500);
  }
});

type ExpectedType = 'string' | { values: string[] };
type Expectations<T> = { [K in keyof T]: ExpectedType };
function validateParameters<T extends Record<string, any>>(values: T, expected: Expectations<T>): string | undefined {
  // Valide uniquement les clés attendues
  for (const parameter in expected) {
    const expectation = expected[parameter];
    const value = values[parameter];

    if (expectation === 'string') {
      if (value == null) return `Missing required parameter ${parameter}`;
      if (typeof value !== 'string') return `Expected parameter ${parameter} to be a string got ${JSON.stringify(value)}`;
    } else {
      if (!expectation.values.includes(value)) {
        return `Expected parameter ${parameter} to be one of ${expectation.values.join(', ')}`;
      }
    }
  }
  return undefined;
}