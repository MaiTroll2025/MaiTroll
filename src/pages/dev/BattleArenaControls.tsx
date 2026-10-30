import React from 'react';
import { Users, Zap, ShieldCheck } from 'lucide-react';
import {
  POWER_UPS, SLOTS_PER_SIDE, type PowerUpId, type Side,
} from '../../lib/battleArenaPowerUps';

type SeatCounts = { green: number; purple: number };
type PowerBar = { green: number; purple: number };

export type BattleArenaControlsProps = {
  greenFighterCount: number;
  purpleFighterCount: number;
  hasSeats: boolean;
  seatCounts: SeatCounts;
  setSeatCounts: React.Dispatch<React.SetStateAction<SeatCounts>>;
  powerBar: PowerBar;
  setPowerBar: React.Dispatch<React.SetStateAction<PowerBar>>;
  setLikes: React.Dispatch<React.SetStateAction<{ green: number; purple: number }>>;
  powerSlots: { green: PowerUpId[]; purple: PowerUpId[] };
  openBag: Side | null;
  setOpenBag: React.Dispatch<React.SetStateAction<Side | null>>;
  powerAnnounce: string;
  fullSlotsMsg: Side | null;
  onSendGift: (side: Side) => void;
  onTryActivate: (side: Side) => void;
  onActivatePower: (side: Side, index: number) => void;
  onReset: () => void;
  onForfeit?: () => void;
  canForfeit?: boolean;
  showDemoActions?: boolean;
  onRematchVote?: (side: Side) => void;
};

export default function BattleArenaControls(props: BattleArenaControlsProps) {
  const {
    greenFighterCount, purpleFighterCount, hasSeats, seatCounts, setSeatCounts,
    powerSlots, openBag, setOpenBag,
    powerAnnounce, fullSlotsMsg, onTryActivate, onActivatePower, onReset, onForfeit, canForfeit = true, showDemoActions = true, onRematchVote,
  } = props;

  return (
    <>
      {hasSeats && (
        <div className="flex items-center justify-between gap-3 px-1 pt-2">
          <div className="team-seat-count"><Users size={11} /> {greenFighterCount} FIGHTER{greenFighterCount === 1 ? '' : 'S'}</div>
          <div className="team-seat-count"><Users size={11} /> {purpleFighterCount} FIGHTER{purpleFighterCount === 1 ? '' : 'S'}</div>
        </div>
      )}
      {powerAnnounce && <div className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white text-center">{powerAnnounce}</div>}
      {fullSlotsMsg && <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-100 text-center">Slots full</div>}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {(['green', 'purple'] as Side[]).map((side) => {
          const available = powerSlots[side].length > 0;
          return (
            <div key={side} className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => setOpenBag((prev) => (prev === side ? null : side))}
                className={`action-btn text-[9px] ${side === 'green' ? 'text-[#8dffb8]' : 'text-[#d8aaff]'} ${available ? 'mai-baggy-available' : ''}`}
                style={available ? { boxShadow: '0 0 12px #00bfff, 0 0 28px #00bfff66', borderColor: '#00bfff' } : undefined}
                aria-label={`${side} Mai Baggy`}
              >
                🎒 Mai Baggy {available ? `(${powerSlots[side].length})` : ''}
              </button>
              {openBag === side && (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: SLOTS_PER_SIDE }).map((_, i) => {
                    const pu = powerSlots[side][i];
                    const def = pu ? POWER_UPS[pu] : null;
                    const Icon = def ? def.icon : null;
                    return (
                      <button
                        key={i}
                        disabled={!pu}
                        onClick={() => pu && onActivatePower(side, i)}
                        className={`flex h-12 w-12 items-center justify-center rounded-lg border ${pu ? 'border-white/20 bg-white/[0.06] hover:bg-white/[0.12]' : 'border-white/8 bg-white/[0.02]'} text-white/70`}
                        title={def ? `${def.name}: ${def.desc}` : 'Empty slot'}
                      >
                        {Icon ? <Icon size={24} /> : <span className="text-[9px] text-white/20">+</span>}
                      </button>
                    );
                  })}
                  <button onClick={() => onTryActivate(side)} className="action-btn gift-btn text-[9px]">
                    ⚡ ACTIVATE — 100
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="stage-controls">
        {showDemoActions && (
          <>
            <button onClick={() => onRematchVote?.('green')} className="action-btn">GREEN REMATCH</button>
            <button onClick={() => onRematchVote?.('purple')} className="action-btn">PURPLE REMATCH</button>
            <button onClick={onReset} className="action-btn hidden sm:inline-flex"><Zap size={14} className="text-[#ffe38a]" /> RESET DEMO</button>
          </>
        )}
        {canForfeit && <button onClick={onForfeit} className="action-btn">FORFEIT</button>}
      </div>
      <div className="arena-footnote"><ShieldCheck size={11} /> MAITROLL BATTLE ROOM <span className="text-white/15">•</span> PRODUCTION BATTLE <span className="text-white/15">•</span> LIVE DATA</div>
    </>
  );
}
