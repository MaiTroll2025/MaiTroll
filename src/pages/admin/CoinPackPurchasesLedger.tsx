// src/pages/admin/CoinPackPurchasesLedger.tsx
//
// AUDIT / REPORTING PAGE — READ ONLY
// Merges two sources so every PayPal purchase appears exactly once:
//
//   Source A : paypal_transactions             — dedicated PayPal audit table
//              (authoritative PayPal order data, coins, status, amount)
//   Source B : coin_transactions               — legacy / all-provider event log
//              (usd_amount backfill for older PayPal rows not in paypal_transactions)
//
//   Dedup key : paypal_order_id (unique) — no merging needed for paypal_transactions rows.
//   Filter    : provider = 'paypal' only.
//
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { supabase, hasRole } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  Download, Search, DollarSign, Coins, CreditCard,
  Filter, Calendar, ShieldCheck, AlertTriangle, StickyNote, Upload,
  X, Upload as UploadIcon, Trash2, Save, FolderOpen, Eye,
  Users
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

type CoinPurchaseStatus = 'completed' | 'credited' | 'paid' | 'pending' | 'failed' | 'refunded' | 'canceled'

interface PayPalLedgerRow {
  id: string
  purchaseDate: string
  userId: string
  realName: string | null
  email: string | null
  username: string | null
  displayName: string | null
  coinsPurchased: number
  amountPaid: number
  currency: string
  paypalOrderId: string | null
  paypalCaptureId: string | null
  status: CoinPurchaseStatus
  source: 'paypal_transactions' | 'coin_transactions'
  createdAt: string
  notes?: string | null
}

interface PurchaseNote {
  id: string
  purchaseId: string
  body: string
  createdAt: string
  updatedAt: string
}

interface FileAttachment {
  id: string
  purchaseId: string
  name: string
  type: string
  size: number
  dataUrl: string
  uploadedAt: string
}

type FilterDateRange = { start: string; end: string }

const LS_NOTES_KEY = 'tc_purchase_ledger_notes'
const LS_FILES_KEY = 'tc_purchase_ledger_files'

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function uid() {
  return `__${Date.now()}__${Math.random().toString(36).slice(2, 8)}`
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function saveLS<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val))
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number) {
  if (isNaN(n) || n == null) return '$0.00'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCoins(n: number) {
  return n.toLocaleString('en-US') + ' 🪙'
}

function buildRealName(p: any): string | null {
  if (!p) return null
  if (typeof p.legal_full_name === 'string' && p.legal_full_name.trim()) {
    return p.legal_full_name.trim()
  }
  if (p.full_name?.trim()) return p.full_name.trim()
  return null
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300',
  credited: 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300',
  paid: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300',
  pending: 'bg-amber-500/15 border-amber-400/30 text-amber-300',
  failed: 'bg-red-500/18 border-red-400/30 text-red-300',
  refunded: 'bg-purple-500/15 border-purple-400/30 text-purple-300',
  canceled: 'bg-slate-500/15 border-slate-400/25 text-slate-300',
  cancelled: 'bg-slate-500/15 border-slate-400/25 text-slate-300',
}

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ════════════════════════════════════════════════════════════════════════════
// STAT CARD
// ════════════════════════════════════════════════════════════════════════════

const StatCard: React.FC<{
  label: string; value: React.ReactNode; sub?: string
  icon: React.ReactNode; accent?: string; glow?: 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink'
}> = ({ label, value, sub, icon, accent = 'text-cyan-200', glow }) => {
  const glowStyle: React.CSSProperties | undefined = glow
    ? { boxShadow: `0 0 22px rgba(${glow === 'cyan' ? '45,212,191' : glow === 'green' ? '52,211,153' : glow === 'amber' ? '251,191,36' : glow === 'red' ? '244,63,94' : glow === 'purple' ? '167,139,250' : '236,72,153'},0.26), inset 0 0 10px rgba(${glow === 'cyan' ? '45,212,191' : glow === 'green' ? '52,211,153' : glow === 'amber' ? '251,191,36' : glow === 'red' ? '244,63,94' : glow === 'purple' ? '167,139,250' : '236,72,153'},0.06)` }
    : undefined
  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm transition-all hover:border-white/20" style={glowStyle}>
      <div className="flex items-center gap-2 mb-2">
        <span className={accent}>{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      {sub && <p className="text-[10px] font-medium text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const ActionButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'ghost'; icon?: React.ReactNode }
> = ({ children, variant = 'primary', icon, className = '', ...props }) => {
  const base = 'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-200'
  const variants = {
    primary: 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/35 hover:border-cyan-400/50 hover:shadow-[0_0_14px_rgba(45,212,191,0.22)]',
    danger: 'bg-red-500/15 border border-red-400/25 text-red-200 hover:bg-red-500/30 hover:border-red-400/45',
    ghost: 'bg-white/[0.04] border border-white/10 text-slate-300 hover:border-white/20 hover:text-white disabled:opacity-40',
  }
  return (
    <button type="button" className={cx(base, variants[variant], className)} {...props}>
      {icon}{children}
    </button>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-purple-300">{icon}</span>
      <h2 className="text-base font-black uppercase tracking-[0.12em] text-purple-100/80">{label}</h2>
      <span className="flex-1 h-px bg-gradient-to-r from-purple-400/30 via-cyan-400/15 to-transparent" />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function CoinPackPurchasesLedger() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const allowed = useMemo(() => hasRole(profile, ['admin', 'ceo'] as any), [profile])

  useEffect(() => {
    if (!allowed) {
      toast.error('Admin or CEO access only')
      navigate('/', { replace: true })
    }
  }, [allowed, navigate])

  const [rows, setRows] = useState<PayPalLedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<FilterDateRange>({ start: '', end: '' })
  const [notes, setNotes] = useState<PurchaseNote[]>(() => loadLS(LS_NOTES_KEY, []))
  const [files, setFiles] = useState<FileAttachment[]>(() => loadLS(LS_FILES_KEY, []))
  const [showNotePanel, setShowNotePanel] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteTargetPurchaseId, setNoteTargetPurchaseId] = useState<string | null>(null)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [selectedPurchaseForUpload, setSelectedPurchaseForUpload] = useState<string | null>(null)
  const [uploadPreview, setUploadPreview] = useState<{ name: string; type: string; data: string } | null>(null)
  const [_refreshing, setRefreshing] = useState(false)

  useEffect(() => { saveLS(LS_NOTES_KEY, notes) }, [notes])
  useEffect(() => { saveLS(LS_FILES_KEY, files) }, [files])

  // ════════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ════════════════════════════════════════════════════════════════════════

  const loadPurchases = useCallback(async () => {
    if (!allowed) return
    try {
      setLoading(true)

      // ── Source A: paypal_transactions (DEDICATED PAYPAL TABLE) ──────────
      // Source B: coin_transactions (legacy PayPal rows not in paypal_tx).
      // No inline joins — profiles fetched separately to avoid schema cache errors.
      const [
        { data: paypalData, error: paypalErr },
        { data: coinTxData, error: coinTxErr },
      ] = await Promise.all([
        supabase
          .from('paypal_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5000),

        supabase
          .from('coin_transactions')
          .select('*')
          .or(
            'type.ilike.%paypal%,source.ilike.%paypal%,paypal_order_id.not.is.null,paypal_capture_id.not.is.null'
          )
          .order('created_at', { ascending: false })
          .limit(5000),
      ])

      if (paypalErr) throw paypalErr
      if (coinTxErr) console.warn('[Ledger] coin_transactions query issue:', coinTxErr.message)

      const paypalRows = (paypalData ?? []) as any[]
      const coinTxRows = (coinTxData ?? []) as any[]

      // ── Dedup: paypal_order_ids already in paypal_transactions ──────────
      const paypalOrderIds = new Set<string>(
        paypalRows.map(r => r.paypal_order_id).filter(Boolean)
      )

      // ── Bulk-fetch all user profiles from both sources ──────────────────
      const allUserIds = new Set<string>()
      for (const r of paypalRows) if (r.user_id) allUserIds.add(r.user_id)
      for (const r of coinTxRows) if (r.user_id) allUserIds.add(r.user_id)

      const profilesMap = new Map<string, any>()
      const userIdArr = [...allUserIds]
      if (userIdArr.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, username, display_name, full_name, email')
          .in('id', userIdArr)
        if (profilesError) throw profilesError
        for (const p of (profiles ?? [])) profilesMap.set(p.id, p)

        const { data: taxProfiles, error: taxProfilesError } = await supabase
          .from('user_tax_info')
          .select('user_id, legal_full_name')
          .in('user_id', userIdArr)
        if (taxProfilesError) throw taxProfilesError
        for (const taxProfile of taxProfiles ?? []) {
          const current = profilesMap.get(taxProfile.user_id) || {}
          if (typeof taxProfile.legal_full_name === 'string' && taxProfile.legal_full_name.trim()) {
            profilesMap.set(taxProfile.user_id, { ...current, legal_full_name: taxProfile.legal_full_name })
          }
        }
      }

      const getProfile = (uid: string) => profilesMap.get(uid) || {}

      // ── Build rows ──────────────────────────────────────────────────────
      const outRows: PayPalLedgerRow[] = []

      for (const pt of paypalRows) {
        const p = getProfile(pt.user_id)
        outRows.push({
          id: `pt:${pt.id}`,
          purchaseDate: pt.created_at ?? '',
          userId: pt.user_id,
          realName: buildRealName(p),
          email: p.email ?? null,
          username: p.username ?? null,
          displayName: p.display_name ?? p.username ?? null,
          coinsPurchased: Number(pt.coins ?? 0),
          amountPaid: Number(pt.amount ?? 0),
          currency: pt.currency || 'USD',
          paypalOrderId: pt.paypal_order_id ?? null,
          paypalCaptureId: pt.paypal_capture_id ?? null,
          status: (pt.status ?? 'completed') as CoinPurchaseStatus,
          source: 'paypal_transactions',
          createdAt: pt.created_at ?? '',
          notes: null,
        })
      }

      for (const tx of coinTxRows) {
        if (tx.paypal_order_id && paypalOrderIds.has(tx.paypal_order_id)) continue

        const p = getProfile(tx.user_id)
        const amountPaid = ((): number => {
          const a = Number(tx.usd_amount ?? 0)
          if (a > 0) return a
          const b = Number(tx.amount_usd ?? 0)
          if (b > 0) return b
          return Number(tx.metadata?.amount_paid ?? tx.metadata?.amount_usd ?? tx.metadata?.total ?? tx.metadata?.amount ?? 0)
        })()

        outRows.push({
          id: `ctx:${tx.id}`,
          purchaseDate: tx.transaction_date || tx.created_at,
          userId: tx.user_id,
          realName: buildRealName(p),
          email: p.email ?? null,
          username: p.username ?? null,
          displayName: p.display_name ?? p.username ?? null,
          coinsPurchased: Number(tx.coin_amount ?? tx.amount ?? 0),
          amountPaid,
          currency: 'USD',
          paypalOrderId: tx.paypal_order_id ?? null,
          paypalCaptureId: tx.paypal_capture_id ?? null,
          status: (tx.status ?? 'completed') as CoinPurchaseStatus,
          source: 'coin_transactions',
          createdAt: tx.created_at,
          notes: tx.metadata?.note_suggested ?? tx.metadata?.notes ?? null,
        })
      }

      outRows.sort(
        (a, b) => new Date(b.purchaseDate ?? '').getTime() -
                 new Date(a.purchaseDate ?? '').getTime()
      )
      setRows(outRows)
    } catch (error: any) {
      console.error('[Ledger] Failed to load purchases:', error)
      toast.error(`Load failed: ${error.message ?? error}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [allowed])

  useEffect(() => {
    if (!allowed) return
    loadPurchases()
  }, [allowed, loadPurchases])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadPurchases()
  }, [loadPurchases])

  // ════════════════════════════════════════════════════════════════════════
  // FILTERS
  // ════════════════════════════════════════════════════════════════════════

  const filtered = useMemo(() => {
    let list = rows
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter)
    if (dateRange.start) list = list.filter(p => p.purchaseDate >= dateRange.start)
    if (dateRange.end) {
      const endDate = new Date(dateRange.end)
      endDate.setHours(23, 59, 59, 999)
      list = list.filter(p => new Date(p.purchaseDate) <= endDate)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        (p.realName ?? '').toLowerCase().includes(q) ||
        (p.username ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.userId ?? '').toLowerCase().includes(q) ||
        (p.paypalOrderId ?? '').toLowerCase().includes(q) ||
        (p.paypalCaptureId ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [rows, statusFilter, dateRange, search])

  const stats = useMemo(() => {
    const completed = filtered.filter(p => p.status === 'completed' || p.status === 'credited' || p.status === 'paid')
    const totalRevenue = completed.reduce((s, p) => s + p.amountPaid, 0)
    const totalCoins = completed.reduce((s, p) => s + p.coinsPurchased, 0)
    const totalCompleted = completed.length
    const uniqueBuyers = new Set(completed.map(p => p.userId)).size
    const missingNames = filtered.filter(p => !p.realName).length
    const failed = filtered.filter(p => ['failed', 'refunded', 'canceled', 'cancelled'].includes(p.status)).length
    const fromPaypalTable = filtered.filter(p => p.source === 'paypal_transactions').length
    const fromCoinTx = filtered.filter(p => p.source === 'coin_transactions').length
    return { totalRevenue, totalCoins, totalCompleted, uniqueBuyers, missingNames, failed, fromPaypalTable, fromCoinTx, totalDisplayed: filtered.length }
  }, [filtered])

  // ════════════════════════════════════════════════════════════════════════
  // CSV EXPORT
  // ════════════════════════════════════════════════════════════════════════

  const exportCSV = useCallback(() => {
    const headers = [
      'Purchase Date', 'Real Name', 'Email', 'User ID',
      'Username', 'Display Name', 'Coins Purchased',
      'Amount Paid (USD)', 'Currency', 'PayPal Order ID',
      'PayPal Capture ID', 'Status', 'Source Table', 'Created At',
    ]
    const csvRows = filtered.map(p => [
      p.purchaseDate ?? '',
      p.realName ?? 'MISSING REAL NAME',
      p.email ?? '',
      p.userId,
      p.username ?? '',
      p.displayName ?? '',
      p.coinsPurchased,
      p.amountPaid.toFixed(2),
      p.currency,
      p.paypalOrderId ?? '',
      p.paypalCaptureId ?? '',
      p.status,
      p.source,
      p.createdAt,
    ])
    const csv = [headers, ...csvRows.map(r => r.map(c => `"${c}"`))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paypal_purchase_ledger_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Ledger exported to CSV')
  }, [filtered])

  // ════════════════════════════════════════════════════════════════════════
  // NOTES
  // ════════════════════════════════════════════════════════════════════════

  const addNoteForPurchase = (purchaseId: string) => {
    if (!noteBody.trim()) { toast.error('Write a note first'); return }
    setNotes(prev => [{
      id: uid(), purchaseId, body: noteBody.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, ...prev])
    setNoteBody('')
    setNoteTargetPurchaseId(null)
    setShowNotePanel(false)
    toast.success('Note added')
  }

  const notesForPurchase = (purchaseId: string) => notes.filter(n => n.purchaseId === purchaseId)
  const deleteNote = (noteId: string) => { setNotes(prev => prev.filter(n => n.id !== noteId)) }

  // ════════════════════════════════════════════════════════════════════════
  // FILE ATTACHMENTS
  // ════════════════════════════════════════════════════════════════════════

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = reject
      r.readAsDataURL(file)
    })

  const handleAttachmentUpload = async () => {
    if (!uploadPreview || !selectedPurchaseForUpload) return
    if (uploadPreview.data.length > 10 * 1024 * 1024) { toast.error('Max 10 MB'); return }
    const fa: FileAttachment = {
      id: uid(),
      purchaseId: selectedPurchaseForUpload,
      name: uploadPreview.name,
      type: uploadPreview.type,
      size: Math.round(uploadPreview.data.length * 3 / 4),
      dataUrl: uploadPreview.data,
      uploadedAt: new Date().toISOString(),
    }
    setFiles(prev => [fa, ...prev])
    toast.success(`"${uploadPreview.name}" attached`)
    setUploadPreview(null)
    setShowFileUpload(false)
    setSelectedPurchaseForUpload(null)
  }

  const _deleteAttachment = (id: string) => { setFiles(prev => prev.filter(f => f.id !== id)) }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════

  if (!allowed) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050A14] via-[#08101F] to-[#0A0514] text-white p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ── Page Title ── */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-400 bg-clip-text text-transparent">
            Coin Purchase Ledger — PayPal
          </h1>
          <p className="text-sm text-slate-400">
            PayPal coin purchase audit trail — provider: <span className="text-cyan-300 font-bold">paypal</span>{' '}
            — read-only reporting.
            <span className="text-purple-300 font-bold ml-1">Admin / CEO only. No wallet changes.</span>
          </p>
        </div>

        {/* ──── STATS ──── */}
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} sub={`${stats.totalCompleted} completed`} icon={<DollarSign size={16} />} accent="text-emerald-200" glow="green" />
          <StatCard label="Coins Sold" value={formatCoins(stats.totalCoins)} icon={<Coins size={16} />} accent="text-yellow-300" />
          <StatCard label="PayPal Table" value={stats.fromPaypalTable} sub="paypal_transactions" icon={<CreditCard size={16} />} accent="text-cyan-200" glow="cyan" />
          <StatCard label="Legacy Rows" value={stats.fromCoinTx} sub="coin_transactions" icon={<CreditCard size={16} />} accent="text-amber-200" />
          <StatCard label="Unique Buyers" value={stats.uniqueBuyers} icon={<Users size={16} />} accent="text-blue-200" />
          <StatCard label="Missing Names" value={stats.missingNames} sub={stats.missingNames > 0 ? 'needs backfill' : 'all named'} icon={<AlertTriangle size={16} />} accent={stats.missingNames > 0 ? 'text-amber-300' : 'text-emerald-300'} glow={stats.missingNames > 0 ? 'amber' : 'green'} />
          <StatCard label="Failed/Refund" value={stats.failed} icon={<ShieldCheck size={16} />} accent={stats.failed > 0 ? 'text-red-300' : 'text-emerald-300'} />
          <StatCard label="Attachments" value={files.length} icon={<FolderOpen size={16} />} accent="text-purple-200" glow="purple" />
        </section>

        {/* ──── FILTER BAR ──── */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-cyan-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Filters</span>
            </div>
            <div className="flex items-center gap-2">
              <ActionButton onClick={() => { setStatusFilter('all'); setSearch(''); setDateRange({ start: '', end: '' }) }} variant="ghost" icon={<X size={13} />}>Clear All</ActionButton>
              <ActionButton onClick={handleRefresh} variant="ghost" icon={<Eye size={13} />}>Refresh</ActionButton>
              <ActionButton onClick={exportCSV} variant="primary" icon={<Download size={14} />}>Export CSV</ActionButton>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
                placeholder="Search real name, email, user id, paypal order id…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <select className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="credited">Credited</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Calendar size={11} className="text-slate-500" />
                <input type="date" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none flex-1" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                <span className="text-slate-500 text-xs">→</span>
                <input type="date" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none flex-1" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-cyan-300 font-bold">
                🅿️ PayPal only
              </div>
            </div>
          </div>
        </section>

        {/* ──── TABLE ──── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader
              icon={<CreditCard size={18} />}
              label={`PayPal Purchases — ${filtered.length} of ${rows.length} rows`}
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400" />
              <p className="mt-4 text-sm text-slate-400">Loading PayPal purchase ledger…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500 text-sm">
              No PayPal purchases match current filters.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04]">
                      {[
                        'Date', 'Real Name', 'Email', 'User ID',
                        'Username', 'Display Name', 'Coins', 'Amount USD',
                        'PayPal Order ID', 'PayPal Capture', 'Status', 'Source', 'Actions',
                      ].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => {
                      const isMissingName = !p.realName
                      const isFlagged = ['failed', 'refunded', 'canceled', 'cancelled'].includes(p.status)
                      const isLegacy = p.source === 'coin_transactions'
                      return (
                        <tr
                          key={p.id}
                          className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors ${
                            isFlagged ? 'bg-red-950/8' : isMissingName ? 'bg-amber-950/6' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{formatDate(p.purchaseDate)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {isMissingName && (
                                <span title="Real name missing">
                                  <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                                </span>
                              )}
                              <span className={`font-medium whitespace-nowrap ${isMissingName ? 'text-amber-300' : 'text-white'}`}>
                                {p.realName ?? <span className="text-amber-400 italic">Missing real name</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{p.email ?? '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono whitespace-nowrap max-w-[140px] truncate" title={p.userId}>{p.userId}</td>
                          <td className="px-3 py-2.5 text-slate-300 text-xs whitespace-nowrap">{p.username ?? '—'}</td>
                          <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{p.displayName ?? '—'}</td>
                          <td className="px-3 py-2.5 font-black text-yellow-300 whitespace-nowrap">{formatCoins(p.coinsPurchased)}</td>
                          <td className="px-3 py-2.5 font-black text-emerald-300 whitespace-nowrap">{formatCurrency(p.amountPaid)}</td>
                          <td className="px-3 py-2.5 text-slate-400 text-xs font-mono max-w-[160px] truncate" title={p.paypalOrderId ?? ''}>
                            {p.paypalOrderId ? (
                              <span className="text-purple-300">{p.paypalOrderId.slice(0, 18)}{p.paypalOrderId.length > 18 ? '…' : ''}</span>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-500 text-[11px] font-mono max-w-[140px] truncate" title={p.paypalCaptureId ?? ''}>
                            {p.paypalCaptureId ? p.paypalCaptureId.slice(0, 14) + '…' : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[p.status] || STATUS_STYLES.completed}`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`text-[10px] font-bold ${isLegacy ? 'text-amber-400' : 'text-cyan-400'}`}>
                              {isLegacy ? 'coin_tx' : 'paypal_tx'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setNoteTargetPurchaseId(p.id); setShowNotePanel(true) }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-white/5 transition"
                                title="Add / view notes"
                              >
                                <StickyNote size={13} />
                              </button>
                              <button
                                onClick={() => { setSelectedPurchaseForUpload(p.id); setUploadPreview(null); setShowFileUpload(true) }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition"
                                title="Attach file"
                              >
                                <Upload size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ──── NOTES PANEL ──── */}
        {showNotePanel && (
          <section className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNotePanel(false)}>
            <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950 p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Purchase Notes</h3>
                  {noteTargetPurchaseId && (
                    <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                      {rows.find(p => p.id === noteTargetPurchaseId)?.username ?? noteTargetPurchaseId.slice(0, 20)}
                    </p>
                  )}
                </div>
                <button onClick={() => { setShowNotePanel(false); setNoteTargetPurchaseId(null) }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition">
                  <X size={18} />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
                  placeholder="Write a note about this purchase…"
                  value={noteBody}
                  onChange={e => setNoteBody(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && noteTargetPurchaseId && addNoteForPurchase(noteTargetPurchaseId)}
                />
                <ActionButton onClick={() => noteTargetPurchaseId && addNoteForPurchase(noteTargetPurchaseId)} icon={<Save size={14} />}>Save</ActionButton>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {noteTargetPurchaseId && notesForPurchase(noteTargetPurchaseId).length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">No notes for this purchase yet.</p>
                )}
                {noteTargetPurchaseId && notesForPurchase(noteTargetPurchaseId).map(n => (
                  <div key={n.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 space-y-1">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{n.body}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleString()}</p>
                      <button onClick={() => deleteNote(n.id)} className="p-1 rounded-lg text-slate-500 hover:text-red-400 transition"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ──── FILE UPLOAD PANEL ──── */}
        {showFileUpload && (
          <section className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowFileUpload(false); setUploadPreview(null) }}>
            <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950 p-6 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">
                  {selectedPurchaseForUpload ? 'Attach File' : 'Upload File'}
                </h3>
                <button onClick={() => { setShowFileUpload(false); setUploadPreview(null) }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition"><X size={18} /></button>
              </div>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-purple-400/20 bg-white/[0.02] p-8 cursor-pointer hover:border-purple-400/45 hover:bg-white/[0.04] transition">
                <UploadIcon size={28} className="text-purple-300" />
                <span className="text-sm font-medium text-slate-300">Select file (max 10 MB)</span>
                <input type="file" className="hidden" accept="*/*" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.size > 10 * 1024 * 1024) { toast.error('Max 10 MB'); return }
                  const dataUrl = await readFileAsDataURL(file)
                  setUploadPreview({ name: file.name, type: file.type, data: dataUrl })
                }} />
              </label>
              {uploadPreview && (
                <div className="flex items-center gap-3 rounded-xl border border-purple-400/20 bg-purple-500/10 p-3">
                  <FolderOpen size={18} className="text-purple-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{uploadPreview.name}</p>
                    <p className="text-[11px] text-slate-400">{(uploadPreview.data.length / 1024).toFixed(1)} KB</p>
                  </div>
                  <ActionButton variant="ghost" onClick={() => setUploadPreview(null)}><X size={14} /></ActionButton>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <ActionButton variant="ghost" onClick={() => { setShowFileUpload(false); setUploadPreview(null) }}>Cancel</ActionButton>
                <ActionButton onClick={handleAttachmentUpload} disabled={!uploadPreview} icon={<UploadIcon size={14} />}>
                  {selectedPurchaseForUpload ? 'Attach to Purchase' : 'Save File'}
                </ActionButton>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
