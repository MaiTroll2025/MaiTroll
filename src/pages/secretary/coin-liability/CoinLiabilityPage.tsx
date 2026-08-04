import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../lib/store';
import { toast } from 'sonner';
import {
  Coins, DollarSign, Users, TrendingUp, AlertTriangle,
  Search, Filter, Download, ChevronRight, Loader2,
  Clock, CheckCircle, XCircle, AlertCircle, Info,
  Shield, Eye, ArrowUpRight, ArrowDownRight, RefreshCw,
  ChevronDown, ChevronUp, X, FileText, BarChart3,
  PieChart, Activity, DollarSign as DollarIcon,
  Zap, Target, Award, Gift, Send, RotateCcw,
  ShieldCheck, ShieldAlert, Ban, Clock4,
  Calendar, Hash, Mail, Tag, User as UserIcon,
  ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';

type CoinCategory = 'cashable_earned' | 'purchased_spending' | 'promotional' | 'mayor_promo' | 'test' | 'pending' | 'reversed' | 'already_cashed_out';

type SortField = 'cashable_coin_balance' | 'estimated_liability' | 'total_gifts_received' | 'last_transaction_date' | 'pending_payout_coins' | 'username';
type SortDir = 'asc' | 'desc';

type AlertStatus = 'open' | 'under_review' | 'resolved' | 'dismissed' | 'escalated';
type AlertType = 'cashout_threshold_reached' | 'cashout_tier_reached' | 'high_balance' | 'multiple_large_gifts' | 'payout_requested' | 'pending_payout_too_long' | 'approved_payout_unpaid' | 'balance_mismatch' | 'non_cashable_source' | 'refund_affects_gifted' | 'potential_self_gifting' | 'coordinated_manipulation';

interface SummaryData {
  total_cashable_coins: number;
  estimated_payout_liability: number;
  users_with_2000_plus: number;
  users_eligible_for_cashout: number;
  pending_payout_requests: number;
  approved_unpaid_payouts: number;
  paid_payouts_period: number;
  total_non_cashable_promo_coins: number;
  total_purchased_coins_sold: number;
}

interface UserRow {
  user_id: string;
  username: string;
  user_tag: string;
  role: string;
  is_active: boolean;
  cashable_coin_balance: number;
  non_cashable_coin_balance: number;
  total_gifts_received: number;
  total_purchased_coins: number;
  total_coins_sent: number;
  total_paid_out: number;
  pending_payout_coins: number;
  estimated_payout_value: number;
  highest_cashout_tier: string | null;
  next_cashout_tier: string | null;
  coins_needed_for_next_tier: number;
  last_gift_received_date: string | null;
  last_transaction_date: string | null;
  last_payout_request_date: string | null;
  review_status: string;
}

interface CashoutTier {
  coin_amount: number;
  cash_amount: number;
  currency: string;
  processing_fee_percentage: number;
  is_active: boolean;
}

interface LiabilityEstimate {
  immediate_eligible_liability: number;
  total_cashable_coin_exposure: number;
}

const CASHOUT_THRESHOLD = 2000;
const PAGE_SIZE = 25;
const AUTHORIZED_ROLES = ['admin', 'owner', 'ceo', 'secretary', 'executive_secretary', 'troll_city_secretary', 'troll_city_treasurer'];

function isAuthorized(profile: any): boolean {
  if (!profile) return false;
  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();
  return (
    profile.is_admin === true ||
    profile.is_superadmin === true ||
    profile.is_staff === true ||
    AUTHORIZED_ROLES.includes(role) ||
    AUTHORIZED_ROLES.includes(trollRole)
  );
}

export default function CoinLiabilityPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');
  const [sortBy, setSortBy] = useState<SortField>('cashable_coin_balance');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userTab, setUserTab] = useState<'transactions' | 'gifts_received' | 'gifts_sent' | 'purchases' | 'payouts' | 'adjustments'>('transactions');
  const [userDetailPage, setUserDetailPage] = useState(1);
  const [userDetailTotal, setUserDetailTotal] = useState(0);
  const [liability, setLiability] = useState<LiabilityEstimate | null>(null);
  const [cashoutTiers, setCashoutTiers] = useState<CashoutTier[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showRevenuePanel, setShowRevenuePanel] = useState(false);
  const [dateFilter, setDateFilter] = useState('30d');
  const [exportLoading, setExportLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = isAuthorized(profile);

  const fetchSummary = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_coin_liability_summary');
      if (error) throw error;
      if (data?.success && data.data) {
        setSummary(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching summary:', err);
      toast.error('Failed to load summary data');
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_coin_liability_page', {
        p_page: currentPage,
        p_page_size: PAGE_SIZE,
        p_search: search || null,
        p_filter: filter !== 'all' ? filter : null,
        p_sort_by: sortBy,
        p_sort_dir: sortDir
      });
      if (error) throw error;
      if (data?.success && data.data) {
        setUsers(data.data.data || []);
        setTotalUsers(data.data.total || 0);
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      toast.error('Failed to load user data');
    }
  }, [currentPage, search, filter, sortBy, sortDir]);

  const fetchLiability = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_coin_liability_summary');
      if (error) throw error;
      if (data?.success && data.data) {
        setLiability({
          immediate_eligible_liability: data.data.estimated_payout_liability || 0,
          total_cashable_coin_exposure: data.data.total_cashable_coins || 0
        });
      }
    } catch (err: any) {
      console.error('Error fetching liability:', err);
    }
  }, []);

  const fetchCashoutTiers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('cashout_tiers').select('*').eq('is_active', true).order('coin_amount', { ascending: true });
      if (error) throw error;
      setCashoutTiers(data || []);
    } catch (err: any) {
      console.error('Error fetching tiers:', err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_coin_liability_alerts', {
        p_page: 1,
        p_page_size: 50,
        p_status: 'open'
      });
      if (error) throw error;
      if (data?.success && data.data) {
        setAlerts(data.data.alerts || []);
      }
    } catch (err: any) {
      console.error('Error fetching alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchSummary(), fetchUsers(), fetchLiability(), fetchCashoutTiers(), fetchAlerts()]);
    setLoading(false);
  }, [fetchSummary, fetchUsers, fetchLiability, fetchCashoutTiers, fetchAlerts]);

  useEffect(() => {
    if (isAdmin) {
      loadAll();
    }
  }, [isAdmin, loadAll]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserDetail(selectedUser);
    }
  }, [selectedUser, userDetailPage]);

  const fetchUserDetail = async (userId: string) => {
    setUserDetailLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_cashout_eligibility', { p_user_id: userId });
      if (error) throw error;
      if (data?.success) {
        setUserDetail(data.data);
      }
    } catch (err: any) {
      console.error('Error fetching user detail:', err);
      toast.error('Failed to load user details');
    } finally {
      setUserDetailLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    fetchUsers();
  }, [fetchUsers]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_coin_liability_page', {
        p_page: 1,
        p_page_size: 10000,
        p_search: search || null,
        p_filter: filter !== 'all' ? filter : null,
        p_sort_by: sortBy,
        p_sort_dir: sortDir
      });
      if (error) throw error;

      const rows = data?.data?.data || [];
      const headers = ['Username', 'User Tag', 'Cashable Balance', 'Non-Cashable Balance', 'Estimated Liability', 'Eligible Tier', 'Pending Payout', 'Last Transaction', 'Account Status', 'Review Status'];
      const csvContent = [
        headers.join(','),
        ...rows.map((u: any) => [
          u.username,
          u.user_tag,
          u.cashable_coin_balance,
          u.non_cashable_coin_balance,
          u.estimated_payout_value,
          u.highest_cashout_tier || '',
          u.pending_payout_coins || 0,
          u.last_transaction_date || '',
          u.is_active ? 'Active' : 'Suspended',
          u.review_status || 'clear'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coin_liability_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error('Failed to export CSV');
    } finally {
      setExportLoading(false);
    }
  };

  const formatCoin = (value: number): string => {
    return value.toLocaleString();
  };

  const formatUSD = (value: number): string => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#05010a] text-white flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">You do not have permission to access the Coin Liability dashboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05010a] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05010a] text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Coin Liability Dashboard</h1>
            <p className="text-slate-400 mt-1">Track cashable balances, payout liability, and coin exposure across all users.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadAll}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-medium text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              {exportLoading ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Alerts Banner */}
        {alerts.length > 0 && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-red-300">Coin Liability Alerts</h3>
              <span className="text-xs text-red-400 ml-auto">{alerts.length} active</span>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {alerts.slice(0, 5).map((alert: any) => (
                <div key={alert.id} className="flex items-center gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    alert.severity === 'critical' ? 'bg-red-600/20 text-red-300' :
                    alert.severity === 'high' ? 'bg-orange-600/20 text-orange-300' :
                    alert.severity === 'medium' ? 'bg-yellow-600/20 text-yellow-300' :
                    'bg-slate-600/20 text-slate-300'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-slate-300 flex-1">{alert.description}</span>
                  <span className="text-xs text-slate-500">{new Date(alert.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <SummaryCard
              label="Total Cashable Coins"
              value={formatCoin(summary.total_cashable_coins)}
              icon={<Coins className="w-5 h-5 text-blue-400" />}
              color="text-blue-400"
            />
            <SummaryCard
              label="Estimated Payout Liability"
              value={formatUSD(summary.estimated_payout_liability)}
              icon={<DollarSign className="w-5 h-5 text-red-400" />}
              color="text-red-400"
            />
            <SummaryCard
              label="Users with 2,000+ Coins"
              value={String(summary.users_with_2000_plus)}
              icon={<Target className="w-5 h-5 text-yellow-400" />}
              color="text-yellow-400"
            />
            <SummaryCard
              label="Eligible for Cash Out"
              value={String(summary.users_eligible_for_cashout)}
              icon={<Zap className="w-5 h-5 text-green-400" />}
              color="text-green-400"
            />
            <SummaryCard
              label="Pending Payout Requests"
              value={String(summary.pending_payout_requests)}
              icon={<Clock className="w-5 h-5 text-orange-400" />}
              color="text-orange-400"
            />
            <SummaryCard
              label="Approved Unpaid Payouts"
              value={String(summary.approved_unpaid_payouts)}
              icon={<CheckCircle className="w-5 h-5 text-purple-400" />}
              color="text-purple-400"
            />
            <SummaryCard
              label="Paid Payouts (Period)"
              value={String(summary.paid_payouts_period)}
              icon={<Award className="w-5 h-5 text-emerald-400" />}
              color="text-emerald-400"
            />
            <SummaryCard
              label="Non-Cashable Promo Coins"
              value={formatCoin(summary.total_non_cashable_promo_coins)}
              icon={<Ban className="w-5 h-5 text-slate-400" />}
              color="text-slate-400"
            />
            <SummaryCard
              label="Purchased Coins Sold"
              value={formatCoin(summary.total_purchased_coins_sold)}
              icon={<Gift className="w-5 h-5 text-pink-400" />}
              color="text-pink-400"
            />
          </div>
        )}

        {/* Liability Section */}
        {liability && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Estimated Platform Liability
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <h3 className="text-sm font-semibold text-slate-400 mb-2">Immediate Eligible Liability</h3>
                <p className="text-2xl font-bold text-red-400">{formatUSD(liability.immediate_eligible_liability)}</p>
                <p className="text-xs text-slate-500 mt-1">Sum of what users could request now based on their current eligible tiers.</p>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
                <h3 className="text-sm font-semibold text-slate-400 mb-2">Total Cashable Coin Exposure</h3>
                <p className="text-2xl font-bold text-orange-400">{formatUSD(liability.total_cashable_coin_exposure)}</p>
                <p className="text-xs text-slate-500 mt-1">Estimated liability represented by all cashable coins, including balances below the minimum cash-out tier.</p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by username, tag, email, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <select
                value={filter}
                onChange={(e) => handleFilterChange(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
              >
                <option value="all">All Users</option>
                <option value="high_balance">High Balance (2,000+)</option>
                <option value="eligible_for_cashout">Eligible for Cash Out</option>
                <option value="below_first_tier">Below First Tier</option>
                <option value="pending_payout">Pending Payout</option>
                <option value="approved_payout">Approved Payout</option>
                <option value="paid_payout">Paid Payout</option>
                <option value="suspended">Suspended Account</option>
                <option value="non_cashable_only">Non-Cashable Coins Only</option>
                <option value="no_recent_activity">No Recent Activity</option>
              </select>
            </div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* User Balance Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-right font-medium cursor-pointer hover:text-white" onClick={() => handleSort('cashable_coin_balance')}>
                    Cashable Balance {sortBy === 'cashable_coin_balance' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Non-Cashable</th>
                  <th className="px-4 py-3 text-right font-medium">Gifts</th>
                  <th className="px-4 py-3 text-right font-medium">Purchased</th>
                  <th className="px-4 py-3 text-right font-medium">Paid Out</th>
                  <th className="px-4 py-3 text-right font-medium">Pending Payout</th>
                  <th className="px-4 py-3 text-right font-medium">Est. Liability</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => { setSelectedUser(u.user_id); setUserDetailPage(1); }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-white font-medium">{u.username}</div>
                          <div className="text-xs text-slate-500">@{u.user_tag}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">{formatCoin(u.cashable_coin_balance)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCoin(u.non_cashable_coin_balance)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCoin(u.total_gifts_received)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCoin(u.total_purchased_coins)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCoin(u.total_paid_out)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.pending_payout_coins > 0 ? (
                        <span className="text-orange-400 font-medium">{formatCoin(u.pending_payout_coins)}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">{formatCoin(u.estimated_payout_value)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalUsers > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, totalUsers)} of {totalUsers}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-sm disabled:opacity-50 hover:bg-slate-700 transition"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">{currentPage}</span>
                <button
                  onClick={() => setCurrentPage(Math.min(Math.ceil(totalUsers / PAGE_SIZE), currentPage + 1))}
                  disabled={currentPage >= Math.ceil(totalUsers / PAGE_SIZE)}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-sm disabled:opacity-50 hover:bg-slate-700 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Detail Drawer */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
            <div
              className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-white">User Detail</h2>
                <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {userDetailLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              ) : userDetail ? (
                <div className="p-6 space-y-6">
                  {/* Balance Overview */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Balance Overview</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <DetailCard label="Cashable Balance" value={formatCoin(userDetail.data?.cashable_coin_balance || 0)} color="text-blue-400" />
                      <DetailCard label="Non-Cashable Balance" value={formatCoin(userDetail.data?.non_cashable_balance || 0)} color="text-slate-400" />
                      <DetailCard label="Purchased Coin Balance" value={formatCoin(userDetail.data?.purchased_coin_balance || 0)} color="text-green-400" />
                      <DetailCard label="Promotional Balance" value={formatCoin(userDetail.data?.promotional_balance || 0)} color="text-purple-400" />
                      <DetailCard label="Pending Balance" value={formatCoin(userDetail.data?.pending_balance || 0)} color="text-orange-400" />
                      <DetailCard label="Estimated Liability" value={formatUSD(userDetail.data?.estimated_liability || 0)} color="text-red-400" />
                    </div>
                  </div>

                  {/* Cash-Out Eligibility */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Cash-Out Eligibility</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <DetailCard label="Eligible" value={userDetail.data?.currently_eligible ? 'Yes' : 'No'} color={userDetail.data?.currently_eligible ? 'text-green-400' : 'text-red-400'} />
                      <DetailCard label="Identity Verified" value={userDetail.data?.identity_verification_required ? 'Required' : 'Complete'} color={userDetail.data?.identity_verification_required ? 'text-orange-400' : 'text-green-400'} />
                      <DetailCard label="Payout Method" value={userDetail.data?.payout_method_present ? 'Present' : 'Missing'} color={userDetail.data?.payout_method_present ? 'text-green-400' : 'text-red-400'} />
                    </div>
                  </div>

                  {/* Cash-Out Tiers */}
                  {cashoutTiers.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Available Cash-Out Tiers</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-800">
                              <th className="px-3 py-2 text-left">Tier</th>
                              <th className="px-3 py-2 text-right">Coins Required</th>
                              <th className="px-3 py-2 text-right">Cash Value</th>
                              <th className="px-3 py-2 text-right">Coins Needed</th>
                              <th className="px-3 py-2 text-right">Est. Remaining</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cashoutTiers.map((tier) => {
                              const balance = userDetail.data?.cashable_coin_balance || 0;
                              const eligible = balance >= tier.coin_amount;
                              const remaining = balance - tier.coin_amount;
                              return (
                                <tr key={tier.coin_amount} className={`border-b border-slate-800/50 ${eligible ? 'bg-green-950/20' : 'bg-slate-950'}`}>
                                  <td className="px-3 py-2 text-white">{eligible ? 'Eligible' : 'Not Yet'}</td>
                                  <td className="px-3 py-2 text-right text-white font-mono">{formatCoin(tier.coin_amount)}</td>
                                  <td className="px-3 py-2 text-right text-green-400 font-mono">{formatUSD(tier.cash_amount)}</td>
                                  <td className="px-3 py-2 text-right text-slate-400 font-mono">{eligible ? 0 : formatCoin(tier.coin_amount - balance)}</td>
                                  <td className="px-3 py-2 text-right text-slate-300 font-mono">{eligible ? formatCoin(remaining) : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Transaction Tabs */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Transaction History</h3>
                    <div className="flex gap-2 mb-4 border-b border-slate-700">
                      {(['transactions', 'gifts_received', 'gifts_sent', 'purchases', 'payouts', 'adjustments'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setUserTab(tab)}
                          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            userTab === tab
                              ? 'border-purple-400 text-purple-400'
                              : 'border-transparent text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800">
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-right">Cashable</th>
                            <th className="px-3 py-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                              Transaction history loading...
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-500">
                  <p>No detail data available for this user.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={color}>{icon}</div>
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function DetailCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}