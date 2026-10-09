import React from 'react';
import { Check, X, Clock, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { StagePass } from '../../types/broadcast';

interface StagePassRequestsPanelProps {
  requests: StagePass[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  className?: string;
}

export default function StagePassRequestsPanel({
  requests,
  onApprove,
  onDeny,
  className,
}: StagePassRequestsPanelProps) {
  if (requests.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-cyan-500/25',
        'bg-slate-950/90 backdrop-blur-md p-3',
        className
      )}
    >
      <div className="flex items-center gap-2 pb-2 border-b border-cyan-500/15">
        <Clock size={13} className="text-cyan-400" />
        <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
          Pending Requests &middot; {requests.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto scrollbar-hide">
        {requests.map((req) => {
          const name = req.user_profile?.username || 'Unknown';
          const _initials = name.slice(0, 2).toUpperCase();

          return (
            <div
              key={req.id}
              className="flex items-center gap-2.5 p-2 rounded-lg bg-black/40 border border-white/5 hover:border-cyan-500/25 transition-all"
            >
              {/* Avatar */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-black overflow-hidden">
                {req.user_profile?.avatar_url ? (
                  <img
                    src={req.user_profile.avatar_url}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={12} />
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white/90 truncate">{name}</p>
                <p className="text-[9px] text-slate-400">
                  {req.price_coins > 0 ? `${req.price_coins} coins` : 'Free'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onApprove(req.id)}
                  className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/40 flex items-center justify-center transition-colors"
                  title="Approve"
                >
                  <Check size={12} className="text-emerald-400" />
                </button>
                <button
                  onClick={() => onDeny(req.id)}
                  className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/40 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                  title="Deny"
                >
                  <X size={12} className="text-red-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
