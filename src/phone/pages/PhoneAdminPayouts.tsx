import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Wallet,
  Search,
  RefreshCw,
  Check,
  X,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { neonCard, neonTextGradient } from '../phoneTheme'

interface PayoutRequest {
  id: string
  user_id: string
  username: string
  avatar_url: string | null
  requested_coins: number
  paypal_email: string | null
  status: string
  usd_amount: number | null
  paypal_fee: number | null
  net_amount: number | null
  requested_at: string
  processed_at: string | null
  completed_at: string | null
  rejected_reason: string | null
  total_earned_coins: number | null
  total_paid_out: number | null
}

interface Supporter {
  from_user_id: string
  username: string
  avatar_url: string | null
  total_coins: number
  tx_count: number
  last_sent_at: string
}

const STATUS_TABS = ['all', 'pending', 'approved', 'paid', 'rejected', 'failed'] as const
type StatusTab = (typeof STATUS_TABS)[number]

const statusColor: Record<string, string> = {
  pending: 'text-yellow-300 bg-yellow-500/10 border-yellow-400/30',
  approved: 'text-blue-300 bg-blue-500/10 border-blue-400/30',
  processing: 'text-purple-300 bg-purple-500/10 border-purple-400/30',
  paid: 'text-green-300 bg-green-500/10 border-green-400/30',
  completed: 'text-green-300 bg-green-500/10 border-green-400/30',
  rejected: 'text-red-300 bg-red-500/10 border-red-400/30',
  failed: 'text-red-300 bg-red-500/10 border-red-400/30',
}

const statusIcon: Record<string, JSX.Element> = {
  pending: <Clock className="h-3 w-3" />,
  approved: <CheckCircle className="h-3 w-3" />,
  processing: <RefreshCw className="h-3 w-3" />,
  paid: <DollarSign className="h-3 w-3" />,
  completed: <DollarSign className="h-3 w-3" />,
  rejected: <X className="h-3 w-3" />,
  failed: <AlertTriangle className="h-3 w-3" />,
}

