import React from 'react';

export type SegmentedTab<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

type SegmentedTabsProps<T extends string> = {
  tabs: SegmentedTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
};

const SegmentedTabs = <T extends string>({
  tabs,
  activeTab,
  onChange,
  className = '',
}: SegmentedTabsProps<T>) => (
  <div className={`inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm ${className}`}>
    {tabs.map((tab) => {
      const isActive = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
            isActive
              ? 'bg-secondary-900 text-white shadow-sm'
              : 'text-secondary-600 hover:bg-gray-50 hover:text-secondary-900'
          }`}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${isActive ? 'bg-white/15 text-white' : 'bg-secondary-100 text-secondary-600'}`}>
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default SegmentedTabs;
