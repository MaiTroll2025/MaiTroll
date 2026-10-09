import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAgencyTransactions } from '@/hooks/useAdminAgency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Coins, Search, Loader2, Plus, Minus, History, ArrowRight } from 'lucide-react';

interface UserSearchResult {
  id: string;
  username: string;
  avatar_url?: string | null;
}

export default function AgencyPointAdjustmentPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [pointsInput, setPointsInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);

  const { transactions, loading: txLoading, fetchTransactions, adjustPoints } = useAdminAgencyTransactions();

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `%${searchQuery.trim()}%`)
          .limit(10);
        if (!error && data) {
          setSearchResults(data);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedUser) {
      fetchTransactions(selectedUser.id);
    }
  }, [selectedUser, fetchTransactions]);

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.username);
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }
    const points = parseInt(pointsInput, 10);
    if (isNaN(points) || points === 0) {
      toast.error('Please enter a valid non-zero points value');
      return;
    }
    if (!reasonInput.trim()) {
      toast.error('Please provide a reason for the adjustment');
      return;
    }

    setSubmitting(true);
    try {
      const result = await adjustPoints(selectedUser.id, points, reasonInput.trim());
      toast.success(
        `${points > 0 ? 'Added' : 'Deducted'} ${Math.abs(points)} points. New total: ${result.new_total.toLocaleString()}`
      );
      setPointsInput('');
      setReasonInput('');
    } catch (_err) {
      toast.error('Failed to adjust points');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-amber-500/20 p-2.5">
          <Coins className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Point Adjustment</h2>
          <p className="text-sm text-slate-400">Add or deduct points from agency members</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-2xl shadow-black/20">
        <div className="space-y-4">
          <div>
            <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Search User</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedUser && e.target.value !== selectedUser.username) {
                    setSelectedUser(null);
                  }
                }}
                placeholder="Search by username..."
                className="w-full rounded-xl border border-white/10 bg-black/40 pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              {searching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-500" />
              )}
              {searchResults.length > 0 && !selectedUser && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#0a0e1a]/95 backdrop-blur-2xl shadow-2xl overflow-hidden">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <img
                        src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
                        alt={user.username}
                        className="w-8 h-8 rounded-full border border-white/10 bg-black/40"
                      />
                      <span className="text-sm font-bold text-white">@{user.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedUser && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3">
              <img
                src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.id}`}
                alt={selectedUser.username}
                className="w-10 h-10 rounded-full border border-white/10 bg-black/40"
              />
              <div className="flex-1">
                <p className="text-sm font-black text-white">@{selectedUser.username}</p>
                <p className="text-xs text-slate-400">ID: {selectedUser.id.slice(0, 8)}...</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setSearchQuery('');
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="text-xs font-bold">Clear</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Points</label>
              <div className="relative">
                <input
                  type="number"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  placeholder="e.g. 100 or -50"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {parseInt(pointsInput) > 0 ? (
                    <Plus className="w-4 h-4 text-emerald-400" />
                  ) : parseInt(pointsInput) < 0 ? (
                    <Minus className="w-4 h-4 text-red-400" />
                  ) : null}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">Use positive to add, negative to deduct</p>
            </div>
            <div>
              <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Reason</label>
              <input
                type="text"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Reason for adjustment..."
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !selectedUser || !pointsInput || !reasonInput.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm font-black text-amber-200 transition-all hover:bg-amber-500/25 hover:shadow-lg hover:shadow-amber-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Submit Adjustment
          </button>
        </div>
      </div>

      {selectedUser && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-black text-white">Transaction History</h3>
            <span className="text-xs text-slate-500">@{selectedUser.username}</span>
          </div>
          {txLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No transactions found for this user</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    tx.points >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
                  )}>
                    {tx.points >= 0 ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{tx.description || tx.transaction_type}</p>
                    <p className="text-xs text-slate-500">{tx.transaction_type.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn(
                      'text-sm font-black',
                      tx.points >= 0 ? 'text-emerald-400' : 'text-red-400',
                    )}>
                      {tx.points >= 0 ? '+' : ''}{tx.points.toLocaleString()}
                    </p>
                    <p className="text-[0.65rem] text-slate-500">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
