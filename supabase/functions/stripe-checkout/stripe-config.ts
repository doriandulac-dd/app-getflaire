// Stripe Products Configuration
export interface Product {
  id: string;
  name: string;
  description: string;
  priceId: string;
  price: number; // in cents
  mode: 'subscription';
  type: 'plan' | 'addon';
  cadence: 'month' | 'quarter' | 'year';
  profile: 'individual' | 'agency';
}

export const PRODUCTS_DATA: Product[] = [
  // Base Plans - Individual
  {
    id: 'prod_SxQGPt4mzEseVQ',
    name: 'GetFlaire Indépendant',
    description: 'Plan mensuel pour agents immobiliers indépendants',
    priceId: 'price_1S1VPYF9VFgz1vkB4q639e26',
    price: 2900, // 29.00 €
    mode: 'subscription',
    type: 'plan',
    cadence: 'month',
    profile: 'individual'
  },
  {
    id: 'prod_SxQGXq2eoShUgn',
    name: 'GetFlaire Indépendant',
    description: 'Plan trimestriel pour agents immobiliers indépendants',
    priceId: 'price_1S1VQPF9VFgz1vkBv8XswMw3',
    price: 7800, // 78.00 €
    mode: 'subscription',
    type: 'plan',
    cadence: 'quarter',
    profile: 'individual'
  },
  {
    id: 'prod_SxQHaRsOksy64B',
    name: 'GetFlaire Indépendant',
    description: 'Plan annuel pour agents immobiliers indépendants',
    priceId: 'price_1S1VR7F9VFgz1vkBVfAyL482',
    price: 27600, // 276.00 €
    mode: 'subscription',
    type: 'plan',
    cadence: 'year',
    profile: 'individual'
  },

  // Base Plans - Agency
  {
    id: 'prod_SxSubyPo6Umyri',
    name: 'GetFlaire Agence',
    description: 'Plan mensuel pour agences immobilières',
    priceId: 'price_1S1XyUF9VFgz1vkBDDNkGiOZ',
    price: 7900, // 79.00 €
    mode: 'subscription',
    type: 'plan',
    cadence: 'month',
    profile: 'agency'
  },
  {
    id: 'prod_SxSuZrdbg6gEAY',
    name: 'GetFlaire Agence',
    description: 'Plan trimestriel pour agences immobilières',
    priceId: 'price_1S1XysF9VFgz1vkBGcHWYiJm',
    price: 21300, // 213.00 €
    mode: 'subscription',
    type: 'plan',
    cadence: 'quarter',
    profile: 'agency'
  },
  {
    id: 'prod_SxSwoa7C1B990K',
    name: 'GetFlaire Agence',
    description: 'Plan annuel pour agences immobilières',
    priceId: 'price_1S1Y0GF9VFgz1vkBTsbGh8Rs',
    price: 75600, // 756.00 €
    mode: 'subscription',
    type: 'plan',
    cadence: 'year',
    profile: 'agency'
  },

  // Add-ons - Individual Departments
  {
    id: 'prod_SxQILMTzPb7vsz',
    name: 'Département supplémentaire Indépendant',
    description: 'Département supplémentaire mensuel pour indépendants',
    priceId: 'price_1S1VReF9VFgz1vkBDB0oMMHU',
    price: 1500, // 15.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'month',
    profile: 'individual'
  },
  {
    id: 'prod_SxQKb5HbtN91mb',
    name: 'Département supplémentaire Indépendant',
    description: 'Département supplémentaire trimestriel pour indépendants',
    priceId: 'price_1S1VU0F9VFgz1vkBAXsTuHLK',
    price: 4300, // 43.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'quarter',
    profile: 'individual'
  },
  {
    id: 'prod_SxQLj2y7VQyXC8',
    name: 'Département supplémentaire Indépendant',
    description: 'Département supplémentaire annuel pour indépendants',
    priceId: 'price_1S1VUTF9VFgz1vkBsxYKEOj6',
    price: 15300, // 153.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'year',
    profile: 'individual'
  },

  // Add-ons - Agency Departments
  {
    id: 'prod_SxSwxNHjFJQyH9',
    name: 'Département supplémentaire Agence',
    description: 'Département supplémentaire mensuel pour agences',
    priceId: 'price_1S1Y0uF9VFgz1vkBx6ZIrylx',
    price: 2000, // 20.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'month',
    profile: 'agency'
  },
  {
    id: 'prod_SxSx2eqssOm43h',
    name: 'Département supplémentaire Agence',
    description: 'Département supplémentaire trimestriel pour agences',
    priceId: 'price_1S1Y1PF9VFgz1vkB9CehM0qD',
    price: 5700, // 57.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'quarter',
    profile: 'agency'
  },
  {
    id: 'prod_SxT4gdaXm19jSS',
    name: 'Département supplémentaire Agence',
    description: 'Département supplémentaire annuel pour agences',
    priceId: 'price_1S1Y80F9VFgz1vkBGbFChYwM',
    price: 20400, // 204.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'year',
    profile: 'agency'
  },

  // Add-ons - Agency Users
  {
    id: 'prod_SxT5btprxMAdAU',
    name: 'Compte supplémentaire Agence',
    description: 'Utilisateur supplémentaire mensuel pour agences',
    priceId: 'price_1S1Y99F9VFgz1vkBGsStlT7Y',
    price: 1500, // 15.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'month',
    profile: 'agency'
  },
  {
    id: 'prod_SxT6wB4gZa1u7v',
    name: 'Compte supplémentaire Agence',
    description: 'Utilisateur supplémentaire trimestriel pour agences',
    priceId: 'price_1S1Y9oF9VFgz1vkBH2OUzHRg',
    price: 4300, // 43.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'quarter',
    profile: 'agency'
  },
  {
    id: 'prod_SxT6R4jxTLqWuD',
    name: 'Compte supplémentaire Agence',
    description: 'Utilisateur supplémentaire annuel pour agences',
    priceId: 'price_1S1YATF9VFgz1vkBVVtgS9ss',
    price: 15300, // 153.00 €
    mode: 'subscription',
    type: 'addon',
    cadence: 'year',
    profile: 'agency'
  }
];

export const PRODUCTS_MAP = PRODUCTS_DATA.reduce((acc, product) => {
  acc[product.priceId] = product;
  return acc;
}, {} as Record<string, Product>);

export const PRICE_IDS = {
  PLANS: {
    INDIVIDUAL: {
      MONTH: 'price_1S1VPYF9VFgz1vkB4q639e26',
      QUARTER: 'price_1S1VQPF9VFgz1vkBv8XswMw3',
      YEAR: 'price_1S1VR7F9VFgz1vkBVfAyL482'
    },
    AGENCY: {
      MONTH: 'price_1S1XyUF9VFgz1vkBDDNkGiOZ',
      QUARTER: 'price_1S1XysF9VFgz1vkBGcHWYiJm',
      YEAR: 'price_1S1Y0GF9VFgz1vkBTsbGh8Rs'
    }
  },
  ADDONS: {
    DEPT_INDIVIDUAL: {
      MONTH: 'price_1S1VReF9VFgz1vkBDB0oMMHU',
      QUARTER: 'price_1S1VU0F9VFgz1vkBAXsTuHLK',
      YEAR: 'price_1S1VUTF9VFgz1vkBsxYKEOj6'
    },
    DEPT_AGENCY: {
      MONTH: 'price_1S1Y0uF9VFgz1vkBx6ZIrylx',
      QUARTER: 'price_1S1Y1PF9VFgz1vkB9CehM0qD',
      YEAR: 'price_1S1Y80F9VFgz1vkBGbFChYwM'
    },
    USER_AGENCY: {
      MONTH: 'price_1S1Y99F9VFgz1vkBGsStlT7Y',
      QUARTER: 'price_1S1Y9oF9VFgz1vkBH2OUzHRg',
      YEAR: 'price_1S1YATF9VFgz1vkBVVtgS9ss'
    }
  }
};

export const getPlanPriceId = (profile: 'individual' | 'agency', cadence: 'month' | 'quarter' | 'year'): string => {
  if (profile === 'individual') {
    return PRICE_IDS.PLANS.INDIVIDUAL[cadence.toUpperCase() as keyof typeof PRICE_IDS.PLANS.INDIVIDUAL];
  }
  return PRICE_IDS.PLANS.AGENCY[cadence.toUpperCase() as keyof typeof PRICE_IDS.PLANS.AGENCY];
};

export const getDeptAddonPriceId = (profile: 'individual' | 'agency', cadence: 'month' | 'quarter' | 'year'): string => {
  if (profile === 'individual') {
    return PRICE_IDS.ADDONS.DEPT_INDIVIDUAL[cadence.toUpperCase() as keyof typeof PRICE_IDS.ADDONS.DEPT_INDIVIDUAL];
  }
  return PRICE_IDS.ADDONS.DEPT_AGENCY[cadence.toUpperCase() as keyof typeof PRICE_IDS.ADDONS.DEPT_AGENCY];
};

export const getUserAddonPriceId = (cadence: 'month' | 'quarter' | 'year'): string => {
  return PRICE_IDS.ADDONS.USER_AGENCY[cadence.toUpperCase() as keyof typeof PRICE_IDS.ADDONS.USER_AGENCY];
};