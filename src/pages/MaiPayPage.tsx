import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Coins,
  Crown,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Send,
  Building,
  Wallet as WalletIcon,
  User,
  CreditCard,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { CASHOUT_TIERS as TIERS, type CashoutTier } from '../config/coinConfig';
import type { CashoutRequest, PayoutMethod } from '../types/cashout';
import FastPayProgram from '../components/FastPayProgram';
import FastPayApplication from './FastPayApplication';
import { WeeklyCashbackCard } from '@/components/supporter-economy/WeeklyCashbackCard';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GiftedUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_coins: number;
  gift_count: number;
}

interface RedemptionRecord {
  id: string;
  user_id: string;
  reward_type: 'troll_coins' | 'gift_card';
  crowns_redeemed: number;
  reward_value: string;
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected' | 'cancelled';
  giftcard_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type MaiPayTab = 'overview' | 'application' | 'crowns' | 'gifted' | 'cashout' | 'requests' | 'transactions';

interface CoinTransaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  metadata: any;
}

// ─── Payout Provider Options ─────────────────────────────────────────────────

interface PayoutProvider {
  value: PayoutMethod | 'ach' | 'check';
  label: string;
  icon: React.ReactNode;
}

const PAYOUT_PROVIDERS: PayoutProvider[] = [
  { value: 'cash_app', label: 'Cash App', icon: <Building className="w-5 h-5" /> },
  { value: 'paypal', label: 'PayPal', icon: <WalletIcon className="w-5 h-5" /> },
  { value: 'venmo', label: 'Venmo', icon: <User className="w-5 h-5" /> },
  { value: 'ach', label: 'ACH / Bank Transfer', icon: <CreditCard className="w-5 h-5" /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MaiPayPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();

  // ── State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<MaiPayTab>('application');
  const [loading, setLoading] = useState(true);

  // Coin balances
  const [trollCoins, setTrollCoins] = useState(0);
  const [hypeCoins, setHypeCoins] = useState(0);
  const [battleCrowns, setBattleCrowns] = useState(0);

  // Crown redemption
  const [crownRedemptions, setCrownRedemptions] = useState<RedemptionRecord[]>([]);
  const [crownConvertAmount, setCrownConvertAmount] = useState('');
  const [crownConverting, setCrownConverting] = useState(false);

  // Gifted users
  const [giftedUsers, setGiftedUsers] = useState<GiftedUser[]>([]);
  const [giftedSearchOpen, setGiftedSearchOpen] = useState(false);
  const [giftedSearch, setGiftedSearch] = useState('');
  const [giftedLoading, setGiftedLoading] = useState(false);

  // Cashout
  const [selectedTier, setSelectedTier] = useState<CashoutTier | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PayoutMethod | 'ach' | 'check'>('paypal');
  const [providerUsername, setProviderUsername] = useState('');
  const [submittingCashout, setSubmittingCashout] = useState(false);
  const [cashoutRequests, setCashoutRequests] = useState<CashoutRequest[]>([]);
  const [successfulCashoutsLast24Hours, setSuccessfulCashoutsLast24Hours] = useState(0);
  const [nextCashoutAvailableAt, setNextCashoutAvailableAt] = useState<string | null>(null);
  const [achBankName, setAchBankName] = useState('');
  const [achRoutingNumber, setAchRoutingNumber] = useState('');
  const [achAccountNumber, setAchAccountNumber] = useState('');

  // Transactions
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<string>('all');

  // ── Derived ──────────────────────────────────────────────────────────────

  const eligibleCashoutCoins = trollCoins;
  const canConvertHype = hypeCoins > 0;

  const cashoutTiers = useMemo<CashoutTier[]>(
    () => TIERS.map((tier) => ({ ...tier } as CashoutTier)),
    []
  );

  const cashoutLimit = 1;

  const hasFeeProvider = selectedProvider === 'venmo' || selectedProvider === 'cash_app';
  const isPayPalProvider = selectedProvider === 'paypal';
  const feeCoins = selectedTier
    ? (hasFeeProvider ? Math.round(selectedTier.coins * 0.05) : isPayPalProvider ? 50 : 0)
    : 0;
  const totalCoinsNeeded = selectedTier ? selectedTier.coins + feeCoins : 0;

  const canRequestCashout = selectedTier
    ? eligibleCashoutCoins >= totalCoinsNeeded && providerUsername.trim().length > 0
    : false;

  const filteredGiftedUsers = useMemo(() => {
    if (!giftedSearch.trim()) return giftedUsers;
    const q = giftedSearch.toLowerCase();
    return giftedUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.display_name && u.display_name.toLowerCase().includes(q))
    );
  }, [giftedUsers, giftedSearch]);

  // ── Data Loading ─────────────────────────────────────────────────────────

  const loadAllData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Load profile balances
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('troll_coins, hype_coins, battle_crowns, paypal_email, cashapp_handle, venmo_handle, preferred_payout_method')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setTrollCoins(profileData.troll_coins ?? 0);
        setHypeCoins(profileData.hype_coins ?? 0);
        setBattleCrowns(profileData.battle_crowns ?? 0);

        // Pre-fill provider username
        const preferred = profileData.preferred_payout_method as PayoutMethod | null;
        if (preferred) setSelectedProvider(preferred);
        if (profileData.paypal_email) setProviderUsername(profileData.paypal_email);
        else if (profileData.cashapp_handle) setProviderUsername(profileData.cashapp_handle);
        else if (profileData.venmo_handle) setProviderUsername(profileData.venmo_handle);
      }

    } catch (err) {
      console.error('[MaiPay] Failed to load data:', err);
      toast.error('Failed to load MAI Pay data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ── Daily cashout count ──────────────────────────────────────────
  // Server-validated count of successful cashouts in the last 24h.
  const loadCashoutLimit = useCallback(async () => {
    if (!user?.id) return;
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('payout_requests')
        .select('created_at')
        .eq('user_id', user.id)
        .in('status', ['approved', 'paid', 'completed'])
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = (data || []) as { created_at: string }[];
      setSuccessfulCashoutsLast24Hours(rows.length);

      const limit = 1;
      if (rows.length >= limit && rows[0]) {
        setNextCashoutAvailableAt(
          new Date(new Date(rows[0].created_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
        );
      } else {
        setNextCashoutAvailableAt(null);
      }
    } catch (err) {
      console.error('[MaiPay] Failed to load cashout limit:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    loadCashoutLimit();
  }, [loadCashoutLimit]);

  // Refresh the rolling limit after a successful cashout request.
  const refreshCashoutLimit = useCallback(() => {
    loadCashoutLimit();
  }, [loadCashoutLimit]);

  // ── Gifted Users Loading ─────────────────────────────────────────────────

  const loadGiftedUsers = useCallback(async () => {
    if (!user?.id) return;
    setGiftedLoading(true);
    try {
      // Get all gifts sent by this user, grouped by receiver
      const { data, error } = await supabase
        .from('coin_transactions')
        .select('receiver_id, amount, metadata')
        .eq('user_id', user.id)
        .eq('type', 'gift_sent')
        .gt('amount', 0);

      if (error) throw error;

      // Aggregate by receiver
      const totals = new Map<string, number>();
      (data || []).forEach((row: any) => {
        const rid = row.receiver_id;
        totals.set(rid, (totals.get(rid) || 0) + Number(row.amount || 0));
      });

      const receiverIds = Array.from(totals.keys());
      if (receiverIds.length === 0) {
        setGiftedUsers([]);
        setGiftedLoading(false);
        return;
      }

      // Fetch profiles for receivers
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', receiverIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const users: GiftedUser[] = receiverIds
        .map((rid) => {
          const p = profileMap.get(rid);
          return {
            user_id: rid,
            username: p?.username || 'Unknown',
            display_name: p?.display_name || null,
            avatar_url: p?.avatar_url || null,
            total_coins: totals.get(rid) || 0,
            gift_count: 0,
          };
        })
        .sort((a, b) => b.total_coins - a.total_coins);

      setGiftedUsers(users);
    } catch (err) {
      console.error('[MaiPay] Failed to load gifted users:', err);
    } finally {
      setGiftedLoading(false);
    }
  }, [user?.id]);

  // ── Crown Conversion ─────────────────────────────────────────────────────

  const handleConvertCrowns = useCallback(async () => {
    const amount = parseInt(crownConvertAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > battleCrowns) {
      toast.error('Not enough crowns');
      return;
    }

    setCrownConverting(true);
    try {
      const { data, error } = await supabase.rpc('redeem_crowns_for_coins', {
        p_user_id: user?.id,
        p_crowns: amount,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Conversion failed');

      toast.success(`Converted ${amount} crowns to ${amount} Troll Coins!`);
      setCrownConvertAmount('');
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert crowns');
    } finally {
      setCrownConverting(false);
    }
  }, [crownConvertAmount, battleCrowns, user?.id, loadAllData]);

  // ── Hype Coin Conversion ─────────────────────────────────────────────────

  const handleConvertHype = useCallback(async () => {
    if (hypeCoins <= 0) return;
    try {
      const { data, error } = await supabase.rpc('convert_hype_to_troll_coins', {
        p_user_id: user?.id,
        p_amount: hypeCoins,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Conversion failed');

      toast.success(`Converted ${hypeCoins.toLocaleString()} Hype Coins to Troll Coins!`);
      await loadAllData();
    } catch (err: any) {
      // Fallback: try direct update if RPC doesn't exist
      toast.error(err.message || 'Hype coin conversion not available yet');
    }
  }, [hypeCoins, user?.id, loadAllData]);

  // ── Cashout Request ──────────────────────────────────────────────────────

  const handleRequestCashout = useCallback(async () => {
    if (!selectedTier || !canRequestCashout) return;

    setSubmittingCashout(true);
    try {
      let providerDetails = providerUsername.trim();
      if (selectedProvider === 'ach') {
        providerDetails = JSON.stringify({
          bank_name: achBankName.trim(),
          routing_number: achRoutingNumber.trim(),
          account_number: achAccountNumber.trim(),
        });
      }

      const { data, error } = await supabase.rpc('request_cashout', {
        p_user_id: user?.id,
        p_coins_to_redeem: selectedTier.coins,
        p_provider_type: selectedProvider,
        p_provider_username: providerDetails,
        p_user_tag: null,
        p_id_verification_url: null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Cashout request failed');

      toast.success(`Cashout request submitted! ${selectedTier.coins.toLocaleString()} coins = $${selectedTier.usd.toFixed(2)}${feeCoins > 0 ? ` (+ ${feeCoins.toLocaleString()} coin fee)` : ''}`);
      setSelectedTier(null);
      setProviderUsername('');
      setAchBankName('');
      setAchRoutingNumber('');
      setAchAccountNumber('');
      await loadAllData();
      refreshCashoutLimit();
      setActiveTab('requests');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit cashout request');
    } finally {
      setSubmittingCashout(false);
    }
  }, [selectedTier, canRequestCashout, user?.id, selectedProvider, providerUsername, achBankName, achRoutingNumber, achAccountNumber, loadAllData]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': case 'submitted': return 'text-yellow-400 bg-yellow-900/30';
      case 'processing': return 'text-blue-400 bg-blue-900/30';
      case 'approved': case 'fulfilled': case 'completed': return 'text-green-400 bg-green-900/30';
      case 'rejected': case 'denied': case 'cancelled': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': case 'submitted': return <Clock className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'approved': case 'fulfilled': case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': case 'denied': case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading MAI Pay...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0A0814]/95 backdrop-blur-xl border-b border-purple-500/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-black">MAI Pay</h1>
            <p className="text-xs text-gray-400">Cash out your earned coins</p>
          </div>
          <button onClick={loadAllData} className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Refresh">
            <RefreshCw className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-hide">
              {([
              { key: 'application', label: 'Application', icon: <FileText className="w-4 h-4" /> },
              { key: 'overview', label: 'Overview', icon: <WalletIcon className="w-4 h-4" /> },
              { key: 'crowns', label: 'Crowns', icon: <Crown className="w-4 h-4" /> },
              { key: 'gifted', label: 'Gifted', icon: <Send className="w-4 h-4" /> },
              { key: 'cashout', label: 'Cash Out', icon: <DollarSign className="w-4 h-4" /> },
              { key: 'requests', label: 'Requests', icon: <FileText className="w-4 h-4" /> },
              { key: 'transactions', label: 'Transactions', icon: <ArrowDownLeft className="w-4 h-4" /> },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'gifted' && giftedUsers.length === 0) loadGiftedUsers();
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-purple-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ─── Overview Tab ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Balance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Troll Coins</span>
                </div>
                <p className="text-2xl font-black text-yellow-400">{trollCoins.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Available balance</p>
              </div>

              <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cashout Eligible</span>
                </div>
                <p className="text-2xl font-black text-green-400">{eligibleCashoutCoins.toLocaleString()}</p>
                 <p className="text-xs text-gray-500 mt-1">Available for cashout</p>
              </div>

              <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Battle Crowns</span>
                </div>
                <p className="text-2xl font-black text-amber-400">{battleCrowns.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Convert to coins</p>
              </div>

              <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hype Coins</span>
                </div>
                <p className="text-2xl font-black text-cyan-400">{hypeCoins.toLocaleString()}</p>
                {canConvertHype && (
                  <button
                    onClick={handleConvertHype}
                    className="mt-2 text-xs px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-full font-semibold transition-colors"
                  >
                    Convert to Troll Coins
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-6">
              <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setActiveTab('application')}
                  className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors text-center"
                >
                  <FileText className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                  <span className="text-sm font-semibold">Cashout Application</span>
                </button>
                <button
                  onClick={() => setActiveTab('crowns')}
                  className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-center"
                >
                  <Crown className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <span className="text-sm font-semibold">Convert Crowns</span>
                </button>
                <button
                  onClick={() => { setActiveTab('gifted'); loadGiftedUsers(); }}
                  className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-center"
                >
                  <Send className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <span className="text-sm font-semibold">View Gifted</span>
                </button>
                <button
                  onClick={() => setActiveTab('cashout')}
                  className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors text-center"
                >
                  <DollarSign className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <span className="text-sm font-semibold">Cash Out</span>
                </button>
                <button
                  onClick={() => setActiveTab('requests')}
                  className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors text-center"
                >
                  <FileText className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <span className="text-sm font-semibold">My Requests</span>
                </button>
              </div>
             </div>

             {/* Weekly Cashback Card */}
             <WeeklyCashbackCard />
           </>
         )}

         {/* ─── Application Tab ────────────────────────────────────────────── */}
        {activeTab === 'application' && (
          <FastPayApplication />
        )}

        {/* ─── Crowns Tab ───────────────────────────────────────────────── */}
        {activeTab === 'crowns' && (
          <>
            {/* Crown Balance Card */}
            <div className="bg-gradient-to-br from-amber-900/30 to-[#0E0A1A] rounded-xl border border-amber-500/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-500/20">
                    <Crown className="w-8 h-8 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Battle Crowns</p>
                    <p className="text-3xl font-black text-amber-400">{battleCrowns.toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={loadAllData} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <RefreshCw className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Convert Section */}
              <div className="mt-4 p-4 bg-black/20 rounded-xl">
                <h4 className="font-bold text-white mb-3">Convert Crowns → Troll Coins</h4>
                <p className="text-xs text-gray-400 mb-3">1 Crown = 1 Troll Coin (instant)</p>
                <div className="flex gap-2 mb-3">
                  {[1, 5, 25, 50].map((v) => (
                    <button
                      key={v}
                      onClick={() => setCrownConvertAmount(String(Math.min(v, battleCrowns)))}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                  <button
                    onClick={() => setCrownConvertAmount(String(battleCrowns))}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold hover:bg-amber-500/20 transition-colors"
                  >
                    Max
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={battleCrowns}
                    value={crownConvertAmount}
                    onChange={(e) => setCrownConvertAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 bg-black/30 border border-amber-500/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                  />
                  <button
                    onClick={handleConvertCrowns}
                    disabled={crownConverting || !crownConvertAmount || parseInt(crownConvertAmount) <= 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg font-bold text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-400 hover:to-orange-400 transition-all flex items-center gap-2"
                  >
                    {crownConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4 rotate-180" />}
                    Convert
                  </button>
                </div>
              </div>
            </div>

            {/* Crown Redemption History */}
            <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-6">
              <h3 className="text-lg font-bold mb-4">Crown Redemption History</h3>
              {crownRedemptions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No crown redemptions yet.</p>
              ) : (
                <div className="space-y-3">
                  {crownRedemptions.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${getStatusColor(r.status)}`}>
                          {getStatusIcon(r.status)}
                          {r.status.toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {r.crowns_redeemed} Crowns → {r.reward_type === 'troll_coins' ? `${r.crowns_redeemed} Troll Coins` : r.reward_value}
                          </p>
                          <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Gifted Tab ───────────────────────────────────────────────── */}
        {activeTab === 'gifted' && (
          <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Coins Gifted to Others</h3>
                <p className="text-xs text-gray-400 mt-1">Total coins you&apos;ve gifted to other users</p>
              </div>
              <button
                onClick={() => {
                  setGiftedSearchOpen(!giftedSearchOpen);
                  if (!giftedSearchOpen && giftedUsers.length === 0) loadGiftedUsers();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-semibold hover:bg-purple-500/20 transition-colors"
              >
                <Search className="w-4 h-4" />
                Search
                {giftedSearchOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Search Bar (collapsible) */}
            {giftedSearchOpen && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={giftedSearch}
                    onChange={(e) => setGiftedSearch(e.target.value)}
                    placeholder="Search by username or display name..."
                    className="w-full bg-black/30 border border-purple-500/20 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {giftedLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Loading gifted users...</p>
              </div>
            ) : filteredGiftedUsers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {giftedSearch ? 'No users match your search.' : "You haven't gifted coins to anyone yet."}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredGiftedUsers.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg hover:bg-black/30 transition-colors">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt={u.username} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-white">{u.display_name || u.username}</p>
                        <p className="text-xs text-gray-500">@{u.username}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{u.total_coins.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">coins gifted</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Cash Out Tab ─────────────────────────────────────────────── */}
        {activeTab === 'cashout' && (
          <>
            <FastPayProgram
              successfulCashoutsLast24Hours={successfulCashoutsLast24Hours}
              nextCashoutAvailableAt={nextCashoutAvailableAt}
            />

            {/* Eligible Balance */}
            <div className="bg-gradient-to-br from-green-900/30 to-[#0E0A1A] rounded-xl border border-green-500/30 p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-6 h-6 text-green-400" />
                <span className="text-sm text-gray-400">Cashout Eligible Balance</span>
              </div>
              <p className="text-3xl font-black text-green-400">{eligibleCashoutCoins.toLocaleString()}</p>
               <p className="text-xs text-gray-500 mt-1">Available for cashout (excludes reserved coins)</p>
            </div>

            {/* Cashout Fee Notice */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-green-300">Cashout Fee</h3>
                <p className="text-sm text-green-200/80">
                  PayPal and ACH have no cashout fee. Venmo and Cash App charge a 5% fee (in coins) per cashout. Select any tier and request 1 cashout per day.
                </p>
              </div>
            </div>

            {/* Cashout Tiers */}
            <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold">Select Cashout Tier</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {cashoutTiers.map((tier) => {
                  const isEligible = eligibleCashoutCoins >= tier.coins;
                  const isSelected = selectedTier?.coins === tier.coins;
                  return (
                    <button
                      key={tier.coins}
                      onClick={() => isEligible && setSelectedTier(tier)}
                      disabled={!isEligible}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-green-500 bg-green-500/10 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                          : isEligible
                          ? 'border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40'
                          : 'border-gray-800 bg-gray-900/20 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg font-black text-white">{tier.coins.toLocaleString()}</span>
                        {isSelected && <CheckCircle className="w-5 h-5 text-green-400" />}
                      </div>
                      <div className="text-sm font-bold text-green-400">${tier.usd.toFixed(2)}</div>
                      {tier.manualReview && (
                        <div className="text-xs text-amber-400 mt-1 font-semibold">* Manual Review</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fee & Provider Selection */}
            {selectedTier && (
              <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-6 space-y-5">
                {/* Cashout Summary */}
                <div className="bg-black/20 rounded-xl p-4">
                  <h4 className="font-bold text-white mb-3">Cashout Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cashout Amount</span>
                      <span className="text-white font-mono">{selectedTier.coins.toLocaleString()} coins</span>
                    </div>
                <div className="flex justify-between">
                      <span className="text-gray-400">Processing Fee</span>
                      <span className="text-red-400 font-mono">
                        {selectedProvider === 'venmo' || selectedProvider === 'cash_app'
                          ? `${Math.round(selectedTier.coins * 0.05).toLocaleString()} coins (5%)`
                          : selectedProvider === 'paypal'
                          ? `50 coins ($0.25)`
                          : '$0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-purple-500/20">
                      <span className="text-white font-bold">You Receive</span>
                      <span className="text-green-400 font-bold">${selectedTier.usd.toFixed(2)}</span>
                    </div>
                    {(selectedProvider === 'venmo' || selectedProvider === 'cash_app' || selectedProvider === 'paypal') && (
                      <div className="flex justify-between pt-1">
                        <span className="text-gray-400">Total Charged</span>
                        <span className="text-white font-mono">
                          {(selectedTier.coins + (selectedProvider === 'venmo' || selectedProvider === 'cash_app' ? Math.round(selectedTier.coins * 0.05) : selectedProvider === 'paypal' ? 50 : 0)).toLocaleString()} coins
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payout Provider */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Payout Provider</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {PAYOUT_PROVIDERS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setSelectedProvider(p.value)}
                        className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 ${
                          selectedProvider === p.value
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-gray-700 bg-gray-900/30 hover:border-gray-500'
                        }`}
                      >
                        <div className={selectedProvider === p.value ? 'text-green-400' : 'text-gray-400'}>
                          {p.icon}
                        </div>
                        <span className={`text-xs font-semibold ${selectedProvider === p.value ? 'text-white' : 'text-gray-400'}`}>
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                 {/* Provider Username */}
                 <div>
                   <label className="block text-sm font-medium text-gray-300 mb-2">
                     {PAYOUT_PROVIDERS.find((p) => p.value === selectedProvider)?.label} Details
                   </label>
                   <input
                     type="text"
                     value={providerUsername}
                     onChange={(e) => setProviderUsername(e.target.value)}
                     placeholder={
                       selectedProvider === 'cash_app' ? '$Cashtag' :
                       selectedProvider === 'paypal' ? 'email@example.com' :
                       selectedProvider === 'venmo' ? '@username' :
                       selectedProvider === 'ach' ? 'Account number' :
                       'Mailing address'
                     }
                     className="w-full bg-black/30 border border-purple-500/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                   />
                 </div>

                 {/* ACH Bank Details */}
                 {selectedProvider === 'ach' && (
                   <div className="space-y-3">
                     <div>
                       <label className="block text-sm font-medium text-gray-300 mb-1">Bank Name</label>
                       <input
                         type="text"
                         value={achBankName}
                         onChange={(e) => setAchBankName(e.target.value)}
                         placeholder="e.g. Chase Bank"
                         className="w-full bg-black/30 border border-purple-500/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-300 mb-1">Routing Number</label>
                       <input
                         type="text"
                         value={achRoutingNumber}
                         onChange={(e) => setAchRoutingNumber(e.target.value)}
                         placeholder="9-digit routing number"
                         className="w-full bg-black/30 border border-purple-500/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-300 mb-1">Account Number</label>
                       <input
                         type="text"
                         value={achAccountNumber}
                         onChange={(e) => setAchAccountNumber(e.target.value)}
                         placeholder="Bank account number"
                         className="w-full bg-black/30 border border-purple-500/20 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
                       />
                     </div>
                   </div>
                 )}

                {/* Submit */}
                <button
                  onClick={handleRequestCashout}
                  disabled={!canRequestCashout || submittingCashout}
                  className={`w-full py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                    canRequestCashout
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/25'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {submittingCashout ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  )                   : eligibleCashoutCoins < (totalCoinsNeeded) ? (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      Insufficient Coins
                    </>
                  ) : (
                    <>
                      <DollarSign className="w-5 h-5" />
                      Request Cashout
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── Requests Tab ────────────────────────────────────────────── */}
        {activeTab === 'requests' && (
          <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-6">
            <h3 className="text-lg font-bold mb-4">Cashout Requests</h3>
            {cashoutRequests.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No cashout requests yet.</p>
                <button
                  onClick={() => setActiveTab('cashout')}
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Request Your First Cashout
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {cashoutRequests.map((req) => (
                  <div key={req.id} className="bg-black/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${getStatusColor(req.status)}`}>
                          {getStatusIcon(req.status)}
                          {req.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className="text-lg font-black text-green-400">${req.usd_amount?.toFixed(2) || '0.00'}</span>
                    </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                       <div>
                         <p className="text-xs text-gray-500">Coins</p>
                         <p className="font-mono text-white">{req.coin_amount?.toLocaleString() || req.coins_reserved?.toLocaleString() || '—'}</p>
                       </div>
                      <div>
                        <p className="text-xs text-gray-500">Fee</p>
                        <p className="font-mono text-green-400">None</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Provider</p>
                        <p className="font-mono text-white capitalize">{req.payout_method || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Processed</p>
                        <p className="font-mono text-white">{req.processed_at ? new Date(req.processed_at).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>

                    {/* Admin message / notes */}
                    {(req as any).admin_notes && (
                      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-xs text-blue-300 font-semibold mb-1">Message from processing team:</p>
                        <p className="text-sm text-blue-200">{(req as any).admin_notes}</p>
                      </div>
                    )}

                    {req.rejection_reason && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-xs text-red-300 font-semibold mb-1">Rejection reason:</p>
                        <p className="text-sm text-red-200">{req.rejection_reason}</p>
                      </div>
                    )}

                    {req.status === 'completed' && (req as any).receipt_url && (
                      <div className="mt-3">
                        <a
                          href={(req as any).receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:text-purple-300 underline"
                        >
                          View Receipt
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Transactions Tab ────────────────────────────────────────── */}
        {activeTab === 'transactions' && (
          <div className="bg-[#0E0A1A] rounded-xl border border-purple-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Transaction History</h3>
              <div className="relative">
                <select
                  value={txFilter}
                  onChange={(e) => setTxFilter(e.target.value)}
                  className="appearance-none bg-black/20 border border-purple-500/20 text-white text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:border-purple-500/50 cursor-pointer"
                >
                  <option value="all" className="bg-slate-950">All</option>
                  <option value="gift_received" className="bg-slate-950">Received</option>
                  <option value="gift_sent" className="bg-slate-950">Sent</option>
                  <option value="purchase" className="bg-slate-950">Purchase</option>
                  <option value="cashout" className="bg-slate-950">Cashout</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {transactionsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions
                  .filter((tx) => txFilter === 'all' || tx.type === txFilter)
                  .map((tx) => {
                    const isPositive = tx.type === 'gift_received' || tx.type === 'purchase' || tx.type === 'crown_redemption';
                    const isNegative = tx.type === 'gift_sent' || tx.type === 'cashout' || tx.type === 'spend';
                    return (
                      <div key={tx.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            isPositive ? 'bg-green-500/10' : isNegative ? 'bg-red-500/10' : 'bg-purple-500/10'
                          }`}>
                            {isPositive ? (
                              <ArrowDownLeft className="w-4 h-4 text-green-400" />
                            ) : isNegative ? (
                              <ArrowUpRight className="w-4 h-4 text-red-400" />
                            ) : (
                              <Coins className="w-4 h-4 text-purple-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white capitalize">
                              {tx.type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tx.description || 'No description'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-white'
                          }`}>
                            {isPositive ? '+' : isNegative ? '-' : ''}{tx.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">coins</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}