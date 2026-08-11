import { useState } from 'react';
import { useBroadcastViewerCap } from '@/hooks/useBroadcastViewerCap';
import {
  Users,
  Radio,
  ShieldOff,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BroadcastRestrictionControl() {
  const {
    viewerCapEnabled,
    viewerCapMax,
    viewerCapHours,
    startCapEnabled,
    startCapMax,
    seatCapEnabled,
    seatCapMax,
    allRestrictionsDisabled,
    loading,
    isAdmin,
    setViewerCapEnabled,
    setViewerCapMax,
    setStartCapEnabled,
    setStartCapMax,
    setSeatCapEnabled,
    setSeatCapMax,
    setAllRestrictionsDisabled,
  } = useBroadcastViewerCap();

  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (
    key: string,
    fn: (val: boolean) => Promise<boolean>,
    val: boolean,
  ) => {
    setUpdating(key);
    try {
      const success = await fn(val);
      if (!success) throw new Error('Failed');
      toast.success(
        val
          ? `${key} enabled`
          : `${key} disabled`,
      );
    } catch {
      toast.error(`Failed to update ${key}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleSetMax = async (
    key: string,
    fn: (val: number) => Promise<boolean>,
    val: number,
  ) => {
    setUpdating(key);
    try {
      const success = await fn(val);
      if (!success) throw new Error('Failed');
      toast.success(`${key} updated to ${val}`);
    } catch {
      toast.error(`Failed to update ${key}`);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-slate-900/50 rounded-xl border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-400">Loading broadcast restrictions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master Override: Remove All Restrictions */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border transition-all duration-300',
          allRestrictionsDisabled
            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
            : 'bg-slate-900/50 border-white/10',
        )}
      >
        <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2.5 rounded-full',
                allRestrictionsDisabled ? 'bg-emerald-500/20' : 'bg-slate-700/50',
              )}
            >
              <ShieldOff
                className={cn(
                  'w-5 h-5',
                  allRestrictionsDisabled ? 'text-emerald-400' : 'text-slate-400',
                )}
              />
            </div>
            <div>
              <h3
                className={cn(
                  'text-base font-bold',
                  allRestrictionsDisabled ? 'text-emerald-400' : 'text-white',
                )}
              >
                Remove All Restrictions
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {allRestrictionsDisabled
                  ? 'All restrictions removed. Everyone can broadcast and watch freely.'
                  : 'When enabled, all broadcast restrictions are removed (allow all to broadcast and watch).'}
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              handleToggle(
                'all-restrictions',
                setAllRestrictionsDisabled,
                !allRestrictionsDisabled,
              )
            }
            disabled={updating !== null}
            className={cn(
              'px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all',
              allRestrictionsDisabled
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300',
              updating === 'all-restrictions' && 'opacity-50 cursor-not-allowed',
            )}
          >
            {updating === 'all-restrictions' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {allRestrictionsDisabled ? 'Restore Restrictions' : 'Remove All'}
          </button>
        </div>
      </div>

      {/* Viewer Cap per Broadcast */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border transition-all duration-300',
          viewerCapEnabled
            ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]'
            : 'bg-slate-900/50 border-white/10',
        )}
      >
        <div className="p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2.5 rounded-full',
                  viewerCapEnabled ? 'bg-orange-500/20' : 'bg-slate-700/50',
                )}
              >
                <Users
                  className={cn(
                    'w-5 h-5',
                    viewerCapEnabled ? 'text-orange-400' : 'text-slate-400',
                  )}
                />
              </div>
              <div>
                <h3
                  className={cn(
                    'text-base font-bold',
                    viewerCapEnabled ? 'text-orange-400' : 'text-white',
                  )}
                >
                  Viewer Cap per Broadcast
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {viewerCapEnabled
                    ? `Limited to ${viewerCapMax} viewers per stream for first ${viewerCapHours}h.`
                    : 'Limit viewers per broadcast (e.g. max 10 viewers for first 24h).'}
                </p>
              </div>
            </div>

            <button
              onClick={() =>
                handleToggle(
                  'viewer-cap',
                  setViewerCapEnabled,
                  !viewerCapEnabled,
                )
              }
              disabled={updating !== null || allRestrictionsDisabled}
              className={cn(
                'px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all',
                viewerCapEnabled
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300',
                (updating === 'viewer-cap' || allRestrictionsDisabled) &&
                  'opacity-50 cursor-not-allowed',
              )}
            >
              {updating === 'viewer-cap' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {viewerCapEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>

          {viewerCapEnabled && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Max Viewers:
              </label>
              {[5, 10, 15, 20, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={() => handleSetMax('viewer-cap-max', setViewerCapMax, n)}
                  disabled={updating !== null}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    viewerCapMax === n
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Start Cap */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border transition-all duration-300',
          startCapEnabled
            ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
            : 'bg-slate-900/50 border-white/10',
        )}
      >
        <div className="p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2.5 rounded-full',
                  startCapEnabled ? 'bg-purple-500/20' : 'bg-slate-700/50',
                )}
              >
                <Radio
                  className={cn(
                    'w-5 h-5',
                    startCapEnabled ? 'text-purple-400' : 'text-slate-400',
                  )}
                />
              </div>
              <div>
                <h3
                  className={cn(
                    'text-base font-bold',
                    startCapEnabled ? 'text-purple-400' : 'text-white',
                  )}
                >
                  Broadcast Start Cap
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {startCapEnabled
                    ? `Only ${startCapMax} users can broadcast concurrently.`
                    : 'Restrict how many users can start broadcasting at the same time.'}
                </p>
              </div>
            </div>

            <button
              onClick={() =>
                handleToggle(
                  'start-cap',
                  setStartCapEnabled,
                  !startCapEnabled,
                )
              }
              disabled={updating !== null || allRestrictionsDisabled}
              className={cn(
                'px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all',
                startCapEnabled
                  ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300',
                (updating === 'start-cap' || allRestrictionsDisabled) &&
                  'opacity-50 cursor-not-allowed',
              )}
            >
              {updating === 'start-cap' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {startCapEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>

          {startCapEnabled && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Max Broadcasters:
              </label>
              {[2].map((n) => (
                <button
                  key={n}
                  onClick={() => handleSetMax('start-cap-max', setStartCapMax, n)}
                  disabled={updating !== null}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    startCapMax === n
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Seat Cap */}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border transition-all duration-300',
          seatCapEnabled
            ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
            : 'bg-slate-900/50 border-white/10',
        )}
      >
        <div className="p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2.5 rounded-full',
                  seatCapEnabled ? 'bg-cyan-500/20' : 'bg-slate-700/50',
                )}
              >
                <Users
                  className={cn(
                    'w-5 h-5',
                    seatCapEnabled ? 'text-cyan-400' : 'text-slate-400',
                  )}
                />
              </div>
              <div>
                <h3
                  className={cn(
                    'text-base font-bold',
                    seatCapEnabled ? 'text-cyan-400' : 'text-white',
                  )}
                >
                  Seat Cap per Broadcast
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {seatCapEnabled
                    ? `Limited to ${seatCapMax} total boxes per stream (temp 2-week limit).`
                    : 'Limit total boxes per broadcast (including broadcaster).'}
                </p>
              </div>
            </div>

            <button
              onClick={() =>
                handleToggle(
                  'seat-cap',
                  setSeatCapEnabled,
                  !seatCapEnabled,
                )
              }
              disabled={updating !== null || allRestrictionsDisabled}
              className={cn(
                'px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all',
                seatCapEnabled
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300',
                (updating === 'seat-cap' || allRestrictionsDisabled) &&
                  'opacity-50 cursor-not-allowed',
              )}
            >
              {updating === 'seat-cap' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {seatCapEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>

          {seatCapEnabled && (
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Max Boxes:
              </label>
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => handleSetMax('seat-cap-max', setSeatCapMax, n)}
                  disabled={updating !== null}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    seatCapMax === n
                      ? 'bg-cyan-500 text-white'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 text-xs text-slate-500 px-1">
        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          Admins are not counted in viewer/broadcaster caps. "Remove All Restrictions"
          overrides all other broadcast settings. Changes take effect immediately for
          new streams; existing streams are not affected until they restart.
        </span>
      </div>
    </div>
  );
}
