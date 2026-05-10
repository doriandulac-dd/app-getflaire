export interface Surveillance {
  id: string;
  user_id: string;
  agency_id?: string | null;
  annonce_id: string;
  date_surveillance: string;
  active: boolean;
  notes?: string;
  created_at: string;
}

export interface SurveillanceWithDetails extends Surveillance {
  title: string;
  price: number;
  city: string;
  type_de_bien: string;
  size: number;
  rooms: number;
  en_ligne: boolean;
  supprimee: boolean;
  image_urls: any;
  image_url?: any;
  annonce_url: string;
  source: string;
  nb_modifications: number;
  derniere_modification?: string;
  type_derniere_modification?: string;
  actor_name?: string;
  is_own_action?: boolean;
}

export interface SurveillanceHistorique {
  id: string;
  surveillance_id: string;
  annonce_id: string;
  type_modification: 'prix_change' | 'description_change' | 'title_change' | 'status_change' | 'images_change' | 'mise_en_ligne' | 'mise_hors_ligne' | 'suppression';
  ancienne_valeur?: string;
  nouvelle_valeur?: string;
  date_modification: string;
  detecte_le: string;
  created_at: string;
}

export interface SurveillanceNotification {
  id: string;
  user_id: string;
  surveillance_id: string;
  annonce_id: string;
  type_notification: 'email' | 'in_app' | 'sms';
  contenu: any;
  envoye: boolean;
  date_envoi?: string;
  erreur_envoi?: string;
  created_at: string;
}

export interface SurveillanceSettings {
  id: string;
  user_id: string;
  notifications_email: boolean;
  notifications_app: boolean;
  notifications_sms: boolean;
  frequence_email: 'immediate' | 'daily' | 'weekly';
  types_modifications: string[];
  created_at: string;
  updated_at: string;
}

export interface SurveillanceFilters {
  search?: string;
  property_types?: string[];
  cities?: string[];
  price_min?: number;
  price_max?: number;
  surface_min?: number;
  surface_max?: number;
  status?: 'en_ligne' | 'hors_ligne' | 'supprimee';
  has_modifications?: boolean;
  url_search?: string;
}
