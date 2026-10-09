import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Clock, Loader2, Rainbow, Sparkles, Trophy, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrideChallenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  xp_reward: number;
  target_value: number;
  progress_type: string;
  keyword_triggers: string[];
  icon: string;
  sort_order: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
}

interface PrideUserProgress {
  id: string;
  challenge_id: string;
  progress_value: number;
  completion_percentage: number;
  is_completed: boolean;
  completed_at: string | null;
}

interface PrideChallengeWithProgress extends PrideChallenge {
  progress_value: number;
  completion_percentage: number;
  is_completed: boolean;
  completed_at: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPrideMonth(): boolean {
  const now = new Date();
  return now.getMonth() === 5; // June (0-indexed)
}

function getPrideGradient(): string {
  return 'from-red-500 via-orange-400 via-yellow-400 via-green-400 via-blue-500 to-purple-600';
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'chat':
      return 'border-pink-400/40 bg-pink-500/10 text-pink-200';
    case 'engagement':
      return 'border-purple-400/40 bg-purple-500/10 text-purple-200';
    case 'social':
      return 'border-blue-400/40 bg-blue-500/10 text-blue-200';
    default:
      return 'border-amber-400/40 bg-amber-500/10 text-amber-200';
  }
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ percentage, isCompleted }: { percentage: number; isCompleted: boolean }) {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-700 ease-out',
          isCompleted
            ? 'bg-gradient-to-r from-green-400 to-emerald-400'
            : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500'
        )}
        style={{ width: `${clamped}%` }}
      />
      {isCompleted && (
        <div className="absolute inset-0 animate-pulse rounded-full bg-white/20" />
      )}
    </div>
  );
}

