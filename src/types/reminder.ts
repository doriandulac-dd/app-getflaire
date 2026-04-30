export interface ReminderFromSuivi {
  id: string;
  user_id: string;
  annonce_id: string;
  statut: 'to_process' | 'to_call' | 'called' | 'rdv' | 'hidden';
  note?: string;
  date_suivi: string;
  // Données de l'annonce jointe
  annonce?: {
    id: string;
    title: string;
    price: number;
    city: string;
    postal_code: string;
    type_de_bien: string;
    url: string;
    image_urls?: any;
  };
}

export interface ReminderFilters {
  search?: string;
  type?: 'to_process' | 'to_call' | 'called' | 'rdv';
  status?: 'pending' | 'completed' | 'overdue';
  period?: 'today' | 'week' | 'month' | 'custom';
  date_from?: string;
  date_to?: string;
}

export interface ReminderFormData {
  annonce_id: string;
  type: 'to_process' | 'to_call' | 'rdv';
  date_suivi: string;
  note?: string;
}

export interface ProcessedReminder {
  id: string;
  type: 'to_process' | 'to_call' | 'called' | 'rdv';
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
  image_urls?: any;
}

// 2. REQUÊTE SUPABASE À UTILISER (avec jointure image_urls)
const { data, error } = await supabase
  .from('suivi_annonce')
  .select(`
    *,
    annonce:annonce_id (
      id,
      title,
      price,
      city,
      postal_code,
      type_de_bien,
      url,
      image_urls
    )
  `)
  // .eq('user_id', appUser.id) // adapte ton filtre ici
  ;

// 3. LOGIQUE DE STATUT (à personnaliser selon ta logique métier)
function getReminderStatus(item: ReminderFromSuivi): 'pending' | 'completed' | 'overdue' {
  // Exemple simple : en retard si date passée, sinon pending, etc.
  if (item.statut === 'called') return 'completed';
  if (item.date_suivi && new Date(item.date_suivi) < new Date() && item.statut !== 'called') {
    return 'overdue';
  }
  return 'pending';
}

// 4. MAPPING ReminderFromSuivi → ProcessedReminder
const processedReminders: ProcessedReminder[] = (data || []).map((item: ReminderFromSuivi) => ({
  id: item.id,
  type: item.statut,
  title: item.annonce?.title || '',
  scheduled_date: item.date_suivi,
  status: getReminderStatus(item),
  annonce_title: item.annonce?.title || '',
  annonce_id: item.annonce_id,
  annonce_url: item.annonce?.url || '',
  note: item.note,
  city: item.annonce?.city || '',
  price: item.annonce?.price || 0,
  type_de_bien: item.annonce?.type_de_bien || '',
  image_urls: item.annonce?.image_urls,   // <-- ICI le champ image !
}));

// Utilisation :
// Passe processedReminders à ta page ou ReminderCard, c’est prêt 🚀