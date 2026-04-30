export interface SubscriptionSummary {
  status: string | 'no_record';
  planLabel: string;
  periodStart: number;
  periodEnd: number;
  price: number; // en cents
  currency: string;
  cadence: 'month' | 'quarter' | 'year';
  selectedDepartments: string[] | null;
  items: Array<{ 
    lookup_key: string; 
    quantity: number; 
    price_id: string;
    unit_amount: number;
  }>;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

export interface Invoice {
  id: string;
  status: string;
  amount_paid: number; // cents
  currency: string;
  created: number;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
}

export interface BillingInfo {
  company: string;
  vat: string;
  address: string;
  email: string;
}

export type PriceIndex = Record<string, string>; // lookup_key -> price.id

export interface CheckoutLineItem {
  price: string;
  quantity?: number;
}

export interface CheckoutRequest {
  mode: "subscription";
  plan: 'independant' | 'agence';
  cadence: 'month' | 'quarter' | 'year';
  extraDepartments: number;
  extraRegions: number;
  extraUsers: number;
  selectedDepartments: string[];
  selectedRegions: string[];
  success_url: string;
  cancel_url: string;
  intent?: "new" | "update";
}

export interface SubscriptionItem {
  id: string;
  price_id: string;
  quantity: number;
  unit_amount: number;
  lookup_key: string;
}