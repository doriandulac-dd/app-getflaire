import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import Stripe from 'npm:stripe@17.7.0';

import { PRODUCTS_MAP, PRICE_IDS } from './stripe-config.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
} as const;

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: { name: 'Bolt Integration', version: '1.0.0' },
});
function corsJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface CreateUserRequest {
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
  role: 'admin' | 'agent';
  agency_id: string;
  departements_autorises?: string[];
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return corsJson({ error: 'Method not allowed' }, 405);
    }

    // --- Auth guard ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return corsJson({ error: 'Missing/invalid Authorization header' }, 401);
    }
    const token = authHeader.slice('Bearer '.length);

    // Verify the requesting user is authenticated and is an admin
    const { data: { user }, error: getUserError } = await supabase.auth.getUser(token);
    if (getUserError || !user) {
      return corsJson({ error: 'Failed to authenticate user' }, 401);
    }

    // Check if the requesting user is an admin
    const { data: requestingUser, error: requestingUserError } = await supabase
      .from('users')
      .select('Role, agency_id')
      .eq('id', user.id)
      .single();

    if (requestingUserError) {
      return corsJson({ error: 'Failed to fetch user permissions' }, 403);
    }

    const requestingUserRole = (requestingUser.Role || '').toLowerCase();
    if (requestingUserRole !== 'admin' && requestingUserRole !== 'agence') {
      return corsJson({ error: 'Insufficient permissions. Only admins can create users.' }, 403);
    }

    // Parse request body
    const body: CreateUserRequest = await req.json().catch(() => ({}));
    const {
      email,
      nom,
      prenom,
      telephone,
      role,
      agency_id,
      departements_autorises
    } = body;

    // Validate required fields
    if (!email || !nom || !prenom || !role || !agency_id) {
      return corsJson({ error: 'Missing required fields: email, nom, prenom, role, agency_id' }, 400);
    }

    // Validate role
    if (!['admin', 'agent'].includes(role)) {
      return corsJson({ error: 'Invalid role. Must be admin or agent.' }, 400);
    }

    // Verify the requesting user has permission to create users in this agency
    if (requestingUser.agency_id !== agency_id) {
      return corsJson({ error: 'You can only create users in your own agency' }, 403);
    }

    // --- Subscription Limit Check ---
    // 1. Get the requesting admin's agency_id
    const requestingAgencyId = requestingUser.agency_id;
    if (!requestingAgencyId) {
      return corsJson({ error: 'Requesting user is not associated with an agency.' }, 403);
    }

    // 2. Find the Stripe customer ID associated with the agency's subscription.
    // This assumes the agency's subscription is linked to the requesting admin user's customer_id.
    const { data: adminCustomerData, error: fetchAdminCustomerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id) // Use the requesting user's ID
      .maybeSingle();

    if (fetchAdminCustomerError || !adminCustomerData) {
      console.warn(`No Stripe customer found for requesting admin user ${user.id}. Cannot check subscription limits.`);
      return corsJson({ error: 'Could not determine agency\'s subscription. Please ensure your admin account has an active Stripe subscription linked.' }, 403);
    }

    const agencyCustomerId = adminCustomerData.customer_id;

    // 3. Fetch the agency's active subscription from our DB
    const { data: agencySubscription, error: fetchSubscriptionError } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('customer_id', agencyCustomerId)
      .in('status', ['active', 'trialing']) // Only consider active or trialing subscriptions
      .maybeSingle();

    if (fetchSubscriptionError || !agencySubscription) {
      console.warn(`No active or trialing subscription found for customer ${agencyCustomerId}.`);
      return corsJson({ error: 'No active subscription found for this agency. Cannot add users.' }, 403);
    }

    // 4. Retrieve full subscription details from Stripe API to get line items
    const stripeSubscription = await stripe.subscriptions.retrieve(agencySubscription.subscription_id, {
      expand: ['items.data.price.product'], // Expand to get product details
    });

    let maxUsersAllowed = 0;
    let basePlanFound = false;

    for (const item of stripeSubscription.items.data) {
      const product = item.price?.product;
      if (typeof product === 'object' && product !== null) {
        const boltProduct = PRODUCTS_MAP[item.price.id]; // Map Stripe Price ID to our internal product config

        if (boltProduct?.type === 'plan' && boltProduct.profile === 'agency') {
          // Base agency plan includes 3 users
          maxUsersAllowed += 3; // Assuming base agency plan always includes 3 users
          basePlanFound = true;
        } else if (boltProduct?.type === 'addon' && boltProduct.name.includes('Compte supplémentaire Agence')) {
          // Each user add-on adds 1 user per quantity
          maxUsersAllowed += item.quantity;
        }
      }
    }

    if (!basePlanFound) {
        return corsJson({ error: 'Could not determine base user limit from agency subscription.' }, 500);
    }

    // 5. Count current users in the agency
    const { count: currentUsers, error: countUsersError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', requestingAgencyId);

    if (countUsersError) {
      console.error('Error counting existing users:', countUsersError);
      return corsJson({ error: 'Failed to count existing users.' }, 500);
    }

    // 6. Validate against the limit
    if (currentUsers !== null && currentUsers >= maxUsersAllowed) {
      return corsJson({ error: `User limit reached for this agency (${currentUsers}/${maxUsersAllowed}). Upgrade your subscription to add more users.` }, 403);
    }

    // Generate a temporary password
    const temporaryPassword = email;

    // Create user in Supabase Auth
    const { data: authUser, error: createAuthError } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        nom,
        prenom,
        telephone,
        role,
        agency_id
      }
    });

    if (createAuthError) {
      console.error('Error creating auth user:', createAuthError);
      return corsJson({ error: createAuthError.message }, 400);
    }

    if (!authUser.user) {
      return corsJson({ error: 'Failed to create user: no user returned' }, 400);
    }

    // Create user profile in public.users table
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        nom,
        Prenom: prenom,
        telephone: telephone || null,
        Role: role,
        agency_id,
        departements_autorises: departements_autorises || null,
        valide: true,
        created_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      
      // Cleanup: delete the auth user if profile creation failed
      try {
        await supabase.auth.admin.deleteUser(authUser.user.id);
      } catch (cleanupError) {
        console.error('Error cleaning up auth user:', cleanupError);
      }
      
      return corsJson({ error: `Failed to create user profile: ${profileError.message}` }, 400);
    }

    // Generate password reset link for the new user
    const { data: resetLink, error: resetLinkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${req.headers.get('origin') || ''}/auth?type=recovery`
      }
    });

    if (resetLinkError) {
      console.error('Error generating reset link:', resetLinkError);
      // Don't fail the entire operation, just log the error
    }

    // The reset link is returned to the authenticated admin for the current UI flow.
    // Never log the temporary password or recovery URL.
    console.info(`User created successfully: ${authUser.user.id}`);

    return corsJson({
      success: true,
      user: {
        id: authUser.user.id,
        email,
        nom,
        prenom,
        role
      },
      resetLink: resetLink?.properties?.action_link || null,
      message: 'User created successfully. Share the reset link with the new user to set their password.'
    }, 201);

  } catch (error: any) {
    console.error('Error in create-user-admin function:', error);
    return corsJson({ error: error?.message || 'Internal server error' }, 500);
  }
});