// ─── Challenge Card ──────────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  onClaim: _onClaim,
}: {
  challenge: PrideChallengeWithProgress;
  onClaim?: () => void;
}) {
  const { is_completed, completion_percentage, progress_value, target_value } = challenge;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border transition-all duration-300',
        is_completed
          ? 'border-green-400/30 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]'
          : 'border-white/10 bg-white/[0.03] hover:border-pink-400/25 hover:bg-white/[0.06]'
      )}
    >
      {/* Rainbow top accent */}
      <div className={cn('h-1 w-full bg-gradient-to-r', getPrideGradient())} />

      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-xl',
                is_completed
                  ? 'border-green-400/30 bg-green-500/15'
                  : 'border-white/10 bg-white/[0.06]'
              )}
            >
              {challenge.icon}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-white">{challenge.title}</h3>
              <p className="mt-0.5 line-clamp-2 text-xs text-white/45">{challenge.description}</p>
            </div>
          </div>

          <div
            className={cn(
              'shrink-0 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider',
              getCategoryColor(challenge.category)
            )}
          >
            {challenge.category}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-white/40">
              {progress_value} / {target_value}
            </span>
            <span className={cn('font-bold', is_completed ? 'text-green-400' : 'text-white/60')}>
              {Math.round(completion_percentage)}%
            </span>
          </div>
          <ProgressBar percentage={completion_percentage} isCompleted={is_completed} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300/80">
            <Zap className="h-3.5 w-3.5" />
            +{challenge.xp_reward} XP
          </div>

          {is_completed ? (
            <span className="flex items-center gap-1 text-xs font-bold text-green-400">
              <Trophy className="h-3.5 w-3.5" />
              Completed!
            </span>
          ) : (
            <div className="flex items-center gap-1 text-xs text-white/30">
              <Clock className="h-3 w-3" />
              In progress
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface PrideChallengesProps {
  compact?: boolean;
  className?: string;
}

export default function PrideChallenges({ compact = false, className }: PrideChallengesProps) {
  const { user, profile: _profile } = useAuthStore();
  const [challenges, setChallenges] = useState<PrideChallengeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const fetchChallenges = useCallback(async () => {
    try {
      if (!isPrideMonth()) {
        setChallenges([]);
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();

      const { data: challengeData, error: challengeError } = await supabase
        .from('pride_challenges')
        .select('*')
        .eq('is_active', true)
        .gt('week_number', 0)
        .lte('starts_at', now)
        .order('sort_order', { ascending: true });

      if (challengeError) throw challengeError;

      if (!user?.id) {
        // Not logged in — show challenges without progress
        const noProgress = (challengeData || []).map((c) => ({
          ...c,
          progress_value: 0,
          completion_percentage: 0,
          is_completed: false,
          completed_at: null,
        }));
        setChallenges(noProgress);
        setLoading(false);
        return;
      }

      // Fetch user progress
      const { data: progressData } = await supabase
        .from('pride_user_progress')
        .select('*')
        .eq('user_id', user.id);

      const progressMap = new Map<string, PrideUserProgress>();
      (progressData || []).forEach((p) => {
        progressMap.set(p.challenge_id, p);
      });

      const merged: PrideChallengeWithProgress[] = (challengeData || []).map((c) => {
        const p = progressMap.get(c.id);
        return {
          ...c,
          progress_value: p?.progress_value || 0,
          completion_percentage: p?.completion_percentage || 0,
          is_completed: p?.is_completed || false,
          completed_at: p?.completed_at || null,
        };
      });

      setChallenges(merged);
      setTotalXpEarned(
        merged.filter((c) => c.is_completed).reduce((sum, c) => sum + c.xp_reward, 0)
      );
      setCompletedCount(merged.filter((c) => c.is_completed).length);
    } catch (err) {
      console.error('[PrideChallenges] Failed to fetch challenges:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Subscribe to realtime progress updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`pride-progress-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pride_user_progress',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchChallenges();
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, fetchChallenges]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-pink-400/50" />
      </div>
    );
  }

  if (challenges.length === 0) {
    return null;
  }

  const displayChallenges = compact ? challenges.slice(0, 3) : challenges;

  return (
    <div className={cn('relative overflow-hidden rounded-3xl', className)}>
      {/* Rainbow border top */}
      <div className={cn('h-1.5 w-full bg-gradient-to-r', getPrideGradient())} />

      <div className="border border-white/10 border-t-0 rounded-b-3xl bg-slate-950/80 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-400/20">
              <Rainbow className="h-5 w-5 text-pink-300" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                Pride{' '}
                <span
                  className={cn(
                    'bg-gradient-to-r bg-clip-text text-transparent',
                    getPrideGradient()
                  )}
                >
                  Challenges
                </span>
              </h2>
              <p className="text-[11px] text-white/40">
                June 2026 · Earn XP by spreading love & pride
              </p>
            </div>
          </div>

          {!compact && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Completed
                </p>
                <p className="text-sm font-black text-white">
                  {completedCount}/{challenges.length}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  XP Earned
                </p>
                <p className="text-sm font-black text-amber-300">+{totalXpEarned}</p>
              </div>
            </div>
          )}
        </div>

        {/* Challenge Grid */}
        <div className={cn('grid gap-3 p-4', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
          {displayChallenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>

        {/* Compact mode: show all link */}
        {compact && challenges.length > 3 && (
          <div className="border-t border-white/5 px-5 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.04] py-2.5 text-xs font-bold text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              View All {challenges.length} Challenges
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Keyword hints */}
        {!compact && (
          <div className="border-t border-white/5 px-5 py-3">
            <div className="flex items-center gap-2 text-[11px] text-white/30">
              <Sparkles className="h-3.5 w-3.5 text-pink-400/50" />
              <span>
                Send messages with keywords like{' '}
                <span className="font-semibold text-pink-300/60">pride</span>,{' '}
                <span className="font-semibold text-orange-300/60">love</span>,{' '}
                <span className="font-semibold text-yellow-300/60">rainbow</span>,{' '}
                <span className="font-semibold text-green-300/60">ally</span>,{' '}
                <span className="font-semibold text-blue-300/60">equality</span>,{' '}
                <span className="font-semibold text-purple-300/60">celebrate</span>{' '}
                to earn bonus XP!
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
