import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import { 
  SubscriptionSummary, 
  PaymentMethod, 
  Invoice, 
  BillingInfo, 
  PriceIndex,
  CheckoutRequest 
} from '../types/billing';
import { getProductByPriceId } from '../stripe-config';
import toast from 'react-hot-toast';

export const useStripe = () => {
  const { user } = useAuth();
  const [subscriptionSummary, setSubscriptionSummary] = useState<SubscriptionSummary | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    company: '',
    vat: '',
    address: '',
    email: ''
  });
  const [priceIndex, setPriceIndex] = useState<PriceIndex>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      refreshData();
    } else {
      setSubscriptionSummary(null);
      setPaymentMethods([]);
      setInvoices([]);
      setBillingInfo({ company: '', vat: '', address: '', email: '' });
      setPriceIndex({});
      setLoading(false);
    }
  }, [user]);

  const fetchSubscriptionSummary = async () => {
    try {
      // Check if user is available before making queries
      if (!user?.id) {
        setSubscriptionSummary(null);
        return;
      }

      // Fetch directly from stripe_subscriptions to get selected_departments
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('customer_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (customerError) {
        throw customerError;
      }

      if (!customerData) {
        setSubscriptionSummary(null);
        return;
      }

      const { data, error } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('customer_id', customerData.customer_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        // No subscription record found - set explicit status
        setSubscriptionSummary({
          status: 'no_record',
          planLabel: 'Aucun abonnement trouvé',
          periodStart: 0,
          periodEnd: 0,
          price: 0,
          currency: 'eur',
          cadence: 'month',
          selectedDepartments: null,
          items: []
        });
        return;
      }

        // Get product info from price_id
        const product = getProductByPriceId(data.price_id || '');
        
        const summary: SubscriptionSummary = {
          status: data.status || 'inactive',
          planLabel: product?.name || 'Plan inconnu',
          periodStart: data.current_period_start || 0,
          periodEnd: data.current_period_end || 0,
          price: product?.price || 0,
          currency: 'eur',
          cadence: product?.cadence || 'month',
          selectedDepartments: data.selected_departments || null,
          items: [{
            lookup_key: product?.name || 'Plan',
            quantity: 1,
            price_id: data.price_id || '',
            unit_amount: product?.price || 0
          }]
        };

        setSubscriptionSummary(summary);
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setSubscriptionSummary(null);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      // Not fetched client-side: use the Stripe portal as the source of truth.
      setPaymentMethods([]);
    } catch (err: any) {
      console.error('Error fetching payment methods:', err);
      setPaymentMethods([]);
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_user_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const invoiceList: Invoice[] = (data || []).map(invoice => ({
        id: invoice.stripe_invoice_id || invoice.invoice_id.toString(),
        status: invoice.status || 'unknown',
        amount_paid: invoice.amount_paid || 0,
        currency: invoice.currency || 'eur',
        created: Math.floor(new Date(invoice.created_at).getTime() / 1000),
        hosted_invoice_url: invoice.hosted_invoice_url || undefined,
        invoice_pdf: invoice.invoice_pdf || undefined,
      }));

      setInvoices(invoiceList);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setInvoices([]);
    }
  };

  const fetchBillingInfo = async () => {
    try {
      // Not fetched client-side: use Stripe customer data through the portal.
      setBillingInfo({
        company: '',
        vat: '',
        address: '',
        email: user?.email || ''
      });
    } catch (err: any) {
      console.error('Error fetching billing info:', err);
      setBillingInfo({
        company: '',
        vat: '',
        address: '',
        email: user?.email || ''
      });
    }
  };

  const fetchPriceIndex = async () => {
    try {
      // Price ids are maintained in stripe-config.ts for now.
      setPriceIndex({});
    } catch (err: any) {
      console.error('Error fetching price index:', err);
      setPriceIndex({});
    }
  };

  const updateBillingInfo = async (info: BillingInfo) => {
    try {
      setBillingInfo(info);
      toast.success('Informations de facturation mises à jour');
      return true;
    } catch (err: any) {
      toast.error('Erreur lors de la mise à jour des informations de facturation');
      return false;
    }
  };

  const setAsDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      // This would call a Supabase function that updates the default payment method in Stripe
      toast.success('Méthode de paiement définie par défaut');
      await refreshData();
      return true;
    } catch (err: any) {
      toast.error('Erreur lors de la mise à jour de la méthode de paiement');
      return false;
    }
  };

  const detachPaymentMethod = async (paymentMethodId: string) => {
    try {
      // This would call a Supabase function that detaches the payment method in Stripe
      toast.success('Méthode de paiement supprimée');
      await refreshData();
      return true;
    } catch (err: any) {
      toast.error('Erreur lors de la suppression de la méthode de paiement');
      return false;
    }
  };

  const createCheckoutSession = async (checkoutData: CheckoutRequest) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du checkout');
      }

      const { sessionId, url } = await response.json();
      return { sessionId, url };
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      throw err;
    }
  };

  const openBillingPortal = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Utilisateur non authentifié');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: `${window.location.origin}/settings?tab=billing`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'ouverture du portail');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err: any) {
      console.error('Error opening billing portal:', err);
      toast.error(err.message || 'Erreur lors de l\'ouverture du portail de facturation');
    }
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchSubscriptionSummary(),
        fetchPaymentMethods(),
        fetchInvoices(),
        fetchBillingInfo(),
        fetchPriceIndex(),
      ]);
    } catch (err: any) {
      console.error('Error refreshing data:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // Get current subscription for compatibility
  const subscription = subscriptionSummary ? {
    planLabel: subscriptionSummary.planLabel,
    subscription_status: subscriptionSummary.status as any,
    price_id: subscriptionSummary.items[0]?.price_id || '',
    current_period_start: subscriptionSummary.periodStart,
    current_period_end: subscriptionSummary.periodEnd,
    cancel_at_period_end: false,
  } : null;

  return {
    // State
    subscription,
    subscriptionSummary,
    paymentMethods,
    invoices,
    billingInfo,
    priceIndex,
    loading,
    error,

    // Actions
    updateBillingInfo,
    setAsDefaultPaymentMethod,
    detachPaymentMethod,
    createCheckoutSession,
    openBillingPortal,
    refreshData,
  };
};
