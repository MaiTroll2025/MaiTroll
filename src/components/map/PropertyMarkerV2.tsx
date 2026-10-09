import React from 'react';

export default function PropertyMarkerV2({ id, x: _x, y: _y, owner, isLive, badges }: { id: string; x: number; y: number; owner?: string; isLive?: boolean; badges?: string[] }) {
  return (
    <div className="pointer-events-auto transform -translate-x-1/2 -translate-y-1/2" style={{ width: 140 }}>
      <div className="relative rounded-2xl bg-gradient-to-br from-[#081123] to-[#0b1622] border border-white/6 shadow-[0_18px_40px_rgba(2,6,12,0.8)] p-2">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-sm font-black text-white overflow-hidden">🏠</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-black text-white truncate">{owner || 'Vacant'}</div>
              {isLive && <div className="text-xs font-black uppercase bg-red-600/85 text-white px-2 py-0.5 rounded">LIVE</div>}
            </div>
            <div className="mt-1 text-[11px] text-slate-300 truncate">{badges?.join(' • ') || 'Neighborhood Property'}</div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">ID</div>
            <div className="text-xs font-mono text-slate-200">{String(id).slice(0, 8)}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">Status</div>
            <div className="text-xs font-bold text-emerald-300">{isLive ? 'Active' : 'Idle'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
