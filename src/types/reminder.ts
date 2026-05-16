export interface ReminderFromSuivi {
  id: string;
  user_id: string;
  agency_id?: string | null;
  annonce_id: string;
  statut: 'to_call' | 'reminder' | 'called' | 'rdv' | 'hidden';
  note?: string;
  date_suivi: string;
  annonce?: {
    id: string;
    title: string;
    price: number;
    city: string;
    postal_code: string;
    type_de_bien: string;
    url: string;
    image_url?: string[] | string | null;
    image_urls?: string[] | string | null;
  };
}

export interface ReminderFilters {
  search?: string;
  type?: 'to_call' | 'reminder' | 'called' | 'rdv';
  status?: 'pending' | 'completed' | 'overdue';
  period?: 'today' | 'week' | 'month' | 'custom';
  date_from?: string;
  date_to?: string;
}

export interface ReminderFormData {
  annonce_id: string;
  type: 'to_call' | 'reminder' | 'rdv';
  date_suivi: string;
  note?: string;
}

export interface ProcessedReminder {
  id: string;
  user_id: string;
  actor_name?: string;
  is_own_action?: boolean;
  type: 'to_call' | 'reminder' | 'called' | 'rdv';
  title: string;
  scheduled_date: string;
  status: 'pending' | 'completed' | 'overdue';
  annonce_title: string;
  annonce_id: string;
  annonce_url: string;
  note?: string;
  city: string;
  price: number;
  type_de_bien: string;
  image_url?: string[] | string | null;
  image_urls?: string[] | string | null;
}