export default function PhoneAdminPayouts() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const isAdmin = useMemo(
    () =>
      (profile?.role && ['admin', 'secretary'].includes(profile.role)) ||
      (profile?.troll_role && ['admin', 'secretary'].includes(profile.troll_role)) ||
      profile?.is_admin === true,
    [profile]
  )

  const [payouts, setPayouts] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<StatusTab>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<PayoutRequest | null>(null)
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [supportersLoading, setSupportersLoading] = useState(false)
  const [timeframe, setTimeframe] = useState<{ from: string; to: string } | null>(null)

  const loadPayouts = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)

      const { data, error } = await supabase
        .from('payout_dashboard')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setPayouts((data as PayoutRequest[]) || [])
    } catch (err: any) {
      console.error('PhoneAdminPayouts load error:', err)
      toast.error(err.message || 'Failed to load payouts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    void loadPayouts()
  }, [isAdmin])

  const loadSupporters = async (p: PayoutRequest) => {
    setSupportersLoading(true)
    setSupporters([])
    setTimeframe(null)
    try {
      const { data: prior, error: priorErr } = await supabase
        .from('payout_requests')
        .select('completed_at, paid_at, approved_at, requested_at, status')
        .eq('user_id', p.user_id)
        .neq('id', p.id)
        .in('status', ['paid', 'completed', 'approved'])
        .order('completed_at', { ascending: false })
        .limit(1)

      if (priorErr) console.warn('prior payout lookup:', priorErr.message)

      const lastPaid = prior?.[0]?.completed_at || prior?.[0]?.paid_at || prior?.[0]?.approved_at || null
      const fromIso = lastPaid || '1970-01-01T00:00:00Z'
      const toIso = p.requested_at

      setTimeframe({ from: fromIso, to: toIso })

      const { data: txs, error: txErr } = await supabase
        .from('coin_transactions')
        .select('from_user_id, to_user_id, amount, created_at, metadata')
        .eq('to_user_id', p.user_id)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false })
        .limit(500)

      if (txErr) throw txErr

      const txList = (txs as any[]) || []
      const incoming = txList.filter(
        (t) => t.to_user_id === p.user_id && t.from_user_id && t.from_user_id !== p.user_id
      )

      const byUser = new Map<string, Supporter>()
      for (const t of incoming) {
        const amt = Number(t.amount) || 0
        const cur = byUser.get(t.from_user_id)
        if (cur) {
          cur.total_coins += amt
          cur.tx_count += 1
          if (t.created_at > cur.last_sent_at) cur.last_sent_at = t.created_at
        } else {
          byUser.set(t.from_user_id, {
            from_user_id: t.from_user_id,
            username: '',
            avatar_url: null,
            total_coins: amt,
            tx_count: 1,
            last_sent_at: t.created_at,
          })
        }
      }

      const ids = Array.from(byUser.keys())
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', ids)
        for (const prof of profiles || []) {
          const s = byUser.get(prof.id)
          if (s) {
            s.username = prof.username || 'unknown'
            s.avatar_url = prof.avatar_url || null
          }
        }
      }

      const sorted = Array.from(byUser.values())
        .map((s) => ({ ...s, username: s.username || 'unknown' }))
        .sort((a, b) => b.total_coins - a.total_coins)
      setSupporters(sorted)
    } catch (err: any) {
      console.error('supporters load error:', err)
      toast.error(err.message || 'Failed to load supporters')
    } finally {
      setSupportersLoading(false)
    }
  }

  const openDetails = (p: PayoutRequest) => {
    setSelected(p)
    void loadSupporters(p)
  }

  const closeDetails = () => {
    setSelected(null)
    setSupporters([])
    setTimeframe(null)
  }

  const approveRequest = async (id: string) => {
    try {
      setBusyId(id)
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'approve_payout', requestId: id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      toast.success('Payout approved')
      await loadPayouts(true)
      if (selected?.id === id) setSelected({ ...selected, status: 'approved' })
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve')
    } finally {
      setBusyId(null)
    }
  }

  const rejectRequest = async (id: string) => {
    const reason = window.prompt('Rejection reason:')
    if (!reason) return
    try {
      setBusyId(id)
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'reject_payout', requestId: id, reason },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      toast.success('Payout rejected')
      await loadPayouts(true)
      if (selected?.id === id) setSelected({ ...selected, status: 'rejected', rejected_reason: reason })
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject')
    } finally {
      setBusyId(null)
    }
  }

  const markPaid = async (id: string) => {
    const ref = window.prompt('Payment reference (optional):') || null
    try {
      setBusyId(id)
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action: 'update_payout_status', payoutId: id, newStatus: 'paid', paymentReference: ref },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      toast.success('Marked as paid')
      await loadPayouts(true)
      if (selected?.id === id) setSelected({ ...selected, status: 'paid' })
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark paid')
    } finally {
      setBusyId(null)
    }
  }

  const paypalPayout = async (id: string) => {
    if (!window.confirm('Send this payout via PayPal?')) return
    try {
      setBusyId(id)
      const { data, error } = await supabase.functions.invoke('paypal-payout', {
        body: { payoutRequestId: id, adminId: profile?.id },
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'PayPal payout failed')
      toast.success('PayPal payout sent')
      await loadPayouts(true)
      if (selected?.id === id) setSelected({ ...selected, status: 'paid' })
    } catch (err: any) {
      toast.error(err.message || 'PayPal payout failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return payouts.filter((p) => {
      const matchStatus = tab === 'all' || p.status === tab
      const matchSearch =
        !q ||
        (p.username || '').toLowerCase().includes(q) ||
        (p.paypal_email || '').toLowerCase().includes(q)
      return matchStatus && matchSearch
    })
  }, [payouts, tab, search])

  const stats = useMemo(() => {
    const totalRequested = payouts.reduce((s, p) => s + (p.requested_coins || 0), 0)
    const totalPaid = payouts
      .filter((p) => p.status === 'paid' || p.status === 'completed')
      .reduce((s, p) => s + (p.requested_coins || 0), 0)
    const totalPending = payouts
      .filter((p) => ['pending', 'approved', 'processing'].includes(p.status))
      .reduce((s, p) => s + (p.requested_coins || 0), 0)
    const pendingCount = payouts.filter((p) => ['pending', 'approved'].includes(p.status)).length
    return { totalRequested, totalPaid, totalPending, pendingCount }
  }, [payouts])

  if (!isAdmin) {
    return (
      <div className="relative min-h-screen w-full bg-[#05010f] text-white">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className={`text-sm font-black uppercase tracking-widest ${neonTextGradient}`}>Payouts</h1>
          <div className="w-9" />
        </header>
        <main className="p-6 text-center text-sm text-zinc-400">
          Access denied. Admin privileges required.
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-[#05010f] text-white">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className={`text-sm font-black uppercase tracking-widest ${neonTextGradient}`}>Payouts</h1>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
          onClick={() => loadPayouts(true)}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
        </button>
      </header>

      <main className="space-y-4 p-4">
        <section className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Total Requested"
            value={stats.totalRequested.toLocaleString()}
            color="text-cyan-300"
          />
          <StatCard
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Pending"
            value={stats.totalPending.toLocaleString()}
            color="text-yellow-300"
            sub={`${stats.pendingCount} requests`}
          />
          <StatCard
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            label="Paid Out"
            value={stats.totalPaid.toLocaleString()}
            color="text-green-300"
          />
          <StatCard
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="Total"
            value={payouts.length.toString()}
            color="text-violet-300"
            sub="requests"
          />
        </section>

        <section className={`${neonCard} p-3`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username or PayPal email..."
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-400/40 focus:outline-none"
            />
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={cn(
                  'whitespace-nowrap rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition',
                  tab === s
                    ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200'
                    : 'border-white/10 bg-white/5 text-zinc-400'
                )}
              >
                {s}
                {s !== 'all' && (
                  <span className="ml-1 text-zinc-500">
                    ({payouts.filter((p) => p.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${neonCard} h-28 animate-pulse`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${neonCard} p-8 text-center`}>
            <Wallet className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">No payout requests found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <PayoutCard
                key={p.id}
                payout={p}
                busy={busyId === p.id}
                onApprove={() => approveRequest(p.id)}
                onReject={() => rejectRequest(p.id)}
                onMarkPaid={() => markPaid(p.id)}
                onPayPal={() => paypalPayout(p.id)}
                onOpen={() => openDetails(p)}
              />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <DetailsSheet
          payout={selected}
          supporters={supporters}
          supportersLoading={supportersLoading}
          timeframe={timeframe}
          busy={busyId === selected.id}
          onClose={closeDetails}
          onApprove={() => approveRequest(selected.id)}
          onReject={() => rejectRequest(selected.id)}
          onMarkPaid={() => markPaid(selected.id)}
          onPayPal={() => paypalPayout(selected.id)}
        />
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
  sub,
}: {
  icon: JSX.Element
  label: string
  value: string
  color: string
  sub?: string
}) {
  return (
    <div className={`${neonCard} p-3`}>
      <div className="flex items-center gap-1.5 text-zinc-400">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('mt-1 text-lg font-black', color)}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500">{sub}</div>}
    </div>
  )
}

function PayoutCard({
  payout,
  busy,
  onApprove,
  onReject,
  onMarkPaid,
  onPayPal,
  onOpen,
}: {
  payout: PayoutRequest
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onMarkPaid: () => void
  onPayPal: () => void
  onOpen: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const usd = payout.usd_amount ?? (payout.requested_coins ? payout.requested_coins * 0.005 : 0)

  return (
    <div className={`${neonCard} overflow-hidden`}>
      <button onClick={onOpen} className="w-full p-3 text-left">
        <div className="flex items-start gap-3">
          <img
            src={payout.avatar_url || '/default-avatar.png'}
            alt={payout.username}
            className="h-10 w-10 rounded-full border border-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-white">{payout.username}</span>
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase',
                  statusColor[payout.status] || statusColor.pending
                )}
              >
                {statusIcon[payout.status] || statusIcon.pending}
                {payout.status}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[10px] text-zinc-500">
              <span className="truncate">{payout.paypal_email || '—'}</span>
              <span>{new Date(payout.requested_at).toLocaleDateString()}</span>
            </div>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-zinc-500">Requested</div>
                <div className="text-sm font-black text-cyan-300">
                  {payout.requested_coins?.toLocaleString() || 0} coins
                </div>
                <div className="text-[10px] text-green-300">${Number(usd).toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wider text-zinc-500">Net</div>
                <div className="text-sm font-black text-green-300">
                  ${Number(payout.net_amount || usd).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </button>

      <div className="border-t border-white/5 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400"
        >
          {expanded ? 'Hide actions' : 'Quick actions'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {expanded && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {payout.status === 'pending' && (
              <>
                <ActionBtn color="blue" onClick={onPayPal} disabled={busy} icon={<DollarSign className="h-3 w-3" />}>
                  PayPal
                </ActionBtn>
                <ActionBtn color="green" onClick={onApprove} disabled={busy} icon={<Check className="h-3 w-3" />}>
                  Approve
                </ActionBtn>
                <ActionBtn color="red" onClick={onReject} disabled={busy} icon={<X className="h-3 w-3" />}>
                  Reject
                </ActionBtn>
                <ActionBtn color="purple" onClick={onOpen} icon={<Users className="h-3 w-3" />}>
                  View Supporters
                </ActionBtn>
              </>
            )}
            {payout.status === 'approved' && (
              <>
                <ActionBtn color="green" onClick={onMarkPaid} disabled={busy} icon={<DollarSign className="h-3 w-3" />}>
                  Mark Paid
                </ActionBtn>
                <ActionBtn color="red" onClick={onReject} disabled={busy} icon={<X className="h-3 w-3" />}>
                  Reject
                </ActionBtn>
                <ActionBtn color="purple" onClick={onOpen} icon={<Users className="h-3 w-3" />}>
                  View Supporters
                </ActionBtn>
              </>
            )}
            {['paid', 'completed', 'rejected', 'failed'].includes(payout.status) && (
              <div className="col-span-2">
                <ActionBtn color="purple" onClick={onOpen} icon={<Users className="h-3 w-3" />}>
                  View Supporters
                </ActionBtn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  color,
  onClick,
  disabled,
  icon,
  children,
}: {
  color: 'blue' | 'green' | 'red' | 'purple'
  onClick: () => void
  disabled?: boolean
  icon: JSX.Element
  children: React.ReactNode
}) {
  const palette: Record<string, string> = {
    blue: 'bg-blue-500/15 text-blue-200 border-blue-400/30 active:bg-blue-500/25',
    green: 'bg-green-500/15 text-green-200 border-green-400/30 active:bg-green-500/25',
    red: 'bg-red-500/15 text-red-200 border-red-400/30 active:bg-red-500/25',
    purple: 'bg-violet-500/15 text-violet-200 border-violet-400/30 active:bg-violet-500/25',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-bold transition disabled:opacity-50',
        palette[color]
      )}
    >
      {disabled ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
      {children}
    </button>
  )
}

function DetailsSheet({
  payout,
  supporters,
  supportersLoading,
  timeframe,
  busy,
  onClose,
  onApprove,
  onReject,
  onMarkPaid,
  onPayPal,
}: {
  payout: PayoutRequest
  supporters: Supporter[]
  supportersLoading: boolean
  timeframe: { from: string; to: string } | null
  busy: boolean
  onClose: () => void
  onApprove: () => void
  onReject: () => void
  onMarkPaid: () => void
  onPayPal: () => void
}) {
  const totalFromSupporters = supporters.reduce((s, x) => s + x.total_coins, 0)
  const usd = payout.usd_amount ?? (payout.requested_coins ? payout.requested_coins * 0.005 : 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-cyan-400/20 bg-[#0a0418] p-4 shadow-[0_-10px_40px_rgba(0,191,255,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-cyan-400/40" />
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-black text-white">Payout Details</h2>
            <p className="text-[10px] text-zinc-500">@{payout.username}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 p-1.5">
            <X size={14} />
          </button>
        </div>

        <div className={`${neonCard} mb-3 grid grid-cols-2 gap-3 p-3 text-xs`}>
          <Field label="Requested">{payout.requested_coins?.toLocaleString() || 0} coins</Field>
          <Field label="USD">${Number(usd).toFixed(2)}</Field>
          <Field label="Fee">${Number(payout.paypal_fee || 0).toFixed(2)}</Field>
          <Field label="Net">${Number(payout.net_amount || usd).toFixed(2)}</Field>
          <Field label="PayPal">{payout.paypal_email || '—'}</Field>
          <Field label="Status">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase',
                statusColor[payout.status] || statusColor.pending
              )}
            >
              {statusIcon[payout.status] || statusIcon.pending}
              {payout.status}
            </span>
          </Field>
          <Field label="Requested At">{new Date(payout.requested_at).toLocaleString()}</Field>
          <Field label="Earned / Paid Out">
            {payout.total_earned_coins?.toLocaleString() || 0} / {payout.total_paid_out?.toLocaleString() || 0}
          </Field>
        </div>

        {payout.rejected_reason && (
          <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">
            <strong>Rejection:</strong> {payout.rejected_reason}
          </div>
        )}

        <div className={`${neonCard} mb-3 p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-black text-white">Supporters in Timeframe</h3>
            </div>
            <span className="text-[10px] text-zinc-500">{supporters.length} users</span>
          </div>
          {timeframe && (
            <div className="mb-2 rounded-lg border border-white/5 bg-black/30 p-2 text-[10px] text-zinc-400">
              <div>
                <span className="text-zinc-500">From:</span> {new Date(timeframe.from).toLocaleString()}
              </div>
              <div>
                <span className="text-zinc-500">To:</span> {new Date(timeframe.to).toLocaleString()}
              </div>
            </div>
          )}
          {supportersLoading ? (
            <div className="flex items-center justify-center py-6 text-xs text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading supporters...
            </div>
          ) : supporters.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-500">No supporters found in this timeframe.</p>
          ) : (
            <>
              <div className="mb-2 grid grid-cols-3 gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-2 text-center text-[10px]">
                <div>
                  <div className="text-zinc-400">Supporters</div>
                  <div className="text-sm font-black text-cyan-200">{supporters.length}</div>
                </div>
                <div>
                  <div className="text-zinc-400">Total Coins</div>
                  <div className="text-sm font-black text-cyan-200">{totalFromSupporters.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-zinc-400">Requested</div>
                  <div className="text-sm font-black text-cyan-200">
                    {payout.requested_coins?.toLocaleString() || 0}
                  </div>
                </div>
              </div>
              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {supporters.map((s) => (
                  <div
                    key={s.from_user_id}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/20 p-2"
                  >
                    <img
                      src={s.avatar_url || '/default-avatar.png'}
                      alt={s.username}
                      className="h-7 w-7 rounded-full border border-white/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-white">@{s.username}</div>
                      <div className="text-[9px] text-zinc-500">
                        {s.tx_count} tx · {new Date(s.last_sent_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-green-300">{s.total_coins.toLocaleString()}</div>
                      <div className="text-[9px] text-zinc-500">coins</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {payout.status !== 'paid' && payout.status !== 'completed' && payout.status !== 'rejected' && (
          <div className="grid grid-cols-2 gap-2">
            {payout.status === 'pending' && (
              <ActionBtn color="blue" onClick={onPayPal} disabled={busy} icon={<DollarSign className="h-3 w-3" />}>
                PayPal
              </ActionBtn>
            )}
            {payout.status === 'pending' && (
              <ActionBtn color="green" onClick={onApprove} disabled={busy} icon={<Check className="h-3 w-3" />}>
                Approve
              </ActionBtn>
            )}
            {payout.status === 'approved' && (
              <ActionBtn color="green" onClick={onMarkPaid} disabled={busy} icon={<DollarSign className="h-3 w-3" />}>
                Mark Paid
              </ActionBtn>
            )}
            <ActionBtn color="red" onClick={onReject} disabled={busy} icon={<X className="h-3 w-3" />}>
              Reject
            </ActionBtn>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-xs font-bold text-white">{children}</div>
    </div>
  )
}
