import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  Loader,
  History,
  Shield,
} from 'lucide-react';
import { maiBusinessApi, type CreditAccount, type CreditTransaction } from '@/features/mai-business/lib/maiBusinessApi';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

const creditFactors = [
  { name: 'Business Plan', score: 25, description: 'Complete your business plan for maximum score impact' },
  { name: 'Payment History', score: 20, description: 'On-time payments on marketplace purchases' },
  { name: 'Business Stage', score: 15, description: 'Advanced stages earn more credit' },
  { name: 'Education Progress', score: 15, description: 'Complete modules to boost score' },
  { name: 'Funding Applications', score: 10, description: 'Well-researched applications' },
  { name: 'Community Engagement', score: 10, description: 'Participate in college collaboration' },
  { name: 'Recognition', score: 5, description: 'Earn recognition from peers' },
];

export default function MaiBusinessCredit() {
  const navigate = useNavigate();
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [account, txns] = await Promise.all([
          maiBusinessApi.getCreditAccount(),
          maiBusinessApi.getCreditTransactions(),
        ]);
        setCreditAccount(account);
        setTransactions(txns);
      } catch (err) {
        console.error('Error fetching credit data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      <div className="container mx-auto px-4 pt-8">
        <div className="mb-8">
          <button onClick={() => navigate('/mai-business/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4">
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-black mb-1">
            MAI Business Credit
            <span className="block text-zinc-400 text-xl font-medium mt-1">Credit Score & Account</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className={`p-6 rounded-2xl ${glass} lg:col-span-1`}>
            <div className="text-center">
              <p className="text-zinc-400 text-sm font-medium mb-2">Credit Score</p>
              <div className="text-5xl font-black text-cyan-400 mb-2">
                {creditAccount?.credit_score || 0}
              </div>
              <div className="text-zinc-500 text-sm">
                Limit: ${Number(creditAccount?.credit_limit || 0).toLocaleString()}
              </div>
              <div className="text-zinc-500 text-sm">
                Used: ${Number(creditAccount?.credit_used || 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className={`p-6 rounded-2xl ${glass} lg:col-span-2`}>
            <h2 className="text-xl font-bold text-white mb-4">Credit Summary</h2>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <TrendingUp size={20} className="mx-auto text-emerald-400 mb-1" />
                <div className="text-sm text-zinc-500">Available</div>
                <div className="text-xl font-bold text-white">
                  ${(Number(creditAccount?.credit_limit || 0) - Number(creditAccount?.credit_used || 0)).toLocaleString()}
                </div>
              </div>
              <div>
                <CreditCard size={20} className="mx-auto text-cyan-400 mb-1" />
                <div className="text-sm text-zinc-500">Total Limit</div>
                <div className="text-xl font-bold text-white">
                  ${Number(creditAccount?.credit_limit || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <History size={20} className="mx-auto text-purple-400 mb-1" />
                <div className="text-sm text-zinc-500">Transactions</div>
                <div className="text-xl font-bold text-white">{transactions.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <div className={`p-6 rounded-2xl ${glass}`}>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <History size={16} /> Transaction History
              </h2>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map((txn) => (
                    <div key={txn.id} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-zinc-700">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          txn.amount >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                        }`}>
                          {txn.amount >= 0 ? (
                            <TrendingUp size={16} className="text-emerald-400" />
                          ) : (
                            <TrendingDown size={16} className="text-rose-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-white">{txn.description || txn.type}</div>
                          <div className="text-sm text-zinc-500">
                            {new Date(txn.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className={`text-right ${txn.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {txn.amount >= 0 ? '+$' : '-$'}
                        {Math.abs(Number(txn.amount)).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">
                  <History size={32} className="mx-auto mb-2 opacity-30" />
                  <p>No transactions yet. Start using your credit to build history.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className={`p-6 rounded-2xl ${glass} mb-6`}>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield size={16} /> How Credit Works
              </h2>
              <div className="space-y-3">
                {creditFactors.map((factor) => (
                  <div key={factor.name} className="p-3 bg-zinc-800/20 rounded-lg">
                    <div className="flex justify-between mb-1">
                      <span className="text-white font-medium">{factor.name}</span>
                      <span className="text-cyan-400">{factor.score}%</span>
                    </div>
                    <p className="text-xs text-zinc-500">{factor.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-6 rounded-2xl ${glass}`}>
              <h2 className="text-xl font-bold text-white mb-4">Improve Your Score</h2>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">•</span>
                  Complete your business profile — unlocks +30 points
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">•</span>
                  Finish education modules — +20 points per module
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">•</span>
                  Apply for funding — shows active entrepreneurship
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">•</span>
                  Make on-time payments — builds payment history
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
