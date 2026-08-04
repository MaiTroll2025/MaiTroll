import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BadgeDollarSign, Banknote, CheckCircle2, ReceiptText, ShieldCheck, Sparkles, Users, WalletCards } from 'lucide-react';
import { hasRole, supabase, UserRole } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

type TreasuryRow = {
  balance_coins: number;
  total_earned_coins: number;
  total_distributed_coins: number;
  updated_at: string | null;
};

type TreasuryTransaction = {
  id: string;
  transaction_type: string;
  source_type: string | null;
  direction: 'credit' | 'debit';
  amount_coins: number;
  created_at: string;
  details: Record<string, unknown> | null;
};

type RoleAllocation = {
  id: string;
  role_key: string;
  role_label: string;
  weekly_amount_coins: number;
  is_active: boolean;
};

type PayoutRun = {
  id: string;
  run_week_start: string;
  run_week_end: string;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  total_amount_coins: number;
  created_at: string;
  approved_at: string | null;
  processed_at: string | null;
  notes: Record<string, unknown> | null;
};

type PayoutItem = {
  id: string;
  user_id: string;
  role_key: string;
  amount_coins: number;
  status: string;
  details: Record<string, unknown> | null;
  created_at: string;
  profile?: {
    username?: string | null;
    display_name?: string | null;
  } | null;
};

const roleOptions = [
    { value: 'auctioneer', label: 'Auctioneer', pricingModel: 'case' as const },
    { value: 'prosecutor', label: 'Prosecutor', pricingModel: 'case' as const },
    { value: 'attorney', label: 'Attorney', pricingModel: 'case' as const },
    { value: 'tcnn_news_caster', label: 'TCNN News Caster', pricingModel: 'week' as const },
    { value: 'secretary', label: 'Secretary', pricingModel: 'week' as const },
    { value: 'tcnn_chief_news_caster', label: 'TCNN Chief News Caster', pricingModel: 'week' as const },
    { value: 'troll_officer', label: 'Troll Officer', pricingModel: 'week' as const },
    { value: 'journalist', label: 'Journalist', pricingModel: 'week' as const },
    { value: 'lead_troll_officer', label: 'Lead Troll Officer', pricingModel: 'week' as const },
    { value: 'agency_hr_manager', label: 'Agency HR Manager', pricingModel: 'week' as const },
    { value: 'agency_hr', label: 'Agency HR', pricingModel: 'week' as const },
    { value: 'agency_leader', label: 'Agency Leader', pricingModel: 'week' as const },
    { value: 'troll_family_leader', label: 'Troll Family Leader', pricingModel: 'week' as const },
    { value: 'ceo_assistant', label: 'CEO Assistant', pricingModel: 'week' as const },
    { value: 'noah_assistant', label: 'Noah Assistant', pricingModel: 'week' as const },
];

const getCurrentWeekStart = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = (day + 6) % 7;
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - diff);
  return now.toISOString().slice(0, 10);
};

const formatCoins = (amount: number) =>
  new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(amount)));

const formatDate = (value?: string | null) => {
  if (!value) return 'Not yet';

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return 'Pending';

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function TreasuryDashboard() {
  const profile = useAuthStore((state) => state.profile);
  const canEdit = hasRole(profile, [UserRole.PRESIDENT, UserRole.ADMIN], { allowAdminOverride: true });
  const canCredit = hasRole(profile, [UserRole.ADMIN], { allowAdminOverride: true });
  const currentWeekStart = useMemo(() => getCurrentWeekStart(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAllocation, setIsSavingAllocation] = useState(false);
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [isApprovingRun, setIsApprovingRun] = useState(false);
  const [isProcessingRun, setIsProcessingRun] = useState(false);
  const [isManualCredit, setIsManualCredit] = useState(false);

  const [treasury, setTreasury] = useState<TreasuryRow | null>(null);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [allocations, setAllocations] = useState<RoleAllocation[]>([]);
  const [runs, setRuns] = useState<PayoutRun[]>([]);
  const [activeRun, setActiveRun] = useState<PayoutRun | null>(null);
  const [runItems, setRunItems] = useState<PayoutItem[]>([]);

  const [selectedRole, setSelectedRole] = useState(roleOptions[0].value);
  const [weeklyAmount, setWeeklyAmount] = useState('0');
  const [enabled, setEnabled] = useState(true);
  const [manualAmount, setManualAmount] = useState('');
  const [manualReason, setManualReason] = useState('');

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);

    try {
      const [treasuryResult, transactionsResult, allocationsResult, runsResult] = await Promise.all([
        supabase.from('troll_city_treasury').select('balance_coins,total_earned_coins,total_distributed_coins,updated_at').maybeSingle(),
        supabase.from('treasury_transactions').select('id,transaction_type,source_type,direction,amount_coins,created_at,details').order('created_at', { ascending: false }).limit(12),
        supabase.from('treasury_role_allocations').select('id,role_key,role_label,weekly_amount_coins,is_active').order('role_label', { ascending: true }),
        supabase.from('treasury_payout_runs').select('id,run_week_start,run_week_end,status,total_amount_coins,created_at,approved_at,processed_at,notes').order('created_at', { ascending: false }).limit(12),
      ]);

      if (treasuryResult.error) throw treasuryResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (allocationsResult.error) throw allocationsResult.error;
      if (runsResult.error) throw runsResult.error;

      const treasuryData = (treasuryResult.data ?? {
        balance_coins: 0,
        total_earned_coins: 0,
        total_distributed_coins: 0,
        updated_at: null,
      }) as TreasuryRow;

      setTreasury(treasuryData);
      setTransactions((transactionsResult.data ?? []) as TreasuryTransaction[]);
      setAllocations((allocationsResult.data ?? []) as RoleAllocation[]);
      setRuns((runsResult.data ?? []) as PayoutRun[]);

      const currentRun = ((runsResult.data ?? []) as PayoutRun[]).find((run) => run.run_week_start === currentWeekStart && ['draft', 'approved'].includes(run.status)) ?? null;
      setActiveRun(currentRun);

      if (!currentRun) {
        setRunItems([]);
        return;
      }

      const itemsResult = await supabase
        .from('treasury_payout_items')
        .select('id,user_id,role_key,amount_coins,status,details,created_at')
        .eq('payout_run_id', currentRun.id)
        .order('created_at', { ascending: true });

      if (itemsResult.error) throw itemsResult.error;

      const items = (itemsResult.data ?? []) as PayoutItem[];
      const userIds = Array.from(new Set(items.map((item) => item.user_id)));

      let profileLookup = new Map<string, { username?: string | null; display_name?: string | null }>();
      if (userIds.length > 0) {
        const profilesResult = await supabase
          .from('user_profiles')
          .select('id,username,display_name')
          .in('id', userIds);

        if (profilesResult.error) throw profilesResult.error;

        profileLookup = new Map(
          ((profilesResult.data ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>).map((profile) => [
            profile.id,
            { username: profile.username, display_name: profile.display_name },
          ]),
        );
      }

      setRunItems(
        items.map((item) => ({
          ...item,
          profile: profileLookup.get(item.user_id) ?? null,
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load treasury dashboard';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const savedAllocation = allocations.find((allocation) => allocation.role_key === selectedRole);

    if (!savedAllocation) {
      setWeeklyAmount('0');
      setEnabled(false);
      return;
    }

    setWeeklyAmount(String(savedAllocation.weekly_amount_coins));
    setEnabled(savedAllocation.is_active && savedAllocation.weekly_amount_coins > 0);
  }, [allocations, selectedRole]);

  const currentAllocation = allocations.find((allocation) => allocation.role_key === selectedRole);
  const duplicateCurrentWeek = runs.some((run) => run.run_week_start === currentWeekStart && run.status !== 'cancelled');
  const currentRunAmount = activeRun?.total_amount_coins ?? 0;
  const hasBudgetWarning = treasury ? currentRunAmount > treasury.balance_coins : false;

  const handleSaveAllocation = async () => {
    if (!canEdit) {
      toast.error('You do not have permission to change treasury role allocations.');
      return;
    }

    const amount = Number.parseInt(weeklyAmount, 10);

    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Enter a valid weekly amount in Troll Coins.');
      return;
    }

    if (enabled && amount === 0) {
      toast.error('Enable this allocation with a positive weekly amount.');
      return;
    }

    setIsSavingAllocation(true);

    try {
      const { error } = await supabase.rpc('set_treasury_role_allocation', {
        p_role_key: selectedRole,
        p_role_label: roleOptions.find((option) => option.value === selectedRole)?.label ?? selectedRole,
        p_weekly_amount_coins: enabled ? amount : 0,
      });

      if (error) throw error;

      toast.success(`Saved the ${roleOptions.find((option) => option.value === selectedRole)?.label ?? selectedRole} allocation.`);
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this allocation.';
      toast.error(message);
    } finally {
      setIsSavingAllocation(false);
    }
  };

  const handleCreateRun = async () => {
    if (!canEdit) {
      toast.error('Only presidents and admins can create weekly payout drafts.');
      return;
    }

    setIsCreatingRun(true);

    try {
      const { data, error } = await supabase.rpc('create_weekly_treasury_payout_run');

      if (error) throw error;

      const payload = data as { item_count?: number; total_amount_coins?: number } | null;
      toast.success(`Draft created with ${payload?.item_count ?? 0} eligible user payouts.`);
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create the weekly payout draft.';
      toast.error(message);
    } finally {
      setIsCreatingRun(false);
    }
  };

  const handleApproveRun = async () => {
    if (!activeRun || !canEdit) return;

    setIsApprovingRun(true);

    try {
      const { error } = await supabase.rpc('approve_treasury_payout_run', {
        p_payout_run_id: activeRun.id,
      });

      if (error) throw error;

      toast.success('Treasury payout run approved for processing.');
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to approve the payout run.';
      toast.error(message);
    } finally {
      setIsApprovingRun(false);
    }
  };

  const handleProcessRun = async () => {
    if (!activeRun || !canEdit) return;

    setIsProcessingRun(true);

    try {
      const { error } = await supabase.rpc('process_treasury_payout_run', {
        p_payout_run_id: activeRun.id,
      });

      if (error) throw error;

      toast.success('Treasury payout run processed and distributed.');
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process the payout run.';
      toast.error(message);
    } finally {
      setIsProcessingRun(false);
    }
  };

  const handleManualCredit = async () => {
    if (!canCredit) {
      toast.error('Only admins or CEOs can add manual treasury deposits.');
      return;
    }

    const amount = Number.parseInt(manualAmount, 10);

    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Enter a positive Troll Coin deposit amount.');
      return;
    }

    if (!manualReason.trim()) {
      toast.error('Add a reason for the manual treasury deposit.');
      return;
    }

    setIsManualCredit(true);

    try {
      const { error } = await supabase.rpc('credit_treasury_revenue', {
        p_source_type: 'manual_admin_deposit',
        p_source_id: null,
        p_amount_coins: amount,
        p_created_by: profile?.id,
        p_details: {
          reason: manualReason.trim(),
        },
      });

      if (error) throw error;

      toast.success(`Added ${formatCoins(amount)} Troll Coins to the treasury.`);
      setManualAmount('');
      setManualReason('');
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add the treasury deposit.';
      toast.error(message);
    } finally {
      setIsManualCredit(false);
    }
  };

  const allocationCount = allocations.filter((allocation) => allocation.is_active && allocation.weekly_amount_coins > 0).length;
  const latestPaidRun = runs.find((run) => run.status === 'paid');

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_22%),linear-gradient(135deg,_#020617,_#111827_55%,_#0f172a)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-[28px] border border-cyan-400/20 bg-slate-950/80 p-6 shadow-[0_0_36px_rgba(34,211,238,0.12)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Mai Troll Treasury</p>
              <div>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Weekly treasury and payout control</h1>
<p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
                   View treasury balances, audit revenue credits, manage President-approved weekly role perks, and process Treasury distributions.
                 </p>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="font-semibold">Access</div>
              <div>{canEdit ? 'President / Admin controls enabled' : 'Read-only access'}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Current balance</span>
              <BadgeDollarSign className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{formatCoins(treasury?.balance_coins ?? 0)}</div>
            <p className="mt-2 text-xs text-slate-400">Updated {formatDate(treasury?.updated_at ?? null)}</p>
          </div>

          <div className="rounded-2xl border border-fuchsia-400/20 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Total earned</span>
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{formatCoins(treasury?.total_earned_coins ?? 0)}</div>
            <p className="mt-2 text-xs text-slate-400">All funds credited into the treasury.</p>
          </div>

          <div className="rounded-2xl border border-amber-300/20 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Total distributed</span>
              <WalletCards className="h-4 w-4 text-amber-200" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{formatCoins(treasury?.total_distributed_coins ?? 0)}</div>
            <p className="mt-2 text-xs text-slate-400">Coins already moved to approved role payouts.</p>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Active allocations</span>
              <Users className="h-4 w-4 text-emerald-200" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-white">{allocationCount}</div>
            <p className="mt-2 text-xs text-slate-400">Weekly payouts currently turned on.</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Weekly payout draft</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Current week: {currentWeekStart}</h2>
              </div>
              <button
                type="button"
                onClick={handleCreateRun}
                disabled={!canEdit || isCreatingRun || duplicateCurrentWeek}
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isCreatingRun ? 'Creating…' : duplicateCurrentWeek ? 'Draft exists' : 'Create draft'}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Pending total</div>
                <div className="mt-2 text-lg font-semibold text-white">{formatCoins(currentRunAmount)}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Draft status</div>
                <div className="mt-2 text-lg font-semibold text-white">{activeRun?.status ?? 'No draft'}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Last paid run</div>
                <div className="mt-2 text-sm font-semibold text-white">{latestPaidRun ? formatDate(latestPaidRun.processed_at) : 'None yet'}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleApproveRun}
                disabled={!canEdit || !activeRun || activeRun.status !== 'draft' || isApprovingRun}
                className="rounded-full border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                {isApprovingRun ? 'Approving…' : 'Approve run'}
              </button>
              <button
                type="button"
                onClick={handleProcessRun}
                disabled={!canEdit || !activeRun || activeRun.status !== 'approved' || isProcessingRun || hasBudgetWarning}
                className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                {isProcessingRun ? 'Processing…' : 'Process run'}
              </button>
            </div>

            {hasBudgetWarning && (
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Treasury balance is below the pending payout total.
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Draft recipients</h3>
                <span className="text-xs text-slate-400">{runItems.length} selected</span>
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800">
                <div className="max-h-80 overflow-y-auto">
                  {runItems.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-slate-400">No payout recipients are currently drafted for this week.</div>
                  ) : (
                    <table className="min-w-full divide-y divide-slate-800 text-sm">
                      <thead className="bg-slate-900/80 text-slate-300">
                        <tr>
                          <th className="px-4 py-3 text-left">User</th>
                          <th className="px-4 py-3 text-left">Role</th>
                          <th className="px-4 py-3 text-right">Coins</th>
                          <th className="px-4 py-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-950/80">
                        {runItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-white">
                              {item.profile?.display_name || item.profile?.username || item.user_id}
                            </td>
                            <td className="px-4 py-3 text-slate-300">{item.role_key}</td>
                            <td className="px-4 py-3 text-right text-white">{formatCoins(item.amount_coins)}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-100">{item.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Role allocation controls</p>
                  <h2 className="mt-2 text-lg font-semibold text-white">Set President-managed allocations</h2>
                </div>
                <ShieldCheck className="h-5 w-5 text-cyan-200" />
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-slate-200">Role</label>
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500"
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-white">Enable allocation</p>
                    <p className="text-xs text-slate-400">Turn this off to disable the weekly draft for this role.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnabled((value) => !value)}
                    disabled={!canEdit}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${enabled ? 'bg-emerald-400' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-slate-200">
                    Troll Coins per {roleOptions.find((o) => o.value === selectedRole)?.pricingModel === 'case' ? 'Case' : 'Week'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={weeklyAmount}
                    onChange={(event) => setWeeklyAmount(event.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:text-slate-500"
                  />
                  {roleOptions.find((o) => o.value === selectedRole)?.pricingModel === 'case' && (
                    <p className="mt-1 text-xs text-slate-500">This role earns coins per case handled. Set the amount per case below.</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                  {currentAllocation ? (
                    <div className="flex items-center justify-between gap-3">
                      <span>Current value</span>
                      <span className="font-semibold text-white">{formatCoins(currentAllocation.weekly_amount_coins)} {currentAllocation.is_active ? 'active' : 'disabled'}</span>
                    </div>
                  ) : (
                    <span>No saved allocation yet for this role.</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveAllocation}
                  disabled={!canEdit || isSavingAllocation}
                  className="w-full rounded-full bg-fuchsia-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isSavingAllocation ? 'Saving…' : 'Save allocation'}
                </button>
              </div>
            </div>

            {canCredit && (
              <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Manual treasury credit</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">Add an admin-approved deposit</h2>
                  </div>
                  <Banknote className="h-5 w-5 text-cyan-200" />
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-2 block text-sm text-slate-200">Deposit amount</label>
                    <input
                      type="number"
                      min={1}
                      value={manualAmount}
                      onChange={(event) => setManualAmount(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-slate-200">Reason</label>
                    <input
                      type="text"
                      value={manualReason}
                      onChange={(event) => setManualReason(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualCredit}
                    disabled={isManualCredit}
                    className="w-full rounded-full bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isManualCredit ? 'Submitting…' : 'Add treasury credit'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Treasury audit</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Recent revenue and distribution activity</h2>
              </div>
              <ReceiptText className="h-5 w-5 text-cyan-200" />
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead className="bg-slate-900/80 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Source</th>
                      <th className="px-4 py-3 text-right">Coins</th>
                      <th className="px-4 py-3 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/80">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-400">No treasury transactions have been logged yet.</td>
                      </tr>
                    ) : (
                      transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-4 py-3 text-white">{transaction.transaction_type}</td>
                          <td className="px-4 py-3 text-slate-300">{transaction.source_type ?? 'manual'}</td>
                          <td className={`px-4 py-3 text-right ${transaction.direction === 'credit' ? 'text-emerald-200' : 'text-amber-100'}`}>
                            {transaction.direction === 'credit' ? '+' : '-'}{formatCoins(transaction.amount_coins)}
                          </td>
                          <td className="px-4 py-3 text-slate-300">{formatTime(transaction.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Payout history</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Recent weekly runs</h2>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-200" />
            </div>

            <div className="mt-4 space-y-3">
              {runs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">No payout runs have been created yet.</div>
              ) : (
                runs.slice(0, 6).map((run) => (
                  <div key={run.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Week of {formatDate(run.run_week_start)}</div>
                        <div className="text-xs text-slate-400">{run.status}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{formatCoins(run.total_amount_coins)}</div>
                        <div className="text-xs text-slate-400">{formatTime(run.processed_at ?? run.approved_at ?? run.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
