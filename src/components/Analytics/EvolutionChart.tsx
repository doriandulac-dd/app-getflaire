import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EvolutionData } from '../../types/analytics';

interface EvolutionChartProps {
  data: EvolutionData[];
  loading?: boolean;
}

// --- Composant de légende custom ---
const CustomLegend = ({ payload, hiddenLines, onClick }: any) => (
  <ul className="flex space-x-6 mt-2 justify-center">
    {payload.map((entry: any) => (
      <li
        key={entry.dataKey}
        className={`flex items-center cursor-pointer select-none transition-opacity duration-200 ${
          hiddenLines.has(entry.dataKey) ? 'opacity-30' : 'opacity-100'
        }`}
        onClick={() => onClick(entry.dataKey)}
      >
        <span
          className="inline-block w-4 h-4 rounded-full mr-2"
          style={{ backgroundColor: entry.color, border: '1.5px solid #e5e7eb' }}
        />
        <span>{entry.value}</span>
      </li>
    ))}
  </ul>
);

const EvolutionChart: React.FC<EvolutionChartProps> = ({ data, loading = false }) => {
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

  const handleLegendClick = (dataKey: string) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-3 bg-gray-200 rounded w-12"></div>
                <div className="h-3 bg-gray-200 rounded flex-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <p className="text-secondary-500">Aucune donnée disponible pour cette période</p>
      </div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            content={
              (props) => (
                <CustomLegend
                  {...props}
                  hiddenLines={hiddenLines}
                  onClick={handleLegendClick}
                />
              )
            }
          />
          <Line 
            type="monotone" 
            dataKey="annoncesParticulier" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
            name="Nouvelles annonces Particulier"
            hide={hiddenLines.has("annoncesParticulier")}
          />
          <Line 
            type="monotone" 
            dataKey="annoncesPro" 
            stroke="#EF4444" 
            strokeWidth={2}
            dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#EF4444', strokeWidth: 2 }}
            name="Nouvelles annonces Pro"
            hide={hiddenLines.has("annoncesPro")}
          />
          <Line 
            type="monotone" 
            dataKey="appels" 
            stroke="#10B981" 
            strokeWidth={2}
            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
            name="Appels passés"
            hide={hiddenLines.has("appels")}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EvolutionChart;