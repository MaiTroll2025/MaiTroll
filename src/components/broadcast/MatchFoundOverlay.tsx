import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

type BroadcasterInfo = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  stateCode: string | null;
  stateName: string | null;
};

type MatchFoundOverlayProps = {
  challengerUserId: string;
  opponentUserId: string;
  challengerStateCode: string | null;
  opponentStateCode: string | null;
  countdown: number | null;
};

const MatchFoundOverlay = React.memo(({
  challengerUserId,
  opponentUserId,
  challengerStateCode,
  opponentStateCode,
  countdown,
}: MatchFoundOverlayProps) => {
  const [challenger, setChallenger] = useState<BroadcasterInfo | null>(null);
  const [opponent, setOpponent] = useState<BroadcasterInfo | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data: cData } = await supabase
        .from('user_profiles')
        .select('username, avatar_url, level, state_code')
        .eq('id', challengerUserId)
        .maybeSingle();

      const { data: oData } = await supabase
        .from('user_profiles')
        .select('username, avatar_url, level, state_code')
        .eq('id', opponentUserId)
        .maybeSingle();

      if (cData) {
        setChallenger({
          userId: challengerUserId,
          username: cData.username || 'Broadcaster',
          avatarUrl: cData.avatar_url,
          level: cData.level || 1,
          stateCode: challengerStateCode || cData.state_code,
          stateName: null,
        });
      }

      if (oData) {
        setOpponent({
          userId: opponentUserId,
          username: oData.username || 'Broadcaster',
          avatarUrl: oData.avatar_url,
          level: oData.level || 1,
          stateCode: opponentStateCode || oData.state_code,
          stateName: null,
        });
      }
    };

    void fetchProfiles();
  }, [challengerUserId, opponentUserId, challengerStateCode, opponentStateCode]);

  const getStateName = (code: string | null): string => {
    if (!code) return '';
    const states: Record<string, string> = {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
      CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
      HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
      KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
      MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
      MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
      NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
      OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
      SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
      VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    };
    return states[code] || code;
  };

  const Avatar = ({ info, side }: { info: BroadcasterInfo | null; side: 'challenger' | 'opponent' }) => {
    if (!info) {
      return (
        <div className={cn(
          "flex flex-col items-center gap-2 p-4 rounded-2xl border",
          side === 'challenger' ? "border-emerald-500/30 bg-emerald-500/5" : "border-fuchsia-500/30 bg-fuchsia-500/5"
        )}>
          <div className="w-16 h-16 rounded-full bg-white/10 animate-pulse flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
          <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
        </div>
      );
    }

    return (
      <div className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-2xl border",
        side === 'challenger' ? "border-emerald-500/30 bg-emerald-500/5" : "border-fuchsia-500/30 bg-fuchsia-500/5"
      )}>
        <div className="relative">
          {info.avatarUrl ? (
            <img
              src={info.avatarUrl}
              alt={info.username}
              className="w-16 h-16 rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center text-xl font-black text-white",
              side === 'challenger' ? "bg-emerald-500/30" : "bg-fuchsia-500/30"
            )}>
              {info.username[0]?.toUpperCase()}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full border border-black">
            LVL {info.level}
          </div>
        </div>
        <p className="text-xs font-black text-white text-center truncate max-w-[120px]">
          {info.username}
        </p>
        {info.stateCode && (
          <span className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-full",
            side === 'challenger' ? "bg-emerald-500/15 text-emerald-300" : "bg-fuchsia-500/15 text-fuchsia-300"
          )}>
            {getStateName(info.stateCode)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white mb-1">Match Found!</h2>
        <p className="text-sm text-white/60">Preparing battle arena...</p>
      </div>

      <div className="flex items-center gap-6 md:gap-10">
        <Avatar info={challenger} side="challenger" />
        <div className="text-3xl font-black text-white/20">VS</div>
        <Avatar info={opponent} side="opponent" />
      </div>

      {countdown !== null && countdown > 0 && (
        <div className="mt-2 text-center">
          <div className="text-4xl font-black text-amber-400 animate-pulse">
            {countdown}
          </div>
          <p className="text-xs text-white/50 mt-1">Match starting in...</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs font-bold">Connecting tracks...</span>
      </div>
    </div>
  );
});

MatchFoundOverlay.displayName = 'MatchFoundOverlay';

export default MatchFoundOverlay;

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
