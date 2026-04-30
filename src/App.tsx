import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Pige from './pages/Pige';
import PropertyDetails from './pages/PropertyDetails';
import SmartAlerts from './pages/SmartAlerts';

// Placeholder components/pages
import Surveillance from './pages/Surveillance';
import Reminders from './pages/Reminders';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/SettingsPage';
import BillingPage from './pages/BillingPage';
import BillingSuccessPage from './pages/BillingSuccessPage';
import UpgradePage from './pages/UpgradePage';

const Clients = () => <div className="p-6">Clients - En développement</div>;

function App() {
  const { user, loading, appUser, profileError, signOut } = useAuth();

  // ---- Appliquer préférences de personnalisation (dark / couleur primaire) ----
  useEffect(() => {
    const root = document.documentElement;

    const settings = appUser?.personalization_settings || {};
    const mode = settings.mode || 'light';
    const primaryColor = settings.primaryColor || 'orange';
    
    // Helper: appliquer / retirer classe
    const setDarkClass = (enable: boolean) => {
      if (enable) root.classList.add('dark');
      else root.classList.remove('dark');
    };

    // 1) Gérer le mode système avec media query
    let mql: MediaQueryList | null = null;
    const applyTheme = () => {
      if (mode === 'dark') setDarkClass(true);
      else if (mode === 'light') setDarkClass(false);
      else {
        // system
        mql = window.matchMedia('(prefers-color-scheme: dark)');
        setDarkClass(mql.matches);
      }
    };

    // 2) Gérer la classe de couleur primaire (ex: theme-blue, theme-green…)
    // (Tu définiras le mapping dans ton CSS global si tu utilises des variables CSS.)
    const possibleThemes = ['theme-blue', 'theme-green', 'theme-purple', 'theme-orange'];
    possibleThemes.forEach(c => root.classList.remove(c));
    root.classList.add(`theme-${primaryColor}`);

    // 3) Appliquer le thème initial
    applyTheme();

    // 4) Si 'system', écouter les changements du système
    if (mode === 'system') {
      mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setDarkClass(e.matches);
      mql.addEventListener?.('change', handler);
      return () => {
        mql?.removeEventListener?.('change', handler);
      };
    }

    return () => {};
  }, [appUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#363636', color: '#fff' },
          }}
        />
      </Router>
    );
  }

  if (!appUser) {
    return (
      <Router>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold text-secondary-900">Profil GetFlaire introuvable</h1>
            <p className="mt-2 text-sm text-secondary-600">
              Votre session existe, mais les données applicatives du compte ne sont pas disponibles.
            </p>
            {profileError && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{profileError}</p>
            )}
            <button
              onClick={() => void signOut()}
              className="mt-5 rounded-xl bg-secondary-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Revenir à la connexion
            </button>
          </div>
        </div>
        <Toaster position="top-right" />
      </Router>
    );
  }

  return (
    <Router>
      <Toaster position="top-right" />
      <div className="App">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="pige" element={<Pige />} />
            <Route path="pige/:id" element={<PropertyDetails />} />
            <Route path="alertes-intelligentes" element={<SmartAlerts />} />
            <Route path="surveillance" element={<Surveillance />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="clients" element={<Clients />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="billing/success" element={<BillingSuccessPage />} />
            <Route path="billing/upgrade" element={<UpgradePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#363636', color: '#fff' },
          }}
        />
      </div>
    </Router>
  );
}

export default App;
