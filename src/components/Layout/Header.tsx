import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface HeaderProps {
  onMenuClick: () => void;
}

type NotificationContent = {
  title?: string;
  message?: string;
  type?: string;
  annonce_id?: string;
  alerte_id?: string;
  nouvelle_valeur?: string;
};

type HeaderNotification = {
  id: string;
  source: 'smart-alert' | 'surveillance';
  title: string;
  message: string;
  created_at: string;
  read_at?: string | null;
};

const formatNotificationDate = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));

const surveillanceTypeLabels: Record<string, string> = {
  prix_change: 'Changement de prix détecté',
  mise_hors_ligne: 'Annonce mise hors ligne',
  mise_en_ligne: 'Annonce remise en ligne',
  suppression: 'Annonce supprimée',
};

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const routeMeta = [
    { path: '/', title: 'Dashboard', subtitle: 'Vue opérationnelle' },
    { path: '/pige', title: 'Pige immobilière', subtitle: 'Recherche et qualification' },
    { path: '/prospection', title: 'Prospection', subtitle: 'Carte DPE et cadastre' },
    { path: '/alertes-intelligentes', title: 'Alertes intelligentes', subtitle: 'Matching client et scoring' },
    { path: '/surveillance', title: 'Surveillance', subtitle: 'Biens suivis et alertes' },
    { path: '/reminders', title: 'Rappels', subtitle: 'Relances et priorités' },
    { path: '/analytics', title: 'Analytics', subtitle: 'Performance et tendances' },
    { path: '/settings', title: 'Paramètres', subtitle: 'Compte et préférences' },
    { path: '/billing', title: 'Abonnement', subtitle: 'Facturation et options' },
  ];
  const currentRoute = routeMeta.find((route) => route.path === location.pathname) || routeMeta[0];

  const unreadCount = useMemo(
    () =>
      notifications.filter((notification) =>
        notification.source === 'surveillance' ? true : !notification.read_at
      ).length,
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    if (!appUser?.id) {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);

    const [smartAlertsResult, surveillanceResult] = await Promise.all([
      supabase
        .from('alertes_notifications')
        .select('id, contenu, created_at, read_at')
        .eq('user_id', appUser.id)
        .eq('type_notification', 'in_app')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('surveillance_notifications')
        .select('id, contenu, created_at')
        .eq('user_id', appUser.id)
        .eq('type_notification', 'in_app')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    if (smartAlertsResult.error) {
      console.error('[notifications] smart alerts fetch error', smartAlertsResult.error);
    }

    if (surveillanceResult.error) {
      console.error('[notifications] surveillance fetch error', surveillanceResult.error);
    }

    const smartAlerts = (smartAlertsResult.data || []).map((notification): HeaderNotification => {
      const content = notification.contenu as NotificationContent;
      return {
        id: notification.id,
        source: 'smart-alert',
        title: content.title || 'Alerte intelligente',
        message: content.message || 'Nouvelle activité de matching',
        created_at: notification.created_at,
        read_at: notification.read_at,
      };
    });

    const surveillance = (surveillanceResult.data || []).map((notification): HeaderNotification => {
      const content = notification.contenu as NotificationContent;
      const typeLabel = content.type ? surveillanceTypeLabels[content.type] : undefined;
      return {
        id: notification.id,
        source: 'surveillance',
        title: typeLabel || 'Surveillance',
        message: content.nouvelle_valeur
          ? `Nouvelle valeur : ${content.nouvelle_valeur}`
          : 'Une annonce surveillée a changé',
        created_at: notification.created_at,
      };
    });

    setNotifications([...smartAlerts, ...surveillance]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10));
    setNotificationsLoading(false);
  }, [appUser?.id]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleNotificationClick = async (notification: HeaderNotification) => {
    if (notification.source === 'smart-alert' && !notification.read_at) {
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from('alertes_notifications')
        .update({ read_at: readAt })
        .eq('id', notification.id);

      if (error) {
        console.error('[notifications] mark read error', error);
      } else {
        setNotifications((prev) =>
          prev.map((item) => item.id === notification.id && item.source === 'smart-alert'
            ? { ...item, read_at: readAt }
            : item
          )
        );
      }
    }

    setIsNotificationsOpen(false);
    navigate(notification.source === 'smart-alert' ? '/alertes-intelligentes' : '/surveillance');
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
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen((value) => !value);
                void fetchNotifications();
              }}
              className="relative rounded-xl border border-gray-200 bg-white p-2 text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-700"
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-black text-secondary-950">Notifications</p>
                  <p className="text-xs font-medium text-secondary-500">
                    {unreadCount > 0 ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} à consulter` : 'Tout est à jour'}
                  </p>
                </div>

                <div className="max-h-96 overflow-y-auto p-2">
                  {notificationsLoading ? (
                    <div className="px-3 py-6 text-center text-sm font-semibold text-secondary-500">
                      Chargement...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center">
                      <Bell className="mx-auto h-6 w-6 text-secondary-300" />
                      <p className="mt-2 text-sm font-bold text-secondary-900">Aucune notification</p>
                      <p className="mt-1 text-xs text-secondary-500">Les alertes et surveillances apparaîtront ici.</p>
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const isUnread = notification.source === 'surveillance' || !notification.read_at;
                      return (
                        <button
                          key={`${notification.source}-${notification.id}`}
                          type="button"
                          onClick={() => void handleNotificationClick(notification)}
                          className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-secondary-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-secondary-950">{notification.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs font-medium text-secondary-600">{notification.message}</p>
                              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-secondary-400">
                                {notification.source === 'smart-alert' ? 'Alerte intelligente' : 'Surveillance'} · {formatNotificationDate(notification.created_at)}
                              </p>
                            </div>
                            {isUnread && <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary-500" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          
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
