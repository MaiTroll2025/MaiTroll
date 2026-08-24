import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Coins,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Building,
  Wallet as WalletIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import type {
  CashoutRequest,
  PayoutMethod,
  RequestCashoutResponse,
} from '../types/cashout';
import {
  TIERS,
  MIN_CASHOUT_COINS,
  type CashoutTier,
} from '../config/coinConfig';

const PAYOUT_METHODS: { value: PayoutMethod; label: string; icon: React.ReactNode }[] = [
  {
    value: 'cash_app',
    label: 'Cash App',
    icon: <Building className="w-5 h-5" />,
  },
  {
    value: 'paypal',
    label: 'PayPal',
    icon: <WalletIcon className="w-5 h-5" />,
  },
  {
    value: 'venmo',
    label: 'Venmo',
    icon: <User className="w-5 h-5" />,
  },
];

function getSavedPayoutUsernameForProfile(rawProfile: any, method: PayoutMethod) {
  if (!rawProfile) return '';
  const payoutProfile: any = rawProfile;

  switch (method) {
    case 'paypal':
      return payoutProfile['paypal_email'] || '';
    case 'cash_app':
      return payoutProfile['cashapp_handle'] ? String(payoutProfile['cashapp_handle']).replace(/\$/g, '') : '';
    case 'venmo':
      return payoutProfile['venmo_handle'] || '';
    default:
      return '';
  }
}

function getPreferredPayoutMethod(rawProfile: any): PayoutMethod {
  if (!rawProfile) return 'paypal';
  const payoutProfile: any = rawProfile;
  if (payoutProfile['preferred_payout_method']) return payoutProfile['preferred_payout_method'] as PayoutMethod;
  if (payoutProfile['paypal_email']) return 'paypal';
  if (payoutProfile['venmo_handle']) return 'venmo';
  return 'cash_app';
}

export default function CashoutRequestPage() {
  const authStore = useAuthStore() as any;
  const user = authStore.user as any;
  const profile = authStore.profile as any;
  const refreshProfile = authStore.refreshProfile as any;
  const navigate = useNavigate();

  // State
  const [eligibleCoins, setEligibleCoins] = useState<number>(0);
  const [selectedTier, setSelectedTier] = useState<CashoutTier | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('paypal');
  const [providerUsername, setProviderUsername] = useState('');
  const [userTag, setUserTag] = useState('');
  const [lastApprovedAt, setLastApprovedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentRequests, setRecentRequests] = useState<CashoutRequest[]>([]);
  const [dailyCashoutCount, setDailyCashoutCount] = useState(0);
  const [fastPayApproved, setFastPayApproved] = useState(false);

   // Derived state for display
   const usdAmount = selectedTier ? selectedTier.usd : 0;
   const dailyLimitReached = dailyCashoutCount >= 1;
   const isFeeProvider = payoutMethod === 'venmo' || payoutMethod === 'cash_app';
   const isPayPal = payoutMethod === 'paypal';
   const feeCoins = selectedTier
     ? (isFeeProvider ? Math.round(selectedTier.coins * 0.05) : isPayPal ? 50 : 0)
     : 0;
   const totalCoinsNeeded = selectedTier ? selectedTier.coins + (feeCoins || 0) : 0;
   const canRequest = eligibleCoins >= totalCoinsNeeded && providerUsername.trim() && userTag.trim();

  // Load user's troll_coins balance and recent payout requests
  const getSavedPayoutUsername = useCallback((method: PayoutMethod) => {
    return getSavedPayoutUsernameForProfile(profile, method);
  }, [profile]);

   // Display tiers
   const displayTiers = TIERS.map(
     (t) => ({ ...t } as CashoutTier)
   );

  useEffect(() => {
    if (!profile) return;

    const preferredMethod = getPreferredPayoutMethod(profile);
    setPayoutMethod(preferredMethod);
    const savedProvider = getSavedPayoutUsernameForProfile(profile, preferredMethod);
    if (savedProvider) setProviderUsername(savedProvider);
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return
    refreshProfile?.()
  }, [user?.id, refreshProfile])

  useEffect(() => {
    if (!profile) return;
    if (providerUsername.trim()) return;

    const savedProvider = getSavedPayoutUsername(payoutMethod);
    if (savedProvider) setProviderUsername(savedProvider);
  }, [profile, payoutMethod, providerUsername, getSavedPayoutUsername]);

  useEffect(() => {
    async function loadData() {
      if (!profile) return;

      try {
        setLoading(true);

        // All troll coins are cashout-eligible.
        const eligibleTotal = Math.max(0, (profile.troll_coins || 0));
        setEligibleCoins(eligibleTotal);

        // Load recent payout requests
        const { data: requestsData, error: requestsError } = await supabase
          .from('payout_requests')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (requestsError) throw requestsError;
        setRecentRequests(requestsData || []);

        // Load last approved payout date to optionally skip ID upload for 30 days
        const { data: lastApprovedData, error: lastApprovedError } = await supabase
          .from('payout_requests')
          .select('created_at')
          .eq('user_id', profile.id)
          .in('status', ['approved', 'completed'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastApprovedError) throw lastApprovedError;
        setLastApprovedAt(lastApprovedData?.[0]?.created_at || null);

        const { data: approvedApplicationData, error: approvedApplicationError } = await supabase
          .from('fast_pay_applications')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'approved')
          .maybeSingle();

        if (approvedApplicationError) throw approvedApplicationError;
        setFastPayApproved(Boolean(profile.cashout_approved || approvedApplicationData?.id));

        // Count cashouts in the last 24 hours (daily limit) — matches backend enforcement.
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: dayCount, error: dayCountError } = await supabase
          .from('payout_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .in('status', ['approved', 'paid', 'completed'])
          .gte('created_at', dayAgo);

        if (dayCountError) throw dayCountError;
        setDailyCashoutCount(dayCount || 0);

        // Auto-select highest eligible tier based on the loaded balance.
        const eligibleTier = [...TIERS].reverse().find(t => t.coins <= eligibleTotal) || TIERS[0];
        if (eligibleTier) setSelectedTier(eligibleTier);
      } catch (err: any) {
        console.error('Failed to load cashout data:', err);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile]);

  // Real-time subscription for payout status updates
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`payout_requests_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          supabase
            .from('payout_requests')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => {
              if (data) setRecentRequests(data);
            });
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [profile]);

  // Handle cashout submission
  const handleSubmit = useCallback(async () => {
    if (!profile || !selectedTier) {
      toast.error('Missing required fields');
      return;
    }

    if (eligibleCoins < (selectedTier?.coins || 0)) {
      toast.error(`Insufficient eligible cashout coins. You need ${selectedTier.coins.toLocaleString()} coins but only have ${eligibleCoins.toLocaleString()}.`);
      return;
    }

    if (dailyLimitReached) {
      toast.error(`Daily cashout limit reached. You have used ${dailyCashoutCount} cashout(s) in the last 24 hours.`);
      return;
    }

    if (!providerUsername.trim()) {
      toast.error('Please enter your ' + getPayoutLabel(payoutMethod) + ' username/email');
      return;
    }

    try {
      setSubmitting(true);

         const { data, error } = await supabase.rpc('request_cashout', {
         p_user_id: profile.id,
         p_coins_to_redeem: selectedTier.coins,
         p_provider_type: payoutMethod,
         p_provider_username: providerUsername.trim(),
         p_user_tag: userTag.trim() || null,
         p_id_verification_url: null,
       });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Cashout request failed');
      }

      toast.success(`Cashout request submitted! ${selectedTier.coins.toLocaleString()} coins${feeCoins > 0 ? ` + ${feeCoins.toLocaleString()} fee` : ''} deducted.`);

      // Refresh profile to update balances
      await refreshProfile();

      // Redirect to Mai Pay
      navigate('/mai-pay');
    } catch (err: any) {
      console.error('Cashout submission error:', err);
      toast.error('Failed to submit cashout request: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  }, [profile, selectedTier, payoutMethod, providerUsername, userTag, eligibleCoins, refreshProfile, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05030B] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-troll-gold border-r-transparent" />
          <p className="mt-4 text-troll-purple-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05030B] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="bg-troll-gold/20 p-3 rounded-full">
              <DollarSign className="w-8 h-8 text-troll-gold" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold text-white mb-2">Request Cashout</h1>
             <p className="text-gray-300">
                Convert your eligible cashout coins into real payout requests. All troll coins are cashout-eligible.
                You can request 1 cashout per day. PayPal and ACH have no fee. Venmo and Cash App charge a 5% fee (in coins).
             </p>
            </div>
          </div>

           {dailyLimitReached && (
            <div className="mt-4 bg-amber-900/30 border border-amber-700 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                 <h4 className="font-bold text-amber-400">Daily Cashout Limit Reached</h4>
                 <p className="text-sm text-amber-300/80">
                    You have used {dailyCashoutCount} cashout(s) in the last 24 hours.
                    Your limit resets 24 hours after your first cashout of the day.
                 </p>
              </div>
            </div>
          )}

          {selectedTier && eligibleCoins < selectedTier.coins && (
            <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-bold text-red-400">Insufficient Cashout Coins</h4>
                <p className="text-sm text-red-300/80">
                  You need {selectedTier.coins.toLocaleString()} eligible cashout coins for this tier but only have {eligibleCoins.toLocaleString()}.
                </p>
              </div>
            </div>
          )}

           </div>

         {/* Cashout Form */}
       <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 shadow-lg space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Coins className="text-troll-gold" />
            Cashout Details
          </h2>

          {/* Tier Selection */}
          <div>
               <label className="block text-sm font-medium text-gray-300 mb-2">
                 Select Cashout Tier
               </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {displayTiers.map((tier) => {
                  const isDisabled = eligibleCoins < tier.coins;
                  const isSelected = selectedTier?.coins === tier.coins;
                  return (
                  <button
                    key={tier.coins}
                    onClick={() => setSelectedTier(tier)}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-troll-gold bg-troll-gold/10'
                        : isDisabled
                        ? 'border-gray-700 bg-gray-900/30 cursor-not-allowed opacity-50'
                        : 'border-purple-600 bg-purple-900/20 hover:border-purple-400'
                    }`}
                  >
                    <div className="text-lg font-bold text-white">{tier.coins.toLocaleString()}</div>
                    <div className="text-sm text-troll-gold">${tier.usd.toFixed(2)}</div>
                    {tier.manualReview && (
                      <div className="text-xs text-yellow-300 mt-1">* Manual Review</div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * Cashout amounts are based on your troll coin balance. Minimum cashout is {MIN_CASHOUT_COINS.toLocaleString()} coins.
            </p>
          </div>

          {/* Cashout Fee Notice */}
          <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
            <h3 className="text-sm font-bold text-green-300">Cashout Fee</h3>
              <p className="text-sm text-green-200/80">
                PayPal and ACH have no cashout fee. Venmo and Cash App charge a 5% fee (in coins) per cashout. The full cash amount is paid out to you.
              </p>
            </div>
          </div>

          {/* Selected Tier Summary */}
          {selectedTier && (
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
              <h3 className="text-sm font-bold text-white mb-3">Cashout Summary</h3>
              <div className="space-y-2 text-sm">
                 <div className="flex justify-between">
                   <span className="text-gray-400">Requested Amount</span>
                   <span className="text-white font-mono">{selectedTier.coins.toLocaleString()} coins</span>
                 </div>
                <div className="flex justify-between">
                    <span className="text-gray-400">Processing Fee</span>
                    <span className="text-red-400 font-mono">
                      {isFeeProvider
                        ? `${feeCoins.toLocaleString()} coins (5%)`
                        : '$0.00'}
                    </span>
                  </div>
                 <div className="flex justify-between text-troll-gold font-bold pt-2 border-t border-purple-700/30">
                   <span>You Receive</span>
                   <span>${usdAmount.toFixed(2)}</span>
                 </div>
                 {isFeeProvider && feeCoins > 0 && (
                   <div className="flex justify-between pt-1">
                     <span className="text-gray-400">Total Charged</span>
                     <span className="text-white font-mono">
                       {totalCoinsNeeded.toLocaleString()} coins
                     </span>
                   </div>
                 )}
              </div>
            </div>
          )}

          {/* Payout Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payout Method
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PAYOUT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setPayoutMethod(method.value)}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    payoutMethod === method.value
                      ? 'border-troll-green-neon bg-troll-green-neon/10'
                      : 'border-gray-700 bg-gray-900/30 hover:border-gray-500'
                  }`}
                >
                  <div className={payoutMethod === method.value ? 'text-troll-green-neon' : 'text-gray-400'}>
                    {method.icon}
                  </div>
                  <span className={`font-medium ${payoutMethod === method.value ? 'text-white' : 'text-gray-400'}`}>
                    {method.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Payout Provider Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {getPayoutLabel(payoutMethod)} Username / Handle / Email
            </label>
            <div className="relative">
              <input
                type="text"
                value={providerUsername}
                onChange={(e) => setProviderUsername(e.target.value)}
                placeholder={getPayoutPlaceholder(payoutMethod)}
                className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-troll-gold"
              />
              {providerUsername.trim() && (
                <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
              )}
            </div>
          </div>

          {/* User Tag */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Tag / Cashtag / Identifier
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Enter your identifier for the payout provider (e.g. CashApp $Cashtag, Venmo handle, or PayPal email). Admin will see this when processing your payout.
            </p>
            <div className="relative">
              <input
                type="text"
                value={userTag}
                onChange={(e) => setUserTag(e.target.value)}
                placeholder="$Cashtag, @handle, or email"
                className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-troll-gold"
              />
              {userTag.trim() && (
                <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
              )}
            </div>
          </div>

          {fastPayApproved && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-300">Cashout Approval Active</p>
                  <p className="text-xs text-emerald-200/80">
                    Your application has been approved, so ID upload is not required for cashout requests.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!canRequest || submitting}
            className={`w-full py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              canRequest
                ? 'bg-gradient-to-r from-troll-green to-troll-green-neon text-troll-purple-900 hover:shadow-lg hover:shadow-troll-gold/25'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-t-troll-purple-900 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : eligibleCoins < (selectedTier?.coins || 0) ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  Insufficient Eligible Coins
                </>
              ) : !providerUsername.trim() ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  Enter Payout Details
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  Request Payout
                </>
              )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            By requesting a cashout, you confirm that the payout information is correct.
            Cashout requests are manually reviewed by our admin team. Mai Troll does not charge any cashout fees.
          </p>
        </div>

        {/* Recent Requests */}
        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="text-troll-gold" />
            Recent Cashout Requests
          </h3>
          {recentRequests.length === 0 ? (
            <p className="text-sm text-gray-400">No cashout requests yet.</p>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-[#151027] rounded-lg border border-purple-500/20"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {req.coin_amount?.toLocaleString() || req.coins_reserved?.toLocaleString() || 0} coins
                    </p>
                    <p className="text-xs text-gray-400">
                      ${req.usd_amount?.toFixed(2) || '0.00'} • {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-bold ${
                        req.status === 'pending' || req.status === 'submitted'
                          ? 'bg-yellow-900/50 text-yellow-300'
                          : req.status === 'processing'
                          ? 'bg-blue-900/50 text-blue-300'
                          : req.status === 'approved'
                          ? 'bg-green-900/50 text-green-300'
                          : req.status === 'completed'
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                    {req.payout_method && (
                      <p className="text-xs text-gray-500 mt-1 capitalize">{req.payout_method}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Helper
function getPayoutLabel(method: PayoutMethod): string {
  switch (method) {
    case 'cash_app':
      return 'Cash App $Cashtag';
    case 'paypal':
      return 'PayPal Email';
    case 'venmo':
      return 'Venmo Username';
  }
}

function getPayoutPlaceholder(method: PayoutMethod): string {
  switch (method) {
    case 'cash_app':
      return '$YourCashtag';
    case 'paypal':
      return 'your@email.com';
    case 'venmo':
      return '@YourVenmoHandle';
  }
}
