import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useGsapReveal } from '../../hooks/useGsapReveal';
import { readPigeScrollState, scrollAppTo } from '../../utils/pigeScroll';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const pageRef = useGsapReveal<HTMLDivElement>([location.pathname], {
    selector: '[data-page-reveal]',
    y: 18,
    stagger: 0.04,
  });

  useEffect(() => {
    const shouldRestorePigeScroll =
      location.pathname === '/pige' && Boolean(readPigeScrollState()?.restorePending);

    if (shouldRestorePigeScroll) return;

    scrollAppTo(0);
  }, [location.pathname]);

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main
          ref={mainRef}
          className="flex-1 overflow-auto p-4 lg:p-6"
          data-scroll-restoration-container="true"
        >
          <div ref={pageRef} className="max-w-7xl mx-auto">
            <div key={location.pathname} data-page-reveal>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
