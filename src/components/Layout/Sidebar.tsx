import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Radar,
  Eye, 
  Calendar, 
  BarChart3,
  Settings,
  Sparkles,
  X 
} from 'lucide-react';
import { useGsapReveal } from '../../hooks/useGsapReveal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const sidebarRef = useGsapReveal<HTMLElement>([], {
    selector: '[data-sidebar-reveal]',
    x: -12,
    y: 0,
    stagger: 0.045,
    delay: 0.08,
  });

  const navItems = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/pige', icon: Search, label: 'Pige immobilière' },
    { to: '/alertes-intelligentes', icon: Radar, label: 'Alertes intelligentes' },
    { to: '/surveillance', icon: Eye, label: 'Surveillance' },
    { to: '/reminders', icon: Calendar, label: 'Rappels' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/settings', icon: Settings, label: 'Paramètres' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
        fixed left-0 top-0 z-50 h-full w-72 border-r border-white/10 bg-secondary-900 text-white shadow-2xl transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,178,63,0.22),transparent_18rem),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_22rem)]" />

        <div className="relative hidden border-b border-white/10 px-5 py-5 lg:block" data-sidebar-reveal>
          <img
            src="/GetFlaire logo long hd 2000*500-min.png"
            alt="GetFlaire"
            className="h-9 w-auto brightness-0 invert"
          />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary-300/30 bg-primary-300/15 px-3 py-1 text-xs font-semibold text-primary-100">
            <Sparkles className="h-3.5 w-3.5" />
            Nouvelle interface
          </div>
          <p className="mt-3 text-xs text-gray-400">Pilotage immobilier augmenté</p>
        </div>

        <div className="relative flex items-center justify-between border-b border-secondary-700 p-4 lg:hidden">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">GF</span>
            </div>
            <h2 className="text-lg font-bold">GetFlaire</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-secondary-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative mt-6 px-4">
          <ul className="space-y-2">
            {navItems.map(({ to, icon: Icon, label }) => (
              <li key={to} data-sidebar-reveal>
                <NavLink
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) => `
                    nav-link group flex items-center space-x-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'nav-link-active bg-primary-500 text-secondary-950 shadow-lg shadow-primary-500/25' 
                      : 'nav-link-idle text-gray-300 hover:text-white hover:bg-white/10'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur" data-sidebar-reveal>
          <p className="text-xs font-medium text-white">GetFlaire Pro</p>
          <p className="mt-1 text-xs leading-5 text-gray-400">Surveillez, priorisez et relancez sans perdre le fil.</p>
        </div>

        
      </aside>
    </>
  );
};

export default Sidebar;
