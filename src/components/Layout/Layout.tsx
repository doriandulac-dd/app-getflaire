import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useGsapReveal } from '../../hooks/useGsapReveal';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const pageRef = useGsapReveal<HTMLDivElement>([location.pathname], {
    selector: '[data-page-reveal]',
    y: 18,
    stagger: 0.04,
  });

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-auto p-4 lg:p-6">
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
