import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { LayoutDashboard, Inbox, DollarSign, Gift, Bell, FileText, LogOut, ShieldAlert, Home, Calendar, CreditCard, Scale, Users, RefreshCw } from 'lucide-react';
import OfficerShiftCalendar from '../components/officer/OfficerShiftCalendar'
import ExecutiveIntakeList from './admin/components/shared/ExecutiveIntakeList'
import CashoutRequestsList from './admin/components/shared/CashoutRequestsList'
import GiftCardFulfillmentList from './admin/components/shared/GiftCardFulfillmentList'
import CriticalAlertsList from './admin/components/shared/CriticalAlertsList'
import ExecutiveReportsList from './admin/components/shared/ExecutiveReportsList'
import ManualCoinOrdersList from './admin/components/shared/ManualCoinOrdersList'

type TabId = 'intake' | 'cashouts' | 'giftcards' | 'alerts' | 'reports' | 'troll_town' | 'shifts' | 'manual_payments' | 'coin_sales' | 'appeals' | 'squad_economy'

export default function SecretaryConsole() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('intake')
  const [loading, setLoading] = useState(true)
  const [suspended, setSuspended] = useState(false)
  const [counts, setCounts] = useState({
    intake: 0,
    cashouts: 0,
    alerts: 0,
    manual_orders: 0,
    coin_sales: 0,
    squad_payouts: 0,
  })

  const fetchCounts = useCallback(async () => {
    try {
        const [intakeRes, cashoutRes, alertsRes, manualRes, coinSalesRes, squadPayoutRes] = await Promise.all([
            supabase.from('executive_intake').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_review']),
            supabase.from('payout_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('critical_alerts').select('id', { count: 'exact', head: true }).eq('resolved', false),
            supabase.from('manual_coin_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('coin_transactions').select('id', { count: 'exact', head: true }).eq('type', 'store_purchase'),
            supabase.from('squad_payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        
        setCounts({
            intake: intakeRes.count || 0,
            cashouts: cashoutRes.count || 0,
            alerts: alertsRes.count || 0,
            manual_orders: manualRes.count || 0,
            coin_sales: coinSalesRes.count || 0,
            squad_payouts: squadPayoutRes.count || 0,
        })
    } catch (e) {
        console.error("Error fetching counts", e)
    }
  }, [])

  const checkAccess = useCallback(async () => {
    if (!user) {
      navigate('/')
      return
    }

    try {
      // 1. Check if secretary
      const { data: secData, error: secError } = await supabase
        .from('secretary_assignments')
        .select('id')
        .eq('secretary_id', user.id)
        .maybeSingle()

      if (secError) throw secError
      
      if (!secData && profile?.role !== 'admin') {
        toast.error('Unauthorized access')
        navigate('/')
        return
      }

      // 2. Get privileges
      const { data: _privData, error: privError } = await supabase.rpc('get_effective_privileges')
      if (privError) {
        console.error('Privilege check failed', privError)
      } else {
        // Check suspension via privileges or profile
        if (profile?.is_officer_active === false) {
            setSuspended(true)
            toast.error('Your account is currently suspended. Actions are disabled.')
        }
      }

    } catch (error) {
      console.error('Access check failed:', error)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [user, navigate, profile])

  // Global UI Rules Implementation
  useEffect(() => {
    checkAccess()
    fetchCounts()
    
    const interval = window.setInterval(fetchCounts, 60_000)

    return () => { window.clearInterval(interval) }
  }, [checkAccess, fetchCounts])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white flex items-center justify-center text-slate-400">
        Verifying credentials...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-white flex text-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-purple-500" />
            Secretary Console
          </h1>
          <p className="text-xs text-slate-500 mt-2">Executive Operations</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton 
            active={activeTab === 'intake'} 
            onClick={() => setActiveTab('intake')}
            icon={<Inbox className="w-5 h-5" />}
            label="Intake Inbox"
            alert={counts.intake > 0}
            count={counts.intake}
          />
          <NavButton 
            active={activeTab === 'cashouts'} 
            onClick={() => setActiveTab('cashouts')}
            icon={<DollarSign className="w-5 h-5" />}
            label="Cashout Queue"
            alert={counts.cashouts > 0}
            count={counts.cashouts}
          />
          <NavButton 
            active={activeTab === 'manual_payments'} 
            onClick={() => setActiveTab('manual_payments')}
            icon={<CreditCard className="w-5 h-5" />}
            label="Manual Payments"
            alert={counts.manual_orders > 0}
            count={counts.manual_orders}
          />
          <NavButton
            active={activeTab === 'coin_sales'}
            onClick={() => setActiveTab('coin_sales')}
            icon={<DollarSign className="w-5 h-5" />}
            label="Coin Sales"
            alert={counts.coin_sales > 0}
            count={counts.coin_sales}
          />
          <NavButton 
            active={activeTab === 'giftcards'} 
            onClick={() => setActiveTab('giftcards')}
            icon={<Gift className="w-5 h-5" />}
            label="Gift Card Fulfillment"
          />
          <NavButton 
            active={activeTab === 'appeals'} 
            onClick={() => navigate('/admin/appeals')}
            icon={<Scale className="w-5 h-5" />}
            label="Transaction Appeals"
          />
          <NavButton 
            active={activeTab === 'alerts'} 
            onClick={() => setActiveTab('alerts')}
            icon={<Bell className="w-5 h-5" />}
            label="Critical Alerts"
            alert={counts.alerts > 0}
            count={counts.alerts}
          />
          <NavButton 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<FileText className="w-5 h-5" />}
            label="Report Builder"
          />
          <NavButton 
            active={activeTab === 'shifts'} 
            onClick={() => setActiveTab('shifts')}
            icon={<Calendar className="w-5 h-5" />}
            label="Officer Shifts"
          />
          <NavButton 
            active={activeTab === 'troll_town'} 
            onClick={() => setActiveTab('troll_town')}
            icon={<Home className="w-5 h-5" />}
            label="Troll Town Deeds"
          />
          <NavButton 
            active={activeTab === 'squad_economy'} 
            onClick={() => setActiveTab('squad_economy')}
            icon={<Users className="w-5 h-5" />}
            label="Squad Economy"
            alert={counts.squad_payouts > 0}
            count={counts.squad_payouts}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <img src={profile?.avatar_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" />
            <div>
              <p className="text-white text-sm font-medium">{profile?.username}</p>
              <p className="text-xs text-slate-500">Executive Secretary</p>
            </div>
          </div>
          {suspended && (
             <div className="bg-red-900/20 border border-red-500/50 p-2 rounded mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-300">Account Suspended</span>
             </div>
          )}
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" /> Exit Console
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto pointer-events-auto">
        {suspended && (
            <div className="absolute inset-0 z-50 pointer-events-none">
                <div className="bg-slate-950/50 absolute inset-0 backdrop-blur-[1px]" />
            </div>
        )}
        <div className={suspended ? 'opacity-50 pointer-events-none select-none' : ''}>
            {activeTab === 'intake' && <ExecutiveIntakeList viewMode="secretary" />}
            {activeTab === 'cashouts' && <CashoutRequestsList viewMode="secretary" />}
            {activeTab === 'manual_payments' && <ManualCoinOrdersList />}
            {activeTab === 'coin_sales' && <SecretaryCoinSalesList />}
            {activeTab === 'giftcards' && <GiftCardFulfillmentList viewMode="secretary" />}
            {activeTab === 'alerts' && <CriticalAlertsList viewMode="secretary" />}
            {activeTab === 'reports' && <ExecutiveReportsList viewMode="secretary" />}
            {activeTab === 'shifts' && <OfficerShiftCalendar title="All Officer Shifts" />}
            {activeTab === 'troll_town' && <SecretaryTrollTownDeeds />}
            {activeTab === 'squad_economy' && <SquadEconomyPanel />}
        </div>
      </div>
    </div>
  )
}

type DeedTransferView = {
  id: string
  property_id: string
  seller_user_id: string
  buyer_user_id: string
  sale_price: number
  deed_fee: number
  seller_net: number
  system_value_at_sale: number | null
  created_at: string
  seller_username?: string
  buyer_username?: string
}

const SecretaryCoinSalesList: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all'|'completed'|'pending'|'failed'>('all')

  const loadSales = async () => {
    setLoadingSales(true)
    try {
      const { data, error } = await supabase
        .from('coin_transactions')
        .select('id,user_id,amount,metadata,status,created_at')
        .eq('type', 'store_purchase')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) {
        throw error
      }

      const userIds = [...new Set((data || []).map(tx => tx.user_id).filter(Boolean))]
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from('user_profiles').select('id, username, square_card_id').in('id', userIds)
        : { data: [], error: null }
      if (profilesError) throw profilesError
      const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]))

      setTransactions((data || []).map((tx: any) => ({
        ...tx,
        username: profileMap.get(tx.user_id)?.username || 'Unknown',
        card_last4: profileMap.get(tx.user_id)?.square_card_id ? `•••• ${String(profileMap.get(tx.user_id)?.square_card_id).slice(-4)}` : 'N/A'
      })))
    } catch (err: any) {
      console.error('Failed to load coin sales:', err)
      toast.error(err?.message || 'Failed to load coin sales')
    } finally {
      setLoadingSales(false)
    }
  }

  useEffect(() => {
    loadSales()
  }, [])

  const filtered = transactions.filter((tx) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Coin Pack Sales</h2>
          <p className="text-sm text-slate-400">Showing payments for coin store purchases.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-white px-3 py-1 rounded"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={loadSales} className="text-sm px-3 py-1 bg-indigo-600 rounded">Refresh</button>
        </div>
      </div>
      {loadingSales ? (
        <div className="text-sm text-slate-400">Loading coin sales...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-slate-400">No coin sales found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500 uppercase text-xs">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Coins</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Card</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id} className="border-t border-slate-800">
                  <td className="px-2 py-2 text-slate-200">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="px-2 py-2 text-slate-200">{tx.username}</td>
                  <td className="px-2 py-2 text-slate-200">{tx.amount}</td>
                  <td className="px-2 py-2 text-slate-200">${tx.metadata?.amount_usd || '0.00'}</td>
                  <td className="px-2 py-2 text-slate-200">{tx.card_last4}</td>
                  <td className="px-2 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${tx.status === 'completed' ? 'bg-green-500/20 text-green-300' : tx.status === 'failed' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                      {tx.status || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const SecretaryTrollTownDeeds: React.FC = () => {
  const [rows, setRows] = useState<DeedTransferView[]>([])
  const [loading, setLoading] = useState(true)
  const [adminPoolBalance, setAdminPoolBalance] = useState<number | null>(null)
  const [filterSeller, setFilterSeller] = useState('')
  const [filterBuyer, setFilterBuyer] = useState('')
  const [filterMinPrice, setFilterMinPrice] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('deed_transfers')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)

        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST116' || error.code === 'PGRST106') {
            setRows([])
          } else {
            throw error
          }
        } else {
          const transfers = (data || []) as any[]
          const userIds = new Set<string>()
          transfers.forEach(row => {
            if (row.seller_user_id) userIds.add(row.seller_user_id)
            if (row.buyer_user_id) userIds.add(row.buyer_user_id)
          })

          let usernames = new Map<string, string>()
          if (userIds.size > 0) {
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('id, username')
              .in('id', Array.from(userIds))
            usernames = new Map(
              (profiles || []).map((p: any) => [p.id as string, p.username as string])
            )
          }

          const mapped: DeedTransferView[] = transfers.map(row => ({
            id: row.id,
            property_id: row.property_id,
            seller_user_id: row.seller_user_id,
            buyer_user_id: row.buyer_user_id,
            sale_price: Number(row.sale_price || 0),
            deed_fee: Number(row.deed_fee || 0),
            seller_net: Number(row.seller_net || 0),
            system_value_at_sale: row.system_value_at_sale
              ? Number(row.system_value_at_sale)
              : null,
            created_at: row.created_at,
            seller_username: usernames.get(row.seller_user_id) || undefined,
            buyer_username: usernames.get(row.buyer_user_id) || undefined
          }))
          setRows(mapped)
        }

        const { data: poolRow } = await supabase
          .from('admin_pool')
          .select('trollcoins_balance')
          .maybeSingle()
        if (poolRow) {
          setAdminPoolBalance(Number(poolRow.trollcoins_balance || 0))
        } else {
          setAdminPoolBalance(null)
        }
      } catch (error: any) {
        console.error('Failed to load Troll Town deeds', error)
        toast.error(error?.message || 'Failed to load Troll Town deeds')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredRows = rows.filter(row => {
    if (filterSeller) {
      const match = row.seller_username || ''
      if (!match.toLowerCase().includes(filterSeller.toLowerCase())) return false
    }
    if (filterBuyer) {
      const match = row.buyer_username || ''
      if (!match.toLowerCase().includes(filterBuyer.toLowerCase())) return false
    }
    if (filterMinPrice) {
      const min = Number(filterMinPrice)
      if (!Number.isNaN(min) && row.sale_price < min) return false
    }
    if (filterMaxPrice) {
      const max = Number(filterMaxPrice)
      if (!Number.isNaN(max) && row.sale_price > max) return false
    }
    if (filterStartDate) {
      const start = new Date(filterStartDate).getTime()
      if (new Date(row.created_at).getTime() < start) return false
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate).getTime()
      if (new Date(row.created_at).getTime() > end) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-400" />
            Troll Town Deeds
          </h2>
          <p className="text-xs text-slate-400">
            Read-only view of property transfers and deed fees.
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-slate-400">Admin Pool Balance</p>
          <p className="text-emerald-300 font-semibold">
            {adminPoolBalance === null
              ? '—'
              : `${adminPoolBalance.toLocaleString()} TrollCoins`}
          </p>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <input
            value={filterSeller}
            onChange={e => setFilterSeller(e.target.value)}
            placeholder="Filter by seller"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <input
            value={filterBuyer}
            onChange={e => setFilterBuyer(e.target.value)}
            placeholder="Filter by buyer"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <input
            value={filterMinPrice}
            onChange={e => setFilterMinPrice(e.target.value)}
            placeholder="Min price"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <input
            value={filterMaxPrice}
            onChange={e => setFilterMaxPrice(e.target.value)}
            placeholder="Max price"
            className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="flex-1 px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-900/90 sticky top-0 z-10">
                <tr className="text-slate-300">
                  <th className="px-3 py-2 text-left font-semibold">Date/Time</th>
                  <th className="px-3 py-2 text-left font-semibold">Property</th>
                  <th className="px-3 py-2 text-left font-semibold">Seller</th>
                  <th className="px-3 py-2 text-left font-semibold">Buyer</th>
                  <th className="px-3 py-2 text-right font-semibold">Sale Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Deed Fee</th>
                  <th className="px-3 py-2 text-right font-semibold">Seller Net</th>
                  <th className="px-3 py-2 text-right font-semibold">System Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      Loading deeds...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      No deed transfers found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(row => (
                    <tr
                      key={row.id}
                      className="border-t border-slate-800/80 hover:bg-slate-900/80"
                    >
                      <td className="px-3 py-2 text-slate-300">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        Home {row.property_id.slice(0, 6).toUpperCase()}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {row.seller_username || row.seller_user_id.slice(0, 6)}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {row.buyer_username || row.buyer_user_id.slice(0, 6)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-300">
                        {row.sale_price.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-yellow-300">
                        {row.deed_fee.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {row.seller_net.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">
                        {row.system_value_at_sale
                          ? row.system_value_at_sale.toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const SquadEconomyPanel: React.FC = () => {
  const [config, setConfig] = useState<any>({})
  const [stats, setStats] = useState<any>({})
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [cfgRes, squadsRes, membersRes, payoutsRes, ledgerRes] = await Promise.all([
        supabase.from('squad_config').select('*'),
        supabase.from('squads').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('squad_memberships').select('id', { count: 'exact', head: true }).is('left_at', null),
        supabase.from('squad_payouts').select('eligible_cents, fee_cents, net_cents, status'),
        supabase.from('squad_cash_ledger').select('amount_cents, status, type'),
      ])
      const cfgMap: Record<string, any> = {}
      ;(cfgRes.data || []).forEach((row: any) => { cfgMap[row.key] = row.value })
      setConfig(cfgMap)

      const pendingPayouts = (payoutsRes.data || []).filter((p: any) => p.status === 'pending')
      const paidPayouts = (payoutsRes.data || []).filter((p: any) => p.status === 'paid')
      setStats({
        activeSquads: squadsRes.count || 0,
        activeMembers: membersRes.count || 0,
        pendingPayouts: pendingPayouts.length,
        pendingPayoutUsd: pendingPayouts.reduce((a: number, p: any) => a + Number(p.net_cents), 0) / 100,
        paidPayouts: paidPayouts.length,
        paidPayoutUsd: paidPayouts.reduce((a: number, p: any) => a + Number(p.net_cents), 0) / 100,
        squadFeesUsd: (payoutsRes.data || []).reduce((a: number, p: any) => a + Number(p.fee_cents), 0) / 100,
        totalSquadCashCents: (ledgerRes.data || []).reduce((a: number, l: any) => a + Number(l.amount_cents), 0),
      })
    } catch (e: any) {
      console.error('SquadEconomy load', e)
      toast.error('Failed to load squad economy data')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { void load() }, [])

  const money = (n: number) => `$${n.toFixed(2)}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Squad Economy, Bank & Weekly Cashout Control</h2>
          <p className="text-sm text-slate-400">Configure and monitor Squad Cash, Bank cashout activity, and weekly payouts.</p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-900/20 hover:bg-cyan-800/30"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400 text-center py-8">Loading squad economy data…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Active Squads" value={String(stats.activeSquads)} color="text-cyan-300" />
            <StatCard label="Active Squad Members" value={String(stats.activeMembers)} color="text-white" />
            <StatCard label="Pending Squad Cash" value={money(stats.pendingPayoutUsd)} color="text-yellow-300" sub={`${stats.pendingPayouts} payouts`} />
            <StatCard label="Paid Squad Cash (USD)" value={money(stats.paidPayoutUsd)} color="text-emerald-300" sub={`${stats.paidPayouts} payouts`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <StatCard label="Squad Fees Collected" value={money(stats.squadFeesUsd)} color="text-purple-300" />
            <StatCard label="Total Squad Cash Ledger" value={money(stats.totalSquadCashCents / 100)} color="text-white" />
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-[#0f1018]/60 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Configured Weekly Payout Rules</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
              <div className="flex justify-between"><span>Squad Creation Fee</span><span className="text-white">{config.creation_fee_coins?.coins ?? 3000} TC</span></div>
              <div className="flex justify-between"><span>Squad Joining Fee</span><span className="text-white">{config.join_fee_coins?.coins ?? 100} TC</span></div>
              <div className="flex justify-between"><span>Leader Share / Platform Share</span><span className="text-white">50% / 50%</span></div>
              <div className="flex justify-between"><span>Member Stimulus</span><span className="text-white">{config.stimulus_pct?.basis_points ?? 250 / 100}%</span></div>
              <div className="flex justify-between"><span>Leader Cashout Reward</span><span className="text-white">{config.leader_reward_pct?.basis_points ?? 500 / 100}%</span></div>
              <div className="flex justify-between"><span>Squad Payout Fee</span><span className="text-white">{config.squad_payout_fee_pct?.basis_points ?? 200 / 100}%</span></div>
              <div className="flex justify-between"><span>Minimum Cashout Tier</span><span className="text-white">{config.min_cashout_tier_coins?.coins ?? 3500} TC</span></div>
              <div className="flex justify-between"><span>Payout Day of Week</span><span className="text-white">{config.payout_day_of_week?.day ?? 1}</span></div>
              <div className="flex justify-between"><span>Settlement Timezone</span><span className="text-white">{config.settlement_timezone?.timezone ?? 'UTC'}</span></div>
            </div>
            <p className="mt-3 text-[10px] text-slate-500">
              Changes are recorded with the responsible administrator and timestamps. Configuration never overrides the weekly payout hold or allows duplicate payouts.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

const StatCard = ({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) => (
  <div className={`rounded-xl border border-white/10 bg-[#0f1018]/60 p-3`}>
    <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
    <p className={`mt-1 font-black ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
)

const NavButton = ({ active, onClick, icon, label, alert, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; alert?: boolean; count?: number }) => (
  <button
    onClick={onClick}
    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all relative ${
      active
        ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/20'
        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
    }`}
  >
    {alert && !count && (
      <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
    )}
    {count !== undefined && count > 0 && (
       <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center border border-red-400">
         {count > 99 ? '99+' : count}
       </span>
    )}
    {icon}
    <span className="font-bold text-sm">{label}</span>
  </button>
)
