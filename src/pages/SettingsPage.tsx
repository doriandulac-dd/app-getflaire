import React, { useState, useEffect } from 'react';
import {
  type LucideIcon,
  User as UserIcon,
  Bell,
  Users,
  CreditCard,
  MessageSquare,
  Save,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import CollaborationManager from '../components/Settings/CollaborationManager';
import BillingPage from './BillingPage';
import PageHeader from '../components/UI/PageHeader';
import SurfacePanel from '../components/UI/SurfacePanel';
import { useGsapReveal } from '../hooks/useGsapReveal';
import type { CommercialProfileSettings } from '../types';

type TabId = 'account' | 'preferences' | 'departments' | 'collaboration' | 'personalization' | 'billing';

type AccountData = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  nom_agence: string;
  siren: string;
  departements_autorises: string[];
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ThemeChoice = 'light' | 'dark' | 'system';
type PrimaryChoice = 'blue' | 'green' | 'purple' | 'orange';
type LegacySettingsUser = {
  role?: string;
  Role?: string;
  agency_id?: string | null;
  nom_agence?: string | null;
  siren?: string | null;
  departements_autorises?: string[] | null;
  personalization_settings?: {
    theme?: ThemeChoice;
    primaryColor?: PrimaryChoice;
    items_per_page?: number;
  };
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const SettingsPage: React.FC = () => {
  const { appUser, refreshAppUser, loading: authLoading, updatePersonalizationSettings } = useAuth();
  const legacyUser = appUser as (NonNullable<typeof appUser> & LegacySettingsUser) | null;
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // --------- ACCOUNT STATE ----------
  const [accountData, setAccountData] = useState<AccountData>({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    nom_agence: '',
    siren: '',
    departements_autorises: [],
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // --------- PERSONALIZATION STATE ----------
  const initialTheme: ThemeChoice =
    legacyUser?.personalization_settings?.theme || 'light';
  const initialPrimary: PrimaryChoice =
    legacyUser?.personalization_settings?.primaryColor || 'orange';

  const [theme, setTheme] = useState<ThemeChoice>(initialTheme);
  const [primaryColor, setPrimaryColor] = useState<PrimaryChoice>(initialPrimary);
  const [commercialProfile, setCommercialProfile] = useState<CommercialProfileSettings>({
    tone: 'conseil',
    specialty: '',
    zone: '',
    promise: '',
    common_objections: '',
    sms_signature: '',
    network_name: '',
    agency_name: '',
    is_agency: false,
    positioning: '',
    call_instructions: '',
    sms_instructions: '',
    preferred_approaches: '',
  });

  // --------- BILLING STATE ----------

  // -------- Hydrate account form (safe) --------
  useEffect(() => {
    if (authLoading || !appUser) return;
    setAccountData(prev => ({
      ...prev,
      nom: appUser.profile?.last_name || '',
      prenom: appUser.profile?.first_name || '',
      email: appUser.email || '',
      telephone: appUser.profile?.phone || '',
      nom_agence: appUser.agency?.name || legacyUser?.nom_agence || '',
      siren: appUser.agency?.siren || legacyUser?.siren || '',
      departements_autorises: Array.isArray(legacyUser?.departements_autorises)
        ? legacyUser.departements_autorises
        : [],
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }));
    setTheme(legacyUser?.personalization_settings?.theme || 'light');
    setPrimaryColor(legacyUser?.personalization_settings?.primaryColor || 'orange');
    setCommercialProfile({
      tone: legacyUser?.personalization_settings?.commercial_profile?.tone || 'conseil',
      specialty: legacyUser?.personalization_settings?.commercial_profile?.specialty || '',
      zone: legacyUser?.personalization_settings?.commercial_profile?.zone || '',
      promise: legacyUser?.personalization_settings?.commercial_profile?.promise || '',
      common_objections: legacyUser?.personalization_settings?.commercial_profile?.common_objections || '',
      sms_signature: legacyUser?.personalization_settings?.commercial_profile?.sms_signature || '',
      network_name: legacyUser?.personalization_settings?.commercial_profile?.network_name || '',
      agency_name: legacyUser?.personalization_settings?.commercial_profile?.agency_name || appUser.agency?.name || legacyUser?.nom_agence || '',
      is_agency: legacyUser?.personalization_settings?.commercial_profile?.is_agency ?? Boolean(appUser.agency?.id || legacyUser?.agency_id),
      positioning: legacyUser?.personalization_settings?.commercial_profile?.positioning || '',
      call_instructions: legacyUser?.personalization_settings?.commercial_profile?.call_instructions || '',
      sms_instructions: legacyUser?.personalization_settings?.commercial_profile?.sms_instructions || '',
      preferred_approaches: legacyUser?.personalization_settings?.commercial_profile?.preferred_approaches || '',
    });
  }, [authLoading, appUser, legacyUser]);

  // ---- Aperçu instantané thème/couleur ----
  useEffect(() => {
    const root = document.documentElement;
    const setDarkClass = (enable: boolean) => {
      if (enable) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    if (theme === 'dark') setDarkClass(true);
    else if (theme === 'light') setDarkClass(false);
    else {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      setDarkClass(mql.matches);
    }
    const possible = ['theme-blue', 'theme-green', 'theme-purple', 'theme-orange'];
    possible.forEach(c => root.classList.remove(c));
    root.classList.add(`theme-${primaryColor}`);
  }, [theme, primaryColor]);

  // -------- Onglets visibles --------
  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: 'account', label: 'Compte', icon: UserIcon },
    { id: 'preferences', label: 'Préférences', icon: Bell },
    { id: 'personalization', label: 'Pige', icon: MessageSquare },
    { id: 'collaboration', label: 'Collaboration', icon: Users },
    { id: 'billing', label: 'Facturation', icon: CreditCard },
  ];

  const roleStr = (legacyUser?.role ?? legacyUser?.Role ?? '').toString().toLowerCase();
  const hasAgency = !!(legacyUser?.agency_id || appUser?.agency?.id);
  const canSeeCollab = hasAgency && (roleStr === 'admin' || roleStr === 'agence' || roleStr === 'agent');

  const visibleTabs = tabs
    .filter(t => t.id !== 'collaboration' || canSeeCollab)
    .filter(t => t.id !== 'billing' || roleStr !== 'agent')
  const settingsRef = useGsapReveal<HTMLDivElement>([activeTab], {
    selector: '[data-gsap-reveal]',
    y: 16,
    stagger: 0.045,
  });

  // -------- Account save --------
  const handleAccountSave = async () => {
    if (!appUser?.id) return;
    if (accountData.newPassword && accountData.newPassword !== accountData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          nom: accountData.nom,
          Prenom: accountData.prenom,
          telephone: accountData.telephone,
        })
        .eq('id', appUser.id);
      if (error) throw error;

      if (accountData.nom_agence || accountData.siren) {
        const agencyData = { name: accountData.nom_agence, siren: accountData.siren || null };
        let agencyId = legacyUser?.agency_id;

        if (agencyId) {
          const { error: agencyError } = await supabase.from('agencies').update(agencyData).eq('id', agencyId);
          if (agencyError) throw agencyError;
        } else {
          const { data: newAgency, error: agencyError } = await supabase
            .from('agencies').insert(agencyData).select().single();
          if (agencyError) throw agencyError;
          agencyId = newAgency.id;
          const { error: linkError } = await supabase.from('users').update({ agency_id: agencyId }).eq('id', appUser.id);
          if (linkError) throw linkError;
        }
      } else if (legacyUser?.agency_id) {
        const { error: unlinkError } = await supabase.from('users').update({ agency_id: null }).eq('id', appUser.id);
        if (unlinkError) throw unlinkError;
      }

      if (accountData.newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: accountData.newPassword });
        if (passwordError) throw passwordError;
        setAccountData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      }

      await refreshAppUser(appUser.id);
      toast.success('Paramètres sauvegardés avec succès');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Erreur lors de la sauvegarde'));
    } finally {
      setLoading(false);
    }
  };

  // -------- Dept change request --------
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptRequestedCsv, setDeptRequestedCsv] = useState('');
  const [deptRequestMessage, setDeptRequestMessage] = useState('');
  const [deptSubmitting, setDeptSubmitting] = useState(false);

  const submitDeptChangeRequest = async () => {
    if (!appUser?.id) return;
    if (!deptRequestedCsv.trim()) {
      toast.error("Merci d'indiquer la liste souhaitée (CSV).");
      return;
    }
    setDeptSubmitting(true);
    try {
      const requested_list = deptRequestedCsv.split(',').map(s => s.trim()).filter(Boolean);
      const { error } = await supabase.from('change_requests').insert({
        user_id: appUser.id,
        type: 'departements_autorises',
        current_list: accountData.departements_autorises,
        requested_list,
        message: deptRequestMessage || null,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Votre demande a été envoyée. Nous revenons vers vous rapidement.');
      setDeptModalOpen(false);
      setDeptRequestedCsv('');
      setDeptRequestMessage('');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Impossible d'envoyer la demande"));
    } finally {
      setDeptSubmitting(false);
    }
  };


  // -------- Renders --------
  const renderAccountTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">Informations personnelles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Prénom</label>
            <input
              type="text"
              value={accountData.prenom}
              onChange={(e) => setAccountData(prev => ({ ...prev, prenom: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Nom</label>
            <input
              type="text"
              value={accountData.nom}
              onChange={(e) => setAccountData(prev => ({ ...prev, nom: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Email</label>
            <input
              type="email"
              value={accountData.email}
              onChange={(e) => setAccountData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              disabled
            />
            <p className="text-xs text-secondary-500 mt-1">L'email ne peut pas être modifié pour des raisons de sécurité</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Téléphone</label>
            <input
              type="tel"
              value={accountData.telephone}
              onChange={(e) => setAccountData(prev => ({ ...prev, telephone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="06 12 34 56 78"
            />
          </div>
        </div>
      </div>

      {/* Informations agence - seulement pour les admins */}
      {appUser?.Role !== 'agent' && (
        <div>
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Informations agence</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Nom de l'agence</label>
              <input
                type="text"
                value={accountData.nom_agence}
                onChange={(e) => setAccountData(prev => ({ ...prev, nom_agence: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Nom de votre agence"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">SIREN</label>
              <input
                type="text"
                value={accountData.siren}
                onChange={(e) => setAccountData(prev => ({ ...prev, siren: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="123 456 789"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">Sécurité</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={accountData.currentPassword}
                onChange={(e) => setAccountData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 pr-10"
                placeholder="Saisissez votre mot de passe actuel"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Nouveau mot de passe</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={accountData.newPassword}
                onChange={(e) => setAccountData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Nouveau mot de passe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Confirmer le nouveau mot de passe</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={accountData.confirmPassword}
                onChange={(e) => setAccountData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="Confirmez le nouveau mot de passe"
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-secondary-900 mb-4">Départements autorisés</h2>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-secondary-700">Départements actuels :</span>
            <button
              onClick={() => setDeptModalOpen(true)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Demander une modification
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {accountData.departements_autorises.length > 0 ? (
              accountData.departements_autorises.map((dept) => (
                <span key={dept} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800">
                  {dept}
                </span>
              ))
            ) : (
              <span className="text-sm text-secondary-500">Aucun département autorisé</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleAccountSave}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Sauvegarder
        </button>
      </div>

      {/* Modal de demande de changement de départements */}
      {deptModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-secondary-900">Demande de modification des départements</h3>
              <button onClick={() => setDeptModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-md">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Départements souhaités (séparés par des virgules)</label>
                <input
                  type="text"
                  value={deptRequestedCsv}
                  onChange={(e) => setDeptRequestedCsv(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Ex: 75, 92, 93, 94"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Message (optionnel)</label>
                <textarea
                  value={deptRequestMessage}
                  onChange={(e) => setDeptRequestMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Expliquez votre demande..."
                />
              </div>
            </div>

            <div className="flex space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setDeptModalOpen(false)}
                className="flex-1 px-4 py-2 text-secondary-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={submitDeptChangeRequest}
                disabled={deptSubmitting}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deptSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                ) : (
                  'Envoyer la demande'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPreferencesTab = () => {
    const currentItemsPerPage = appUser?.personalization_settings?.items_per_page || 20;
    const currentNotificationSettings = {
      notifications_email: appUser?.personalization_settings?.notifications_email ?? true,
      notifications_push: appUser?.personalization_settings?.notifications_push ?? false,
      notifications_new_listings: appUser?.personalization_settings?.notifications_new_listings ?? false,
    };

    const handleItemsPerPageChange = async (value: string) => {
      const numValue = parseInt(value, 10);
      await updatePersonalizationSettings({ items_per_page: numValue });
      await refreshAppUser(appUser?.id);
      toast.success('Préférence sauvegardée');
    };

    const handleNotificationPreferenceChange = async (
      key: keyof typeof currentNotificationSettings,
      checked: boolean
    ) => {
      try {
        const { error } = await updatePersonalizationSettings({ [key]: checked });
        if (error) throw error;
        await refreshAppUser(appUser?.id);
        toast.success('Préférence sauvegardée');
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, 'Erreur lors de la sauvegarde'));
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentNotificationSettings.notifications_email}
                onChange={(event) => handleNotificationPreferenceChange('notifications_email', event.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-secondary-700">Recevoir des notifications par email</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentNotificationSettings.notifications_push}
                onChange={(event) => handleNotificationPreferenceChange('notifications_push', event.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-secondary-700">Recevoir des notifications push</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentNotificationSettings.notifications_new_listings}
                onChange={(event) => handleNotificationPreferenceChange('notifications_new_listings', event.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <span className="ml-3 text-sm text-secondary-700">Notifications de nouvelles annonces</span>
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-secondary-900 mb-4">Préférences d'affichage</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Nombre d'annonces par page</label>
              <select
                value={currentItemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

      </div>
    );
  };

  const renderPersonalizationTab = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-secondary-900 mb-2">Préparation Pige</h2>
        <p className="text-sm text-secondary-600">
          Ces informations servent à personnaliser les scripts d'appel et les SMS générés depuis les fiches annonce.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-secondary-900 mb-4">Profil commercial</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Ton commercial</label>
            <select
              value={commercialProfile.tone || 'conseil'}
              onChange={(e) => setCommercialProfile(prev => ({ ...prev, tone: e.target.value as CommercialProfileSettings['tone'] }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="conseil">Conseil</option>
              <option value="direct">Direct</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Spécialité</label>
              <input
                type="text"
                value={commercialProfile.specialty || ''}
                onChange={(e) => setCommercialProfile(prev => ({ ...prev, specialty: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="ex: maisons familiales, investisseurs, estimation rapide"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Zone</label>
              <input
                type="text"
                value={commercialProfile.zone || ''}
                onChange={(e) => setCommercialProfile(prev => ({ ...prev, zone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="ex: Troyes et première couronne"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Réseau de mandataires</label>
              <input
                type="text"
                value={commercialProfile.network_name || ''}
                onChange={(e) => setCommercialProfile(prev => ({ ...prev, network_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="ex: IAD, SAFTI, Capifrance"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Agence ou marque</label>
              <input
                type="text"
                value={commercialProfile.agency_name || ''}
                onChange={(e) => setCommercialProfile(prev => ({ ...prev, agency_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="ex: GetFlaire Immobilier"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-secondary-700">
            <input
              type="checkbox"
              checked={commercialProfile.is_agency || false}
              onChange={(e) => setCommercialProfile(prev => ({ ...prev, is_agency: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Je communique au nom d'une agence
          </label>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Promesse commerciale</label>
            <textarea
              value={commercialProfile.promise || ''}
              onChange={(e) => setCommercialProfile(prev => ({ ...prev, promise: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="ex: Je donne un avis marché clair et les points qui déclenchent les visites."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Positionnement</label>
            <textarea
              value={commercialProfile.positioning || ''}
              onChange={(e) => setCommercialProfile(prev => ({ ...prev, positioning: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="ex: J'aide les vendeurs particuliers à vendre plus vite avec une qualification acheteur sérieuse."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Objections fréquentes</label>
            <textarea
              value={commercialProfile.common_objections || ''}
              onChange={(e) => setCommercialProfile(prev => ({ ...prev, common_objections: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="ex: je préfère vendre seul, je veux attendre un peu, j'ai déjà des appels"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Consignes pour les appels</label>
              <textarea
                value={commercialProfile.call_instructions || ''}
                onChange={(e) => setCommercialProfile(prev => ({ ...prev, call_instructions: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="ex: Ton calme, éviter de parler mandat trop tôt, proposer un échange court."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Consignes pour les SMS</label>
              <textarea
                value={commercialProfile.sms_instructions || ''}
                onChange={(e) => setCommercialProfile(prev => ({ ...prev, sms_instructions: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                placeholder="ex: Maximum 300 caractères, naturel, pas trop commercial."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Axes à privilégier</label>
            <input
              type="text"
              value={commercialProfile.preferred_approaches || ''}
              onChange={(e) => setCommercialProfile(prev => ({ ...prev, preferred_approaches: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="ex: estimation, qualification projet, objection vendre seul"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Signature SMS</label>
            <input
              type="text"
              value={commercialProfile.sms_signature || ''}
              onChange={(e) => setCommercialProfile(prev => ({ ...prev, sms_signature: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              placeholder="ex: Dorian - GetFlaire"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={async () => {
                const { error } = await updatePersonalizationSettings({ commercial_profile: commercialProfile });
                if (error) {
                  toast.error(error.message);
                  return;
                }
                await refreshAppUser(appUser?.id);
                toast.success('Paramètres Pige sauvegardés');
              }}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              <Save className="h-4 w-4 mr-2" />
              Sauvegarder les paramètres Pige
            </button>
          </div>
        </div>
      </div>

    </div>
  );

  const renderBillingTab = () => <BillingPage />;

  const renderCollaborationTab = () => {
    if (authLoading) return <div className="text-sm text-secondary-600">Chargement du compte…</div>;
    if (!appUser) return <div className="text-sm text-secondary-600">Utilisateur non chargé.</div>;

    const rawRole = (legacyUser?.role ?? legacyUser?.Role ?? '').toString().toLowerCase();
    const isAdmin = rawRole === 'admin' || rawRole === 'agence';
    const isAgent = rawRole === 'agent';
    const isIndep = rawRole === 'independant' || rawRole === 'indépendant';
    const hasAgency = Boolean(legacyUser?.agency_id) || Boolean(appUser.agency?.id);

    if (isIndep) {
      return <div className="text-sm text-secondary-600">Les indépendants ne disposent pas de collaborateurs.</div>;
    }
    if (!hasAgency) {
      return (
        <div className="text-sm text-secondary-600">
          Tu dois être rattaché à une agence (champ <code>agency_id</code>) pour accéder à la collaboration.
        </div>
      );
    }
    if (isAdmin) return <CollaborationManager mode="full" />;
    if (isAgent) return <CollaborationManager mode="readonly" />;
    return <div className="text-sm text-red-600">Rôle non reconnu : <code>{rawRole || 'vide'}</code></div>;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return renderAccountTab();
      case 'preferences':
        return renderPreferencesTab();
      case 'collaboration':
        return renderCollaborationTab();
      case 'personalization':
        return renderPersonalizationTab();
      case 'billing':
        return renderBillingTab();
      default:
        return renderAccountTab();
    }
  };

  return (
    <div ref={settingsRef} className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Paramètres"
        description="Gérez votre compte, votre équipe, vos préférences et votre facturation."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <SurfacePanel className="p-2">
          <nav className="space-y-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const labelClass = 'whitespace-nowrap truncate';

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center justify-start gap-3
                    px-3 py-3 text-sm font-semibold rounded-xl transition-all
                    ${isActive
                      ? 'bg-secondary-900 text-white shadow-sm'
                      : 'text-secondary-600 hover:text-secondary-900 hover:bg-gray-50'
                    }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className={labelClass}>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          </SurfacePanel>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'billing' ? (
            <div data-gsap-reveal>{renderTabContent()}</div>
          ) : (
            <div className="surface-panel rounded-2xl p-6" data-gsap-reveal>
              {renderTabContent()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
