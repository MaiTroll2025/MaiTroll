import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { getStudentCoinRewards } from '@/services/academyService';
import type { AcademyCoinReward } from '@/types/academy';
import { Coins, ChevronRight } from 'lucide-react';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function AcademyCoinsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [rewards, setRewards] = useState<AcademyCoinReward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const items = await getStudentCoinRewards(user.id);
        setRewards(items);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const totalCoins = rewards.reduce((sum, reward) => sum + reward.coins_awarded, 0);

  if (!user) {
    return <div className="mx-auto max-w-3xl p-4 text-center text-slate-300">Please sign in to view Academy coins.</div>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <section className={`${glass} rounded-3xl p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Coins className="h-8 w-8 text-amber-400" />
              <div>
                <h1 className="text-2xl font-black text-white">Academy Coins</h1>
                <p className="text-sm text-slate-400">Track earned rewards and recent Academy coin activity.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-slate-300">
            Total Earned: {totalCoins.toLocaleString()}
          </div>
        </div>
      </section>

      {rewards.length === 0 ? (
        <div className={`${glass} rounded-3xl p-8 text-center text-slate-400`}>
          <p className="text-sm">No Academy rewards recorded yet. Complete courses and activities to earn coins.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rewards.map((reward) => (
            <div key={reward.id} className={`${glass} rounded-3xl p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{reward.reward_reason}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(reward.created_at).toLocaleDateString()}</p>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                  +{reward.coins_awarded}
                </div>
              </div>
              {(reward as any).course?.name && (
                <p className="mt-3 text-xs text-slate-400">Course: {(reward as any).course.name}</p>
              )}
              <button onClick={() => navigate('/academy')} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10">
                <ChevronRight className="h-3.5 w-3.5" /> Back to Academy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
