import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const routeMeta = [
    { path: '/', title: 'Dashboard', subtitle: 'Vue opérationnelle' },
    { path: '/pige', title: 'Pige immobilière', subtitle: 'Recherche et qualification' },
    { path: '/alertes-intelligentes', title: 'Alertes intelligentes', subtitle: 'Matching client et scoring' },
    { path: '/surveillance', title: 'Surveillance', subtitle: 'Biens suivis et alertes' },
    { path: '/reminders', title: 'Rappels', subtitle: 'Relances et priorités' },
    { path: '/analytics', title: 'Analytics', subtitle: 'Performance et tendances' },
    { path: '/settings', title: 'Paramètres', subtitle: 'Compte et préférences' },
    { path: '/billing', title: 'Abonnement', subtitle: 'Facturation et options' },
  ];
  const currentRoute = routeMeta.find((route) => route.path === location.pathname) || routeMeta[0];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="glass-panel sticky top-0 z-30 border-x-0 border-t-0 px-4 py-3 lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
            aria-label="Ouvrir la navigation"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex h-9 w-auto items-center justify-center lg:hidden">
              <img
                src="/GetFlaire logo long hd 2000*500-min.png"
                alt="GetFlaire Logo"
                className="h-full w-auto"
              />
            </div>
            <div className="hidden border-l border-gray-200 pl-4 lg:block">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-secondary-900">{currentRoute.title}</h1>
                {location.pathname === '/' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold text-primary-800">
                    <Sparkles className="h-3 w-3" />
                    Nouvelle interface
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-secondary-500">{currentRoute.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative rounded-xl border border-gray-200 bg-white p-2 text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white" />
          </button>
          
          <div className="relative group">
            <button className="flex items-center space-x-2 rounded-2xl border border-gray-200 bg-white px-2 py-1.5 text-gray-600 shadow-sm hover:text-gray-800 hover:shadow-md">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-900 text-white">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden sm:block text-sm font-medium">
                {appUser?.profile.first_name || 'Utilisateur'}
              </span>
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg border border-gray-200 shadow-xl py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="py-1">
                <button 
                  onClick={() => navigate('/settings')}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Paramètres
                </button>
                <button 
                  onClick={handleSignOut}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
