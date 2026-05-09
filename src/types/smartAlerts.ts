import { Annonce, Client } from './index';

export type SmartAlertStatus = 'active' | 'paused' | 'archived' | 'project' | 'abandoned';
export type SmartAlertPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SmartAlertFrequency = 'realtime' | 'hourly' | 'twice_daily' | 'daily' | 'manual';
export type AlertResultStatus = 'new' | 'viewed' | 'sent' | 'ignored' | 'favorite' | 'followed';
export type SearchMode = 'strict' | 'balanced' | 'opportunity';
export type ImportanceLevel = 'low' | 'medium' | 'high' | 'required';

export interface WeightedKeyword {
  value: string;
  importance: ImportanceLevel;
}

export interface ScoreWeights {
  localisation: number;
  budget: number;
  type: number;
  surface: number;
  exterieur: number;
  etat: number;
  dpe: number;
  motsCles: number;
}

export interface SmartAlertCriteria {
  acceptedCities: string[];
  excludedCities: string[];
  locationImportance: ImportanceLevel;
  propertyTypes: string[];
  secondaryTypes: string[];
  exterior: 'required' | 'preferred' | 'any' | 'not_wanted';
  exteriorImportance: ImportanceLevel;
  landSurfaceMin?: number;
  parking: Record<string, ImportanceLevel | 'any'>;
  condition: string;
  forbiddenWorks: string[];
  dpeAccepted: string[];
  dpeImportance: ImportanceLevel;
  positiveKeywords: WeightedKeyword[];
  negativeKeywords: WeightedKeyword[];
  sellerType: 'particulier' | 'pro' | 'both' | 'off_market' | 'all';
  searchMode: SearchMode;
  scoreWeights: ScoreWeights;
  naturalLanguage?: string;
  investor?: {
    enabled: boolean;
    strategy?: string;
    minGrossYield?: number;
    maxPricePerSqm?: number;
    potential: string[];
  };
}

export interface SmartAlert {
  id: string;
  user_id: string;
  agency_id?: string | null;
  client_id?: string | null;
  nom_alerte: string;
  type_recherche: string;
  statut: SmartAlertStatus;
  priorite: SmartAlertPriority;
  ville?: string | null;
  postal_codes?: string[] | null;
  radius_km: number;
  type_de_bien?: string | null;
  prix_min?: number | null;
  prix_max?: number | null;
  surface_min?: number | null;
  surface_max?: number | null;
  rooms_min?: number | null;
  bedrooms_min?: number | null;
  matching_threshold: number;
  frequence_analyse: SmartAlertFrequency;
  options_avancees: SmartAlertCriteria;
  is_active: boolean;
  last_matching_date?: string | null;
  created_at: string;
  updated_at?: string | null;
  client?: Client | null;
}

export interface ScoreBreakdown {
  localisation: number;
  budget: number;
  type: number;
  surface: number;
  exterieur: number;
  etat: number;
  dpe: number;
  motsCles: number;
}

export interface AlertMatchResult {
  id: string;
  alerte_id: string;
  annonce_id: string;
  score_pertinence: number;
  score_breakdown: ScoreBreakdown;
  points_forts: string[];
  points_faibles: string[];
  resume: string;
  statut_commercial: AlertResultStatus;
  consulte: boolean;
  date_matching: string;
  created_at: string;
  annonce?: Annonce | null;
}

export interface AlertNotification {
  id: string;
  alerte_id: string;
  user_id: string;
  type_notification: 'in_app' | 'email' | 'sms';
  contenu: {
    title?: string;
    message?: string;
    score?: number;
    annonce_id?: string;
    alerte_id?: string;
  };
  envoye: boolean;
  read_at?: string | null;
  date_envoi?: string | null;
  created_at: string;
}

export interface SmartAlertFormData {
  nom_alerte: string;
  type_recherche: string;
  client_id?: string;
  statut: SmartAlertStatus;
  priorite: SmartAlertPriority;
  ville: string;
  postal_codes: string[];
  radius_km: number;
  type_de_bien: string;
  prix_min?: number;
  prix_max?: number;
  surface_min?: number;
  surface_max?: number;
  rooms_min?: number;
  bedrooms_min?: number;
  matching_threshold: number;
  frequence_analyse: SmartAlertFrequency;
  options_avancees: SmartAlertCriteria;
}
