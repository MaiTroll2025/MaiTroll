import React from 'react';

type AgencyGoalsTableProps = {
  agencyId?: string;
  userRole?: string;
};

export const AgencyGoalsTable: React.FC<AgencyGoalsTableProps> = ({
  agencyId: _agencyId,
  userRole: _userRole,
}) => {
  return (
    <div className="p-6">
      <h3 className="mb-4 text-lg font-semibold text-cyan-400">
        Agency Goals
      </h3>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm">
        <p className="text-slate-400">Goals list loading...</p>
      </div>
    </div>
  );
};

export default AgencyGoalsTable;