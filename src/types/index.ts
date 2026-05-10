// ---------- Personnalisation ----------
export type ThemeName = 'blue' | 'green' | 'purple' | 'orange';
export type ColorMode = 'light' | 'dark' | 'system';
export type UserRole = 'admin' | 'agent' | 'independant';

export interface PersonalizationSettings {
  mode?: ColorMode;  // clair/sombre/système
  primaryColor?: ThemeName; // couleur principale
  theme?: ThemeName | ColorMode; // legacy: anciennes données stockées
  items_per_page?: number; // nombre d'annonces par page
}

// ---------- Utilisateurs / Agences ----------
export interface User {
  id: string;
  nom: string;
  email: string;
  telephone?: string;
  agency_id?: string;
  departements_autorises?: string[];
  valide?: boolean;
  created_at?: string;
  Prenom?: string;
  Role?: UserRole;
  agency?: Agency;
  personalization_settings?: PersonalizationSettings;
}

export interface Agency {
  id: string;
  name: string;
  siren?: string;
  address?: string;
  phone?: string;
  email?: string;
  subscription_plan?: string;
  max_users?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// ---------- Domain: Annonces ----------
export interface Annonce {
  id: string;
  title: string;
  description: string;
  price: number;
  size: number;
  rooms: number;
  bedrooms: number;
  type_de_bien: string;
  city: string;
  postal_code: string;
  adresse: string;
  lat?: number;
  lng?: number;
  image_urls: string[] | string | null;
  image_url?: string[] | string | null;
  phone: string;
  urgence: boolean;
  urgence_detectee: boolean;
  type_urgence?: string;
  source: string;
  url: string;
  owner_type: string;
  departement: string;
  dpe?: string;
  ges?: string;
  publication_date: string;
  statut?: string;
  supprimee: boolean;
  en_ligne?: boolean;
  maj_prix: boolean;
  booster: boolean;
  created_at: string;
  nb_modifications?: number;
  activity_status?: string;
  activity_user_id?: string;
  activity_actor?: string;
  activity_note?: string;
  activity_date?: string;
  favorite_user_ids?: string[];
  favorite_actors?: string[];
}

export interface AnnonceStatus {
  id: string;
  annonce_id: string;
  user_id: string;
  status: 'favorite' | 'to_process' | 'to_call' | 'called' | 'hidden';
  notes?: string;
  created_at: string;
}

// ---------- Domain: Clients ----------
export interface Client {
  id: string;
  agency_id?: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  status: 'active_search' | 'signature' | 'follow_up' | 'inactive';
  budget_min?: number;
  budget_max?: number;
  property_types: string[];
  locations: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ---------- Domain: Divers ----------
export interface PropertyComment {
  id: string;
  property_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  user: UserProfile;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_date: string;
  is_completed: boolean;
  reminder_type: 'call' | 'email' | 'meeting' | 'task' | 'other';
  related_id?: string;
  related_type?: 'property' | 'client' | 'alert';
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  max_users: number;
  is_active: boolean;
}

export interface PropertyFilters {
  search?: string;
  property_types?: string[];
  transaction_types?: string[];
  price_min?: number;
  price_max?: number;
  surface_min?: number;
  surface_max?: number;
  rooms_min?: number;
  cities?: string[];
  urgency_levels?: string[];
  status?: string[];
  urgent_only?: boolean;
  has_phone?: boolean;
  online_status?: boolean;
  non_processed?: boolean;
  owner_type?: string;
  include_all_statuses?: boolean;
  url_search?: string;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface DashboardStats {
  total_properties: number;
  total_properties_variation: number;
  properties_processed: number;
  properties_processed_variation: number;
  calls_made: number;
  calls_made_variation: number;
  upcoming_reminders: number;
  upcoming_reminders_variation: number;
  new_properties_today: number;
  new_properties_today_variation: number;
  conversion_rate: number;
  conversion_rate_variation: number;
}

// ---------- API ----------
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
