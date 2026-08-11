import React from 'react';
import { useGifterLeaderboard, useFanCrownStatus } from '@/hooks/useGifterRecognition';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Crown, Medal, Star, Users, TrendingUp } from 'lucide-react';

export function GifterRecognitionBadge() {
  const { profile } = useAuthStore();
  const { data: leaderboard, isLoading } = useGifterLeaderboard('weekly', 10);
  const { data: crownStatus } = useFanCrownStatus(profile?.id);

  if (isLoading) {
    return (
      <Card className="bg-[#0A0814] border-white/10">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="h-8 bg-white/10 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const userRank = leaderboard?.find((entry) => entry.user_id === profile?.id);
  const hasCrown = crownStatus && crownStatus.length > 0;
  const totalCrowns = crownStatus?.reduce((sum, c) => sum + 1, 0) ?? 0;

  return (
    <Card className="bg-[#0A0814] border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-400" />
          Gifter Recognition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasCrown && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Crown className="h-5 w-5 text-amber-400" />
            <div>
              <div className="text-xs font-bold text-amber-400">Fan Crown Holder</div>
              <div className="text-[10px] text-amber-300/70">
                {totalCrowns} crown{totalCrowns !== 1 ? 's' : ''} earned
              </div>
            </div>
          </div>
        )}

        {userRank && (
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
            <div className="flex items-center gap-2">
              {userRank.rank === 1 ? (
                <Medal className="h-4 w-4 text-yellow-400" />
              ) : userRank.rank === 2 ? (
                <Medal className="h-4 w-4 text-slate-300" />
              ) : userRank.rank === 3 ? (
                <Medal className="h-4 w-4 text-amber-600" />
              ) : (
                <span className="text-xs font-bold text-slate-500 w-4 text-center">
                  #{userRank.rank}
                </span>
              )}
              <div>
                <div className="text-xs font-bold text-white">
                  #{userRank.rank} this week
                </div>
                <div className="text-[10px] text-slate-400">
                  {userRank.total_coins_spent.toLocaleString()} coins spent
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-cyan-400">
                {userRank.total_gifts} gifts
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <Users className="h-3 w-3" />
          <span>Top 100 gifter leaderboard</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function GifterLeaderboard({ limit = 10 }: { limit?: number }) {
  const { data: leaderboard, isLoading } = useGifterLeaderboard('weekly', limit);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-2">
            <div className="h-4 bg-white/10 rounded w-8" />
            <div className="h-4 bg-white/10 rounded flex-1" />
            <div className="h-4 bg-white/10 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-xs">
        No gifter data available
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {leaderboard.map((entry) => (
        <div
          key={entry.user_id}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <span className="text-xs font-bold text-slate-500 w-6 text-center">
            {entry.rank}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {entry.username}
            </div>
            <div className="text-[10px] text-slate-400">
              {entry.total_gifts} gifts · {entry.total_coins_spent.toLocaleString()} coins
            </div>
          </div>
          <div className="text-xs font-bold text-cyan-400">
            {entry.total_coins_spent.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}