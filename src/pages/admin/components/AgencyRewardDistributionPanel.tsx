import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAgencyRewards } from '@/hooks/useAdminAgency';
import type { AgencyRewardType, AgencyTier } from '@/types/agency';
import { TIER_CONFIG } from '@/types/agency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Gift, Plus, Loader2, Trash2, Search, Clock, CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';

interface UserSearchResult {
  id: string;
  username: string;
  avatar_url?: string | null;
}

const rewardTypeOptions: { value: AgencyRewardType; label: string }[] = [
  { value: 'bonus_coins', label: 'Bonus Coins' },
  { value: 'badge', label: 'Badge' },
  { value: 'exclusive_access', label: 'Exclusive Access' },
  { value: 'custom_role', label: 'Custom Role' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'cash_payout', label: 'Cash Payout' },
  { value: 'tier_milestone', label: 'Tier Milestone' },
];

const tierOptions: { value: AgencyTier; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'legend', label: 'Legend' },
];

const statusConfig: Record<string, { icon: typeof Clock; label: string; className: string }> = {
  pending: { icon: Clock, label: 'Pending', className: 'border-amber-300/30 bg-amber-500/10 text-amber-200' },
  available: { icon: Gift, label: 'Available', className: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200' },
  claimed: { icon: CheckCircle2, label: 'Claimed', className: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-200' },
  expired: { icon: XCircle, label: 'Expired', className: 'border-red-300/30 bg-red-500/10 text-red-200' },
  revoked: { icon: AlertTriangle, label: 'Revoked', className: 'border-red-300/30 bg-red-500/10 text-red-200' },
};

function RevokeModal({
  rewardTitle,
  onClose,
  onConfirm,
}: {
  rewardTitle: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Revoke reason is required');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#070b19]/95 p-6 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
        <h3 className="text-lg font-black text-white mb-1">Revoke Reward</h3>
        <p className="text-sm text-slate-400 mb-4">Revoking: {rewardTitle}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for revocation (required)..."
          className="w-full h-24 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-2.5 text-sm font-black text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Revoke
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgencyRewardDistributionPanel() {
  const { rewards, loading, error, refresh, createReward, revokeReward } = useAdminAgencyRewards();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [rewardType, setRewardType] = useState<AgencyRewardType>('bonus_coins');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tierRequirement, setTierRequirement] = useState<AgencyTier>('none');
  const [coinValue, setCoinValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [revokeModal, setRevokeModal] = useState<{ id: string; title: string } | null>(null);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query.trim()}%`)
        .limit(10);
      if (!error && data) {
        setSearchResults(data);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.username);
    setSearchResults([]);
  };

  const handleCreateReward = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }
    if (!title.trim()) {
      toast.error('Please enter a reward title');
      return;
    }

    setSubmitting(true);
    try {
      await createReward({
        userId: selectedUser.id,
        rewardType,
        title: title.trim(),
        description: description.trim() || undefined,
        tierRequirement,
        coinValue: parseInt(coinValue, 10) || 0,
      });
      toast.success('Reward created successfully');
      setTitle('');
      setDescription('');
      setCoinValue('');
      setTierRequirement('none');
      setRewardType('bonus_coins');
    } catch (_err) {
      toast.error('Failed to create reward');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeConfirm = async (reason: string) => {
    if (!revokeModal) return;
    try {
      await revokeReward(revokeModal.id, reason);
      toast.success('Reward revoked');
      setRevokeModal(null);
    } catch (_err) {
      toast.error('Failed to revoke reward');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-pink-500/20 p-2.5">
            <Gift className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Reward Distribution</h2>
            <p className="text-sm text-slate-400">Create and manage agency rewards</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <Loader2 className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-2xl shadow-black/20">
        <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-pink-400" />
          Create New Reward
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Recipient User</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by username..."
                className="w-full rounded-xl border border-white/10 bg-black/40 pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
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
            {selectedUser && (
              <div className="flex items-center gap-3 mt-2 rounded-xl border border-pink-400/20 bg-pink-500/5 px-4 py-2.5">
                <img
                  src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.id}`}
                  alt={selectedUser.username}
                  className="w-8 h-8 rounded-full border border-white/10 bg-black/40"
                />
                <span className="text-sm font-bold text-white">@{selectedUser.username}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery('');
                  }}
                  className="ml-auto text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Reward Type</label>
              <select
                value={rewardType}
                onChange={(e) => setRewardType(e.target.value as AgencyRewardType)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 appearance-none"
              >
                {rewardTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Tier Requirement</label>
              <select
                value={tierRequirement}
                onChange={(e) => setTierRequirement(e.target.value as AgencyTier)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 appearance-none"
              >
                {tierOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reward title..."
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
            />
          </div>

          <div>
            <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reward description (optional)..."
              className="w-full h-20 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none"
            />
          </div>

          <div>
            <label className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2 block">Coin Value</label>
            <input
              type="number"
              value={coinValue}
              onChange={(e) => setCoinValue(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
            />
          </div>

          <button
            type="button"
            onClick={handleCreateReward}
            disabled={submitting || !selectedUser || !title.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-pink-400/30 bg-pink-500/15 px-4 py-3 text-sm font-black text-pink-200 transition-all hover:bg-pink-500/25 hover:shadow-lg hover:shadow-pink-500/15 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Reward
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <Gift className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-black text-white">Existing Rewards</h3>
          <span className="text-xs text-slate-500">({rewards.length})</span>
        </div>

        {loading && !rewards.length ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-pink-500" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-300 text-sm">Error loading rewards</div>
        ) : rewards.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No rewards created yet</div>
        ) : (
          <div className="divide-y divide-white/5">
            {rewards.map((reward) => {
              const status = statusConfig[reward.status] || statusConfig.pending;
              const StatusIcon = status.icon;
              const tierConfig = TIER_CONFIG[reward.tier_requirement];
              const canRevoke = reward.status === 'available' || reward.status === 'pending';

              return (
                <div key={reward.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-lg">
                    🎁
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-white truncate">{reward.title}</h4>
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wider',
                        status.className,
                      )}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                      {tierConfig && tierConfig.name !== 'none' && (
                        <span className={cn(
                          'rounded-full border px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-wider',
                          tierConfig.borderColor,
                          tierConfig.bgColor,
                          tierConfig.color,
                        )}>
                          {tierConfig.icon} {tierConfig.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500">
                        Type: <span className="font-bold text-slate-300">{reward.reward_type.replace(/_/g, ' ')}</span>
                      </span>
                      {reward.coin_value > 0 && (
                        <span className="text-xs text-slate-500">
                          Value: <span className="font-bold text-amber-300">{reward.coin_value.toLocaleString()}</span>
                        </span>
                      )}
                      <span className="text-xs text-slate-500">
                        {new Date(reward.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {reward.description && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{reward.description}</p>
                    )}
                  </div>
                  {canRevoke && (
                    <button
                      type="button"
                      onClick={() => setRevokeModal({ id: reward.id, title: reward.title })}
                      className="shrink-0 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/20"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {revokeModal && (
        <RevokeModal
          rewardTitle={revokeModal.title}
          onClose={() => setRevokeModal(null)}
          onConfirm={handleRevokeConfirm}
        />
      )}
    </div>
  );
}
