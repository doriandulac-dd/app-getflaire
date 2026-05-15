import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { User as SupaUser } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import {
  User as CoreUser,
  UserProfile,
  PersonalizationSettings,
  Agency,
  UserRole,
  CommercialProfileSettings,
} from '../types';

type AppUser = CoreUser & {
  profile: UserProfile;
  agency?: Agency | null;
};

type SignUpProfileType = 'independant' | 'agence';

type SignUpUserData = {
  nom: string;
  prenom: string;
  telephone?: string;
  profileType: SignUpProfileType;
  nomAgence?: string;
  siren?: string;
  agency_id?: string;
  departements_autorises?: string[];
  personalization_settings?: PersonalizationSettings;
};

type AuthContextValue = {
  user: SupaUser | null;
  appUser: AppUser | null;
  loading: boolean;
  profileError: string | null;
  signIn: typeof supabase.auth.signInWithPassword;
  signUp: (
    email: string,
    password: string,
    userData: SignUpUserData
  ) => ReturnType<typeof supabase.auth.signUp>;
  signOut: () => ReturnType<typeof supabase.auth.signOut>;
  refreshAppUser: (overrideUserId?: string) => Promise<void>;
  updatePersonalizationSettings: (
    partial: Partial<PersonalizationSettings>
  ) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const normalizeRole = (role: unknown): UserRole => {
  if (role === 'admin' || role === 'agent' || role === 'independant') return role;
  return 'agent';
};

const normalizePersonalization = (raw: unknown): PersonalizationSettings | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const settings = raw as Partial<PersonalizationSettings>;
  const commercialProfile = settings.commercial_profile as CommercialProfileSettings | undefined;
  return {
    mode: settings.mode ?? (settings.theme === 'dark' || settings.theme === 'system' ? settings.theme : 'light'),
    primaryColor: settings.primaryColor ?? (settings.theme === 'blue' || settings.theme === 'green' || settings.theme === 'purple' || settings.theme === 'orange' ? settings.theme : 'orange'),
    items_per_page: settings.items_per_page,
    notifications_email: settings.notifications_email,
    notifications_push: settings.notifications_push,
    notifications_new_listings: settings.notifications_new_listings,
    commercial_profile: commercialProfile
      ? {
          tone: commercialProfile.tone,
          specialty: commercialProfile.specialty,
          zone: commercialProfile.zone,
          promise: commercialProfile.promise,
          common_objections: commercialProfile.common_objections,
          sms_signature: commercialProfile.sms_signature,
          network_name: commercialProfile.network_name,
          agency_name: commercialProfile.agency_name,
          is_agency: commercialProfile.is_agency,
          positioning: commercialProfile.positioning,
          call_instructions: commercialProfile.call_instructions,
          sms_instructions: commercialProfile.sms_instructions,
          preferred_approaches: commercialProfile.preferred_approaches,
        }
      : undefined,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchAppUser = useCallback(async (userId: string, authEmail?: string, retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 1000;

    try {
      setProfileError(null);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          agency:agencies(*)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        setAppUser(null);
        setProfileError(userError.message);
        toast.error('Erreur lors de la récupération des données utilisateur');
        return;
      }

      if (!userData) {
        setAppUser(null);
        setProfileError('Profil applicatif introuvable pour cet utilisateur.');
        return;
      }

      const departements = Array.isArray(userData.departements_autorises)
        ? userData.departements_autorises
        : [];

      const profile: UserProfile = {
        id: userData.id,
        first_name: userData.Prenom || '',
        last_name: userData.nom || '',
        phone: userData.telephone || '',
        avatar_url: '',
        created_at: userData.created_at,
        updated_at: userData.created_at,
      };

      const normalized: AppUser = {
        id: userData.id,
        email: authEmail || userData.email || '',
        nom: userData.nom || '',
        telephone: userData.telephone || '',
        agency_id: userData.agency_id || undefined,
        departements_autorises: departements,
        valide: userData.valide ?? false,
        created_at: userData.created_at,
        Prenom: userData.Prenom || '',
        Role: normalizeRole(userData.Role),
        agency: userData.agency || null,
        personalization_settings: normalizePersonalization(userData.personalization_settings),
        profile,
      };

      setAppUser(normalized);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('Failed to fetch') && retryCount < maxRetries) {
        window.setTimeout(() => {
          void fetchAppUser(userId, authEmail, retryCount + 1);
        }, retryDelay * (retryCount + 1));
        return;
      }

      const message = err instanceof Error ? err.message : 'Erreur lors de la récupération des données utilisateur';
      setAppUser(null);
      setProfileError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          void fetchAppUser(session.user.id, session.user.email);
        } else {
          setLoading(false);
        }
      })
      .catch(async (error) => {
        if (
          error?.message?.includes('refresh_token_not_found') ||
          error?.message?.includes('Invalid Refresh Token')
        ) {
          toast.error('Votre session a expiré. Veuillez vous reconnecter.');
          await supabase.auth.signOut();
        }
        setUser(null);
        setAppUser(null);
        setProfileError(error instanceof Error ? error.message : 'Erreur session');
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        setLoading(true);
        void fetchAppUser(session.user.id, session.user.email);
      } else {
        setAppUser(null);
        setProfileError(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchAppUser]);

  const signIn = useCallback((email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  }, []);

  const signUp = useCallback(async (email: string, password: string, userData: SignUpUserData) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (data.user && !error) {
      let agencyId: string | null = null;

      if (userData.profileType === 'agence' && userData.nomAgence) {
        let attempt = 0;
        let agencyData: { id: string } | null = null;

        while (!agencyData && attempt < 10) {
          const nameToTry = attempt === 0 ? userData.nomAgence : `${userData.nomAgence} (${attempt})`;
          const { data: agency, error: agencyError } = await supabase
            .from('agencies')
            .insert({
              name: nameToTry,
              siren: userData.siren || null,
            })
            .select('id')
            .single();

          if (!agencyError) {
            agencyData = agency;
            agencyId = agency.id;
          } else if (agencyError.code === '23505') {
            if (agencyError.message.includes('agencies_siren_key')) {
              throw new Error('Ce numéro SIREN est déjà utilisé par une autre agence');
            }
            attempt += 1;
          } else {
            throw new Error(`Erreur lors de la création de l'agence: ${agencyError.message}`);
          }
        }

        if (!agencyData) {
          throw new Error('Impossible de créer une agence avec un nom unique après plusieurs tentatives');
        }
      }

      const role: UserRole = userData.profileType === 'agence' ? 'admin' : userData.profileType === 'independant' ? 'independant' : 'agent';
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          nom: userData.nom,
          Prenom: userData.prenom,
          telephone: userData.telephone,
          Role: role,
          agency_id: userData.agency_id || agencyId,
          departements_autorises: Array.isArray(userData.departements_autorises)
            ? userData.departements_autorises
            : null,
          personalization_settings: userData.personalization_settings || {},
        });

      if (userError) {
        throw new Error(`Erreur lors de la création du profil: ${userError.message}`);
      }
    }

    return { data, error };
  }, []);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const refreshAppUser = useCallback(async (overrideUserId?: string) => {
    const uid = overrideUserId || user?.id;
    if (!uid) return;
    await fetchAppUser(uid, user?.email, 0);
  }, [fetchAppUser, user?.email, user?.id]);

  const updatePersonalizationSettings = useCallback(async (partial: Partial<PersonalizationSettings>) => {
    if (!user?.id) return { error: new Error('Utilisateur non authentifié') };

    const current = appUser?.personalization_settings || {};
    const next: PersonalizationSettings = {
      ...current,
      ...partial,
    };

    const { error } = await supabase
      .from('users')
      .update({ personalization_settings: next })
      .eq('id', user.id);

    if (!error) {
      setAppUser(prev => (prev ? { ...prev, personalization_settings: next } : prev));
    }

    return { error: error ? new Error(error.message) : null };
  }, [appUser?.personalization_settings, user?.id]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    appUser,
    loading,
    profileError,
    signIn,
    signUp,
    signOut,
    refreshAppUser,
    updatePersonalizationSettings,
  }), [appUser, loading, profileError, refreshAppUser, signIn, signOut, signUp, updatePersonalizationSettings, user]);

  return createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }
  return context;
};
