import React from 'react';
import { useWeeklyCashback } from '@/hooks/useWeeklyCashback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export function WeeklyCashbackCard() {
  const { data: statuses, isLoading, error } = useWeeklyCashback();

  if (isLoading) {
    return (
      <Card className="bg-[#0A0814] border-white/10">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="h-8 bg-white/10 rounded w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#0A0814] border-white/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load cashback status</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = statuses?.[0];

  if (!status) {
    return (
      <Card className="bg-[#0A0814] border-white/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="h-4 w-4" />
            <span className="text-sm">No cashback period data available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#0A0814] border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
          <Coins className="h-4 w-4 text-yellow-400" />
          Weekly Gift Cashback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Period</span>
          <span className="text-white font-medium">
            {new Date(status.period_start).toLocaleDateString()} -{' '}
            {new Date(status.period_end).toLocaleDateString()}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-white/5">
            <div className="text-lg font-bold text-white">{status.total_gifts}</div>
            <div className="text-[10px] text-slate-400">Gifts</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/5">
            <div className="text-lg font-bold text-yellow-400">{status.total_coins_spent.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">Coins Spent</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/5">
            <div className="text-lg font-bold text-green-400">{status.total_coins_back.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">Creator Share</div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <span className="text-xs text-slate-400">Cashback (2.5%)</span>
          <span className="text-sm font-bold text-cyan-400">
            {status.cashback_amount.toLocaleString()} coins
          </span>
        </div>

        {status.is_paid ? (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            <span>Paid out on {new Date(status.paid_at!).toLocaleDateString()}</span>
          </div>
        ) : status.qualifies ? (
          <div className="flex items-center gap-2 text-xs text-yellow-400">
            <Clock className="h-3 w-3" />
            <span>Awaiting Friday payout</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AlertCircle className="h-3 w-3" />
            <span>
              Qualify with {status.total_gifts < 3 ? `${3 - status.total_gifts} more gift(s)` : ''}
              {status.total_coins_spent < 100 ? ` and ${100 - status.total_coins_spent} more coins` : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}