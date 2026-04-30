import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Les variables d\'environnement Supabase sont manquantes. Veuillez vous connecter à Supabase en cliquant sur le bouton "Connect to Supabase" en haut à droite.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { supabaseUrl };

// Helper function to handle Supabase errors
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error);
  return error?.message || 'Une erreur est survenue';
};