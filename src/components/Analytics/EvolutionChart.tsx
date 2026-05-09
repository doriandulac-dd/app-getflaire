import React, { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EvolutionData } from '../../types/analytics';

interface EvolutionChartProps {
  data: EvolutionData[];
  loading?: boolean;
}

type LegendPayloadItem = {
  dataKey: string;
  color: string;
  value: string;
};

const CustomLegend = ({
  payload = [],
  hiddenLines,
  onClick,
}: {
  payload?: LegendPayloadItem[];
  hiddenLines: Set<string>;
  onClick: (dataKey: string) => void;
}) => (
  <div className="mt-4 flex flex-wrap justify-center gap-2">
    {payload.map((entry) => (
      <button
        key={entry.dataKey}
        type="button"
        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition ${
          hiddenLines.has(entry.dataKey)
            ? 'border-secondary-100 bg-secondary-50 text-secondary-400 opacity-60'
            : 'border-secondary-100 bg-white text-secondary-700 shadow-sm'
        }`}
        onClick={() => onClick(entry.dataKey)}
      >
        <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
        {entry.value}
      </button>
    ))}
  </div>
);

const EvolutionChart: React.FC<EvolutionChartProps> = ({ data, loading = false }) => {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const handleLegendClick = (dataKey: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-[420px] items-center justify-center">
        <div className="w-full max-w-3xl animate-pulse space-y-4">
          <div className="h-4 w-48 rounded bg-secondary-100" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="h-3 w-12 rounded bg-secondary-100" />
              <div className="h-3 flex-1 rounded bg-secondary-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-3xl bg-secondary-50">
        <p className="text-sm font-bold text-secondary-500">Aucune donnée disponible pour cette période</p>
      </div>
    );
  }

  return (
    <div className="h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="4 6" stroke="#e8edf4" vertical={false} />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={34} />
          <Tooltip
            cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '4 4' }}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              boxShadow: '0 20px 45px -24px rgba(15,23,42,0.35)',
              fontWeight: 700,
            }}
            labelStyle={{ color: '#0f172a', fontWeight: 900 }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            content={(props) => (
              <CustomLegend
                payload={(props.payload || []) as LegendPayloadItem[]}
                hiddenLines={hiddenLines}
                onClick={handleLegendClick}
              />
            )}
          />
          <Line
            type="monotone"
            dataKey="annoncesParticulier"
            stroke="#f59e0b"
            strokeWidth={3}
            dot={{ fill: '#f59e0b', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3 }}
            name="Nouvelles annonces Particulier"
            hide={hiddenLines.has('annoncesParticulier')}
          />
          <Line
            type="monotone"
            dataKey="annoncesPro"
            stroke="#1d4ed8"
            strokeWidth={3}
            dot={{ fill: '#1d4ed8', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3 }}
            name="Nouvelles annonces Pro"
            hide={hiddenLines.has('annoncesPro')}
          />
          <Line
            type="monotone"
            dataKey="appels"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 3 }}
            name="Appels passés"
            hide={hiddenLines.has('appels')}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EvolutionChart;
