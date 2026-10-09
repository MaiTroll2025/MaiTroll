import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Share2, Zap, Shield, ShieldOff, Loader2, Radio, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShareAThonEvent {
  id: string;
  title: string;
  status: 'inactive' | 'waiting' | 'active' | 'completed';
  goal_live_broadcasters: number;
  current_live_broadcasters: number;
  restrict_new_broadcasters: boolean;
  peak_simultaneous_broadcasters: number;
  total_shares_submitted: number;
  bonus_amount: number;
  event_start_at?: string | null;
  event_end_at?: string | null;
}

export default function ShareAThonControl() {
  const { profile } = useAuthStore();
  const [event, setEvent] = useState<ShareAThonEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [liveCount, setLiveCount] = useState(0);

  const _isAdmin = profile?.role === 'admin' || profile?.is_admin === true;

  useEffect(() => {
    fetchEvent();
    const channel = supabase
      .channel('shareathon_control_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shareathon_events'
      }, () => {
        fetchEvent();
      })
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('shareathon_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setEvent(data as ShareAThonEvent);
        setLiveCount((data as ShareAThonEvent).current_live_broadcasters);
      }
    } catch (err) {
      console.error('Error fetching Share-A-Thon event:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateEvent = async (updates: Partial<ShareAThonEvent>) => {
    if (!event) return false;
    setUpdating('update');
    try {
      const { error } = await supabase
        .from('shareathon_events')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', event.id);

      if (error) throw error;
      await fetchEvent();
      return true;
    } catch (err: any) {
      console.error('Error updating Share-A-Thon:', err);
      toast.error('Failed to update Share-A-Thon');
      return false;
    } finally {
      setUpdating(null);
    }
  };

  const handleStartEvent = async () => {
    setUpdating('start');
    try {
      const success = await updateEvent({
        status: 'waiting',
        event_start_at: new Date().toISOString(),
        restrict_new_broadcasters: true
      });
      if (success) {
        toast.success('Share-A-Thon Weekend started! New broadcasters restricted.');
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleEndEvent = async () => {
    if (!window.confirm('End Share-A-Thon Weekend? This will mark the event as completed and lift broadcaster restrictions.')) return;
    setUpdating('end');
    try {
      const success = await updateEvent({
        status: 'completed',
        event_end_at: new Date().toISOString(),
        restrict_new_broadcasters: false
      });
      if (success) {
        toast.success('Share-A-Thon Weekend ended. Broadcaster restrictions lifted.');
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleRestrictions = async () => {
    if (!event) return;
    setUpdating('restrict');
    try {
      const success = await updateEvent({
        restrict_new_broadcasters: !event.restrict_new_broadcasters
      });
      if (success) {
        toast.success(
          !event.restrict_new_broadcasters
            ? 'New users CANNOT broadcast during event'
            : 'All users can broadcast normally'
        );
      }
    } finally {
      setUpdating(null);
    }
  };

  const handleUpdateLiveCount = async () => {
    if (!event || liveCount < 0) return;
    setUpdating('count');
    try {
      const updates: any = {
        current_live_broadcasters: liveCount,
        updated_at: new Date().toISOString()
      };

      if (liveCount > (event.peak_simultaneous_broadcasters || 0)) {
        updates.peak_simultaneous_broadcasters = liveCount;
      }

      if (liveCount >= event.goal_live_broadcasters && event.status === 'waiting') {
        updates.status = 'active';
      }

      const { error } = await supabase
        .from('shareathon_events')
        .update(updates)
        .eq('id', event.id);

      if (error) throw error;
      await fetchEvent();
      toast.success('Live broadcaster count updated');
    } catch (err: any) {
      console.error('Error updating count:', err);
      toast.error('Failed to update count');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-slate-900/50 rounded-xl border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-400">Loading Share-A-Thon...</span>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-slate-900/50 rounded-xl border border-white/10 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Share2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">Share-A-Thon Weekend</h3>
        </div>
        <p className="text-sm text-gray-400 mb-3">No event configured. Run the database migration first.</p>
      </div>
    );
  }

  const progressPercent = Math.min(100, (event.current_live_broadcasters / event.goal_live_broadcasters) * 100);

  return (
    <div className="space-y-4">
      {/* Main Share-A-Thon Control */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border transition-all duration-300',
        event.status === 'active'
          ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
          : event.status === 'waiting'
          ? 'bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)]'
          : event.status === 'completed'
          ? 'bg-purple-500/10 border-purple-500/50'
          : 'bg-slate-900/50 border-white/10'
      )}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2.5 rounded-full',
                event.status === 'active' ? 'bg-cyan-500/20' :
                event.status === 'waiting' ? 'bg-yellow-500/20' :
                event.status === 'completed' ? 'bg-purple-500/20' : 'bg-slate-700/50'
              )}>
                <Share2 className={cn(
                  'w-5 h-5',
                  event.status === 'active' ? 'text-cyan-400' :
                  event.status === 'waiting' ? 'text-yellow-400' :
                  event.status === 'completed' ? 'text-purple-400' : 'text-slate-400'
                )} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Share-A-Thon Weekend</h3>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    event.status === 'active' ? 'bg-cyan-400 animate-pulse' :
                    event.status === 'waiting' ? 'bg-yellow-400 animate-pulse' :
                    event.status === 'completed' ? 'bg-purple-400' : 'bg-gray-400'
                  )} />
                  <span className="text-xs text-gray-400">
                    {event.status === 'active' ? 'ACTIVE' :
                     event.status === 'waiting' ? 'WAITING FOR BROADCASTERS' :
                     event.status === 'completed' ? 'COMPLETED' : 'INACTIVE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {event.status === 'inactive' && (
                <button
                  onClick={handleStartEvent}
                  disabled={updating === 'start'}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updating === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Start Event
                </button>
              )}
              {(event.status === 'active' || event.status === 'waiting') && (
                <button
                  onClick={handleEndEvent}
                  disabled={updating === 'end'}
                  className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-400 text-sm font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updating === 'end' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  End Event
                </button>
              )}
            </div>
          </div>

          {/* Progress Tracker */}
          {event.status !== 'inactive' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  Live Eligible Broadcasters
                </span>
                <span className="text-sm font-bold">
                  <span className={event.status === 'active' ? 'text-cyan-400' : 'text-yellow-400'}>
                    {event.current_live_broadcasters}
                  </span>
                  <span className="text-gray-500"> / {event.goal_live_broadcasters}</span>
                </span>
              </div>
              <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000 ease-out',
                    event.status === 'active'
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500'
                      : 'bg-gradient-to-r from-yellow-500 to-amber-500'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {event.status === 'waiting' && (
                <p className="text-xs text-yellow-400/70 mt-1">
                  Need {event.goal_live_broadcasters - event.current_live_broadcasters} more to activate
                </p>
              )}
            </div>
          )}

          {/* Quick Stats */}
          {event.status !== 'inactive' && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <div className="text-xs text-gray-500">Peak Live</div>
                <div className="text-sm font-bold text-cyan-400">{event.peak_simultaneous_broadcasters}</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <div className="text-xs text-gray-500">Shares</div>
                <div className="text-sm font-bold text-purple-400">{event.total_shares_submitted}</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20 text-center">
                <div className="text-xs text-gray-500">Bonus</div>
                <div className="text-sm font-bold text-green-400">${event.bonus_amount}</div>
              </div>
            </div>
          )}

          {/* Live Count Adjuster */}
          {event.status !== 'inactive' && event.status !== 'completed' && (
            <div className="flex items-center gap-2 mb-4">
              <label className="text-xs text-gray-400 flex-shrink-0">Set Live Count:</label>
              <input
                type="number"
                min="0"
                max="999"
                value={liveCount}
                onChange={(e) => setLiveCount(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1.5 bg-black/30 border border-white/10 rounded-lg text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
              <button
                onClick={handleUpdateLiveCount}
                disabled={updating === 'count'}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/30 hover:bg-cyan-600/30 text-cyan-400 text-xs font-medium transition-all disabled:opacity-50"
              >
                {updating === 'count' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update'}
              </button>
            </div>
          )}

          {/* Restriction Toggle */}
          <div className={cn(
            'p-3 rounded-lg border transition-all',
            event.restrict_new_broadcasters
              ? 'bg-orange-500/10 border-orange-500/30'
              : 'bg-black/20 border-white/5'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {event.restrict_new_broadcasters ? (
                  <ShieldOff className="w-4 h-4 text-orange-400" />
                ) : (
                  <Shield className="w-4 h-4 text-green-400" />
                )}
                <div>
                  <div className="text-sm font-medium text-white">New Broadcaster Restriction</div>
                  <div className="text-xs text-gray-400">
                    {event.restrict_new_broadcasters
                      ? 'New users CANNOT broadcast'
                      : 'All users can broadcast'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleToggleRestrictions}
                disabled={updating === 'restrict'}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50',
                  event.restrict_new_broadcasters
                    ? 'bg-orange-600 hover:bg-orange-500 text-white'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300'
                )}
              >
                {updating === 'restrict' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : event.restrict_new_broadcasters ? (
                  'ON'
                ) : (
                  'OFF'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
