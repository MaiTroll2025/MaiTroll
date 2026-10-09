import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

type AgencyEarningsChartProps = {
  agencyId?: string;
};

export const AgencyEarningsChart: React.FC<AgencyEarningsChartProps> = ({
  agencyId: _agencyId,
}) => {
  const data = [
    { month: 'Jan', earnings: 0 },
    { month: 'Feb', earnings: 0 },
    { month: 'Mar', earnings: 0 },
    { month: 'Apr', earnings: 0 },
    { month: 'May', earnings: 0 },
    { month: 'Jun', earnings: 0 },
  ];

  return (
    <div className="p-6">
      <h3 className="mb-4 text-lg font-semibold text-cyan-400">
        Agency Earnings
      </h3>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="month" stroke="rgba(203, 213, 225, 0.8)" />
              <YAxis stroke="rgba(203, 213, 225, 0.8)" />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(34, 211, 238, 0.35)',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                }}
              />
              <Line
                type="monotone"
                dataKey="earnings"
                stroke="#4cc9f0"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AgencyEarningsChart;