import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Clock, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  ScheduledFounderBroadcast,
  getUpcomingFounderBroadcast,
  formatScheduledWhen,
} from '@/services/founderProgram';

interface FounderScheduledBroadcastBannerProps {
  userId?: string | null;
  /** 'web' = full treatment, 'phone' = compact card. */
  variant?: 'web' | 'phone';
  /** Navigate target when tapped. Defaults to the profile's live stream. */
  onClick?: (broadcast: ScheduledFounderBroadcast) => void;
}

/**
 * 🔴 SCHEDULED BROADCAST banner.
 *
 * Shown above the profile picture on the Web Profile and the Phone Profile.
 * Only ever renders an UPCOMING, non-cancelled broadcast — cancelled, expired
 * and completed rows are excluded server-side and therefore never appear.
 */
export default function FounderScheduledBroadcastBanner({
  userId,
  variant = 'web',
  onClick,
}: FounderScheduledBroadcastBannerProps) {
  const navigate = useNavigate();
  const [broadcast, setBroadcast] = useState<ScheduledFounderBroadcast | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setBroadcast(null);
      return;
    }
    const next = await getUpcomingFounderBroadcast(userId);
    setBroadcast(next && next.status === 'scheduled' ? next : null);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: reflect schedule / cancel / complete without a reload.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`founder-sched-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'founder_scheduled_broadcasts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  if (!broadcast) return null;

  const when = formatScheduledWhen(broadcast.scheduled_for);
  const isPhone = variant === 'phone';

  const handleClick = () => {
    if (onClick) {
      onClick(broadcast);
      return;
    }
    if (broadcast.stream_id) {
      navigate(isPhone ? `/live/${broadcast.stream_id}` : `/watch/${broadcast.stream_id}`);
      return;
    }
    if (broadcast.user_id) {
      navigate(isPhone ? `/live/${broadcast.id}` : `/profile/id/${broadcast.user_id}`);
    }
  };

  if (isPhone) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="mb-3 w-full rounded-xl border border-red-500/40 bg-gradient-to-r from-red-950/70 via-amber-950/40 to-red-950/70 px-3 py-2.5 text-left active:scale-[0.99]"
      >
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600">
            <Radio size={10} className="animate-pulse text-white" />
          </span>
          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-red-300">
            Scheduled Broadcast
          </span>
        </span>

        <span className="mt-1 block truncate text-[12px] font-black text-white">
          {broadcast.title}
        </span>

        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-300">
          <Clock size={10} />
          {when}
        </span>

        <span className="mt-0.5 block truncate text-[9px] font-bold text-white/50">
          {broadcast.display_name || broadcast.username}
          {broadcast.duration_minutes ? ` · ${broadcast.duration_minutes} min` : ''}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mb-5 flex w-full items-center gap-4 rounded-3xl border border-red-500/40 bg-gradient-to-r from-red-950/70 via-amber-950/40 to-purple-950/60 px-5 py-4 text-left transition hover:border-red-400/60 hover:shadow-[0_0_30px_rgba(239,68,68,0.25)]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
        <Radio size={20} className="animate-pulse text-white" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-red-300">
            Scheduled Broadcast
          </span>
        </span>

        <span className="mt-1 block truncate text-lg font-black text-white">
          {broadcast.title}
        </span>

        <span className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-amber-300">
          <Clock size={14} />
          {when}
        </span>

        <span className="mt-0.5 block truncate text-xs font-semibold text-white/60">
          {broadcast.display_name || broadcast.username}
          {broadcast.category ? ` · ${broadcast.category}` : ''}
          {broadcast.duration_minutes ? ` · ${broadcast.duration_minutes} min` : ''}
        </span>

        {broadcast.description && (
          <span className="mt-1 block line-clamp-2 text-xs text-white/45">
            {broadcast.description}
          </span>
        )}
      </span>
    </button>
  );
}

/** Small dismissible variant used on the Founder's own hub. */
export function FounderUpcomingBroadcastChip({
  broadcast,
  onDismiss,
}: {
  broadcast: ScheduledFounderBroadcast;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2">
      <Radio size={14} className="shrink-0 animate-pulse text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-white">{broadcast.title}</p>
        <p className="text-[10px] font-semibold text-amber-300">
          {formatScheduledWhen(broadcast.scheduled_for)}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-1 text-white/40 hover:text-white"
          aria-label="Dismiss"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}