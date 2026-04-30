import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: { name: 'Bolt Integration', version: '1.0.0' },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// --- CORS helper ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
} as const;

function corsJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    // Preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return corsJson({ error: 'Method not allowed' }, 405);
    }

    // Stripe signature
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return corsJson({ error: 'No signature found' }, 400);
    }

    // raw body (NE PAS JSON.parse)
    const body = await req.text();

    // Vérification de signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error('Webhook signature verification failed:', error?.message || error);
      return corsJson({ error: `signature verification failed: ${error?.message || 'invalid'}` }, 400);
    }

    // Traiter l'événement
    await handleEvent(event);

    return corsJson({ received: true }, 200);
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return corsJson({ error: error?.message || 'Internal error' }, 500);
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData: any = event?.data?.object ?? null;
  if (!stripeData) return;

  // Handle invoice events
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    await handleInvoiceEvent(event);
    return;
  }

  // Beaucoup d'événements Stripe n'ont pas 'customer' (ex: product.created)
  if (!('customer' in stripeData)) return;

  // Ignorer payment_intent.succeeded sans invoice (one-time en dehors de Checkout)
  if (event.type === 'payment_intent.succeeded' && stripeData.invoice === null) return;

  const customerId = stripeData.customer as string | undefined;
  if (!customerId || typeof customerId !== 'string') {
    console.error('No valid customer on event:', event.type);
    return;
  }

  // Déterminer si c'est un checkout one-time ou une souscription
  let isSubscription = true;
  if (event.type === 'checkout.session.completed') {
    const s = stripeData as Stripe.Checkout.Session;
    isSubscription = s.mode === 'subscription';
    console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
  }

  const s = stripeData as Partial<Stripe.Checkout.Session>;
  if (isSubscription) {
    console.info(`Starting subscription sync for customer: ${customerId}`);
    await syncCustomerFromStripe(customerId, event);
  } else if (s.mode === 'payment' && s.payment_status === 'paid') {
    // Enregistrer la commande one-shot
    try {
      const {
        id: checkout_session_id,
        payment_intent,
        amount_subtotal,
        amount_total,
        currency,
        payment_status,
      } = stripeData as Stripe.Checkout.Session;

      const { error: orderError } = await supabase.from('stripe_orders').insert({
        checkout_session_id,
        payment_intent_id: payment_intent,
        customer_id: customerId,
        amount_subtotal,
        amount_total,
        currency,
        payment_status,
        status: 'completed',
      });

      if (orderError) {
        console.error('Error inserting order:', orderError);
        return;
      }
      console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
    } catch (err) {
      console.error('Error processing one-time payment:', err);
    }
  }
}

// ---- Handle invoice events ----
async function handleInvoiceEvent(event: Stripe.Event) {
  try {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (!invoice.customer || typeof invoice.customer !== 'string') {
      console.error('No valid customer on invoice event:', event.type);
      return;
    }

    const customerId = invoice.customer;
    
    // Prepare invoice data for database
    const invoiceData = {
      customer_id: customerId,
      invoice_id: invoice.id,
      hosted_invoice_url: invoice.hosted_invoice_url || null,
      invoice_pdf: invoice.invoice_pdf || null,
      amount_due: invoice.amount_due || 0,
      amount_paid: invoice.amount_paid || 0,
      amount_remaining: invoice.amount_remaining || 0,
      currency: invoice.currency || 'eur',
      status: invoice.status || 'unknown',
      created_at: new Date(invoice.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert invoice record
    const { error: invoiceError } = await supabase
      .from('stripe_invoices')
      .upsert(invoiceData, { 
        onConflict: 'invoice_id',
        ignoreDuplicates: false 
      });

    if (invoiceError) {
      console.error('Error upserting invoice:', invoiceError);
      throw new Error('Failed to save invoice in database');
    }

    console.info(`Successfully processed invoice ${invoice.id} for customer ${customerId}`);
  } catch (error: any) {
    console.error('Error handling invoice event:', error);
    throw error;
  }
}

// ---- Sync abonnement client ↔ DB ----
async function syncCustomerFromStripe(customerId: string, event?: Stripe.Event) {
  try {
    // Récupérer la dernière souscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No subscriptions found for customer: ${customerId}`);
      // Uniformiser sur "status"
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        { customer_id: customerId, status: 'not_started' },
        { onConflict: 'customer_id' }
      );
      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
      return; // rien à sync de plus
    }

    // On suppose une seule souscription
    const subscription = subscriptions.data[0];

    // Extraire les départements choisis depuis la session Checkout (si dispo)
    let selectedDepartments: string[] | null = null;
    if (event && event.type === 'checkout.session.completed') {
      const sessionData = event.data.object as Stripe.Checkout.Session;
      if (sessionData.metadata?.selectedDepartments) {
        selectedDepartments = sessionData.metadata.selectedDepartments.split(',').filter(Boolean);
      }
    }

    // Préparer données de pm (si expand a bien fonctionné)
    let payment_method_brand: string | null = null;
    let payment_method_last4: string | null = null;
    if (subscription.default_payment_method && typeof subscription.default_payment_method !== 'string') {
      payment_method_brand = subscription.default_payment_method.card?.brand ?? null;
      payment_method_last4 = subscription.default_payment_method.card?.last4 ?? null;
    }

    // Upsert statut de souscription
    const item = subscription.items.data[0]; // existe si data.length > 0
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: item?.price?.id ?? null,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(selectedDepartments && { selected_departments: selectedDepartments }),
        payment_method_brand,
        payment_method_last4,
        status: subscription.status, // <= unifié
      },
      { onConflict: 'customer_id' }
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    console.info(`Successfully synced subscription for customer: ${customerId}`);

    // --- Sync selected departments to user profile ---
    if (selectedDepartments && selectedDepartments.length > 0) {
      try {
        // Get user_id from customer mapping
        const { data: customerMapping, error: customerMappingError } = await supabase
          .from('stripe_customers')
          .select('user_id')
          .eq('customer_id', customerId)
          .is('deleted_at', null)
          .maybeSingle();

        if (customerMappingError) {
          console.error('Error fetching customer mapping for departments sync:', customerMappingError);
        } else if (customerMapping?.user_id) {
          // Update user's authorized departments
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({ departements_autorises: selectedDepartments })
            .eq('id', customerMapping.user_id);

          if (userUpdateError) {
            console.error('Error updating user departments:', userUpdateError);
          } else {
            console.info(`Successfully updated departments for user ${customerMapping.user_id}:`, selectedDepartments);
          }
        }
      } catch (error) {
        console.error('Error during departments sync to user profile:', error);
      }
    }
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}