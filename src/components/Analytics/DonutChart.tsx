import React from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DonutData } from '../../types/analytics';

interface DonutChartProps {
  data: DonutData[];
  loading?: boolean;
}

type TooltipPayload = {
  name: string;
  value: number;
};

type LegendPayloadItem = {
  color: string;
  value: string;
};

const DonutChart: React.FC<DonutChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary-100 border-t-primary-500" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl bg-secondary-50">
        <p className="text-sm font-bold text-secondary-500">Aucune donnée disponible</p>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: TooltipPayload }[] }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = total ? ((item.value / total) * 100).toFixed(1) : '0.0';
      return (
        <div className="rounded-2xl border border-secondary-100 bg-white p-3 shadow-xl">
          <p className="font-black text-secondary-950">{item.name}</p>
          <p className="text-sm font-semibold text-secondary-600">
            {item.value} · {percentage}%
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload = [] }: { payload?: LegendPayloadItem[] }) => (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {payload.map((entry) => (
        <div key={entry.value} className="inline-flex items-center rounded-full bg-secondary-50 px-3 py-1.5">
          <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs font-bold text-secondary-700">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative h-72">
      <div className="pointer-events-none absolute inset-x-0 top-[82px] z-10 text-center">
        <p className="text-2xl font-black text-secondary-950">{total}</p>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-secondary-400">total</p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="42%"
            innerRadius={54}
            outerRadius={88}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={3} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={(props) => <CustomLegend payload={(props.payload || []) as LegendPayloadItem[]} />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DonutChart;
