/**
 * SmokeEventBroadcastWrapper
 * 
 * Wraps BroadcastPage to add Smoke Event Mode controls.
 * This is a non-invasive way to add smoke event features without modifying
 * the core BroadcastPage file (7000+ lines).
 * 
 * Usage: Replace <BroadcastPage /> with <SmokeEventBroadcastWrapper />
 * in the broadcast route.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { X, DollarSign, Trophy, Music } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_GUEST_SEATS } from '../../config/broadcastCategories';

// Import the original BroadcastPage
import { BroadcastPage } from '../../pages/broadcast/BroadcastPage';

// Types
interface SmokeEvent {
  id: string;
  stream_id: string;
  is_active: boolean;
  seat_count: number;
  raffle_enabled: boolean;
  troll_drop_enabled: boolean;
  song_queue_enabled: boolean;
}

export function SmokeEventBroadcastWrapper() {
  const { user: _user, profile } = useAuthStore();
  const [smokeEvent, setSmokeEvent] = useState<SmokeEvent | null>(null);
  const [showDropModal, setShowDropModal] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [_seatCount, _setSeatCount] = useState(MAX_GUEST_SEATS);

  // Check if user is admin or stream host
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true || profile?.role === 'owner';

  // Fetch smoke event state on mount
  useEffect(() => {
    // Check sessionStorage flag set by SetupPage
    const smokeEnabled = sessionStorage.getItem('tc_smoke_event_enabled') === 'true';
    if (smokeEnabled) {
      setSmokeEvent({ id: 'pending', stream_id: '', is_active: true, seat_count: MAX_GUEST_SEATS, raffle_enabled: true, troll_drop_enabled: true, song_queue_enabled: true });
    }
  }, []);

  const handleStartDrop = useCallback(async () => {
    if (!smokeEvent) return;
    setShowDropModal(true);
  }, [smokeEvent]);

  const handleEndSmokeEvent = useCallback(async () => {
    if (!smokeEvent) return;
    try {
      await supabase.rpc('end_smoke_event', { p_stream_id: smokeEvent.stream_id });
      setSmokeEvent(null);
      toast.success('Smoke Event ended');
    } catch (_err) {
      toast.error('Failed to end event');
    }
  }, [smokeEvent]);

  // Only render if admin AND smoke event is active
  if (!isAdmin || !smokeEvent) {
    return <BroadcastPage />;
  }

  return (
    <div className="relative w-full h-full">
      {/* Original BroadcastPage */}
      <BroadcastPage />

      {/* Smoke Event Controls - Bottom of page */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2">
        {/* Event indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 border border-purple-500/30 rounded-xl backdrop-blur">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
          <span className="text-sm font-bold text-purple-300">SMOKE EVENT</span>
        </div>

        {/* Troll Drop */}
        {smokeEvent.troll_drop_enabled && (
          <button
            onClick={handleStartDrop}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 rounded-xl text-sm font-medium transition-all"
          >
            <DollarSign size={14} />
            Troll Drop
          </button>
        )}

        {/* Raffle */}
        {smokeEvent.raffle_enabled && (
          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-medium transition-all"
          >
            <Trophy size={14} />
            Raffle
          </button>
        )}

        {/* Song Queue */}
        {smokeEvent.song_queue_enabled && (
          <button
            onClick={() => setShowSongModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-sm font-medium transition-all"
          >
            <Music size={14} />
            Song Request
          </button>
        )}

        {/* End Event */}
        <button
          onClick={handleEndSmokeEvent}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-xl text-sm font-medium transition-all"
        >
          <X size={14} />
          End
        </button>
      </div>

      {/* Troll Drop Modal */}
      {showDropModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowDropModal(false)}>
          <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-amber-300 mb-4 flex items-center gap-2">
              <DollarSign size={20} />
              Start Troll Drop
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Coin Value per Bill</label>
                <input type="number" min={1} defaultValue={100} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Duration</label>
                <div className="flex gap-2">
                  {[3, 10, 30].map(d => (
                    <button key={d} className="flex-1 py-2 rounded-lg bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors">{d}s</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Number of Bills (max 500)</label>
                <input type="number" min={1} max={500} defaultValue={25} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-amber-500" />
              </div>
              <button className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-bold rounded-xl">
                Start Drop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Song Request Modal */}
      {showSongModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowSongModal(false)}>
          <div className="bg-zinc-900 border border-blue-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-blue-300 mb-4 flex items-center gap-2">
              <Music size={20} />
              Request Song
            </h3>
            <div className="space-y-4">
              <input type="text" placeholder="Song title *" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500" />
              <input type="text" placeholder="Artist (optional)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500" />
              <p className="text-xs text-zinc-500">Cost: 10 Troll Coins (5 to DJ, 5 to admin pool)</p>
              <button className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold rounded-xl">
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmokeEventBroadcastWrapper;
