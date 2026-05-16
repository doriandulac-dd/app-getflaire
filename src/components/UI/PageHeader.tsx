import React from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
  className = '',
}) => (
  <div
    className={`relative overflow-hidden rounded-3xl bg-secondary-900 p-6 text-white shadow-2xl shadow-secondary-900/25 lg:p-8 ${className}`}
    data-gsap-reveal
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(255,178,63,0.35),transparent_26rem),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.18),transparent_24rem)]" />
    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary-300/80 to-transparent" />

    <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-3 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-black/10 backdrop-blur">
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold text-white lg:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70 lg:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </div>
);

export default PageHeader;
