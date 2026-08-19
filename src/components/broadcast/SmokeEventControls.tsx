import React, { useState } from 'react';
import { Flame, Users, Gift, Music, Trophy, DollarSign, X, Play, Square } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SmokeEventControlsProps {
  streamId: string;
  smokeEvent: any;
  activeDrop: any;
  onStart: (seatCount: number) => Promise<void>;
  onEnd: () => Promise<void>;
  onStartDrop: (coinValue: number, duration: number, bills: number) => Promise<void>;
  onBuyRaffle: (raffleId: string, qty: number) => Promise<void>;
  onDrawRaffle: (raffleId: string) => Promise<void>;
  onRequestSong: (title: string, artist?: string) => Promise<void>;
  isAdmin: boolean;
}

export default function SmokeEventControls({
  streamId,
  smokeEvent,
  activeDrop,
  onStart,
  onEnd,
  onStartDrop,
  onBuyRaffle,
  onDrawRaffle,
  onRequestSong,
  isAdmin,
}: SmokeEventControlsProps) {
  const [showDropModal, setShowDropModal] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [seatCount, setSeatCount] = useState(6);
  const [dropCoins, setDropCoins] = useState(100);
  const [dropDuration, setDropDuration] = useState(10);
  const [dropBills, setDropBills] = useState(25);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');

  if (!smokeEvent) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => onStart(seatCount)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all shadow-lg"
        >
          <Flame size={18} />
          Start Smoke Event
        </button>
        <div className="flex items-center gap-1 bg-zinc-800/80 rounded-lg px-2 py-1">
          <Users size={14} className="text-zinc-400" />
          <input
            type="number"
            min={1}
            max={12}
            value={seatCount}
            onChange={(e) => setSeatCount(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
            className="w-12 bg-transparent text-white text-center text-sm outline-none"
          />
          <span className="text-xs text-zinc-400">seats</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active indicator */}
      <div className="flex items-center gap-1 px-3 py-1 bg-purple-600/20 border border-purple-500/30 rounded-lg">
        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
        <span className="text-xs font-bold text-purple-300">SMOKE EVENT</span>
      </div>

      {/* Seat count */}
      <div className="flex items-center gap-1 bg-zinc-800/80 rounded-lg px-2 py-1">
        <Users size={14} className="text-zinc-400" />
        <span className="text-sm text-white font-medium">{smokeEvent.seat_count} seats</span>
      </div>

      {/* Troll Drop button */}
      {smokeEvent.troll_drop_enabled && !activeDrop && (
        <button
          onClick={() => setShowDropModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 rounded-lg text-sm font-medium transition-all"
        >
          <DollarSign size={14} />
          Troll Drop
        </button>
      )}

      {activeDrop && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-600/30 border border-amber-500/50 rounded-lg animate-pulse">
          <DollarSign size={14} className="text-amber-300" />
          <span className="text-sm font-bold text-amber-200">DROP ACTIVE</span>
        </div>
      )}

      {/* Raffle */}
      {smokeEvent.raffle_enabled && (
        <button
          onClick={async () => {
            const { data } = await supabase.from('stream_raffles')
              .select('id')
              .eq('stream_id', streamId)
              .eq('status', 'active')
              .maybeSingle();
            if (data) onBuyRaffle(data.id, 1);
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm font-medium transition-all"
        >
          <Trophy size={14} />
          Raffle (500 coins)
        </button>
      )}

      {/* Song Queue */}
      {smokeEvent.song_queue_enabled && (
        <button
          onClick={() => setShowSongModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg text-sm font-medium transition-all"
        >
          <Music size={14} />
          Request Song (10 coins)
        </button>
      )}

      {/* End button */}
      {isAdmin && (
        <button
          onClick={onEnd}
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-all"
        >
          <Square size={14} />
          End Event
        </button>
      )}

      {/* Troll Drop Modal */}
      {showDropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowDropModal(false)}>
          <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                <DollarSign size={20} />
                Start Troll Drop
              </h3>
              <button onClick={() => setShowDropModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Coin Value per Bill</label>
                <input
                  type="number"
                  min={1}
                  value={dropCoins}
                  onChange={e => setDropCoins(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Duration</label>
                <div className="flex gap-2">
                  {[3, 10, 30].map(d => (
                    <button
                      key={d}
                      onClick={() => setDropDuration(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        dropDuration === d
                          ? 'bg-amber-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Number of Bills (max 500)</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={dropBills}
                  onChange={e => setDropBills(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={async () => {
                  await onStartDrop(dropCoins, dropDuration, dropBills);
                  setShowDropModal(false);
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:from-amber-400 hover:to-yellow-500 transition-all"
              >
                <Play size={18} />
                Start Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Song Request Modal */}
      {showSongModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowSongModal(false)}>
          <div className="bg-zinc-900 border border-blue-500/30 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-blue-300 flex items-center gap-2">
                <Music size={20} />
                Request Song
              </h3>
              <button onClick={() => setShowSongModal(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Song Title *</label>
                <input
                  type="text"
                  value={songTitle}
                  onChange={e => setSongTitle(e.target.value)}
                  placeholder="Enter song title..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Artist (optional)</label>
                <input
                  type="text"
                  value={songArtist}
                  onChange={e => setSongArtist(e.target.value)}
                  placeholder="Enter artist name..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>

              <p className="text-xs text-zinc-500">Cost: 10 Troll Coins (5 to DJ, 5 to admin pool)</p>

              <button
                onClick={async () => {
                  if (!songTitle.trim()) return;
                  await onRequestSong(songTitle, songArtist || undefined);
                  setSongTitle('');
                  setSongArtist('');
                  setShowSongModal(false);
                }}
                disabled={!songTitle.trim()}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:from-blue-400 hover:to-cyan-500 transition-all"
              >
                <Music size={18} />
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
