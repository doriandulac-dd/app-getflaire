import React from 'react';

type SurfacePanelProps = {
  children: React.ReactNode;
  className?: string;
  reveal?: boolean;
};

const SurfacePanel: React.FC<SurfacePanelProps> = ({ children, className = '', reveal = true }) => (
  <section
    className={`surface-panel rounded-2xl ${className}`}
    data-gsap-reveal={reveal ? true : undefined}
  >
    {children}
  </section>
);

export default SurfacePanel;
