// src/pages/admin/StartupExpenseTracker.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { supabase, hasRole } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  Wallet, Receipt, BarChart3, Coins, ShieldCheck, Plus, Trash2, Edit3, Save, X,
  Upload, FileText, FolderOpen, DollarSign, TrendingDown, TrendingUp, AlertTriangle,
  StickyNote, Download, Search, Server, Zap, Globe, Package, Headphones, Gift,
  Landmark, PiggyBank, Eye, EyeOff,
  Megaphone
} from 'lucide-react'

// ── Types ──

type ExpenseStatus = 'planned' | 'paid' | 'pending' | 'reimbursed' | 'cancelled'

interface ExpenseRow {
  id: string
  date: string
  category: ExpenseCategory
  vendor: string
  description: string
  amount: number
  paymentMethod: string
  status: ExpenseStatus
  currency?: string
  notes: string
}

type ExpenseCategory =
  | 'supabase' | 'livekit' | 'agora' | 'vercel_hosting' | 'domain'
  | 'gift_animations' | 'video_licenses' | 'software_tools'
  | 'paypal_fees' | 'word_of_mouth' | 'empire_partner' | 'other'

interface GiftAsset {
  id: string
  assetName: string
  vendorSource: string
  licenseOwned: boolean
  commercialUse: boolean
  cost: number
  videoLength: string
  targetCoinValue: number
  status: string
  notes: string
}

interface Promoter {
  id: string
  name: string
  basePay: number
  qualifiedSignups: number
  signupBonus: number
  totalOwed: number
  paid: boolean
  notes: string
}

interface InfraItem {
  id: string
  service: string
  monthlyEstimate: number
  actualPaid: number
  billingDate: string
  status: string
  notes: string
}

interface NoteItem {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

interface FileItem {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
  uploadedAt: string
  updatedAt: string
  category: 'receipt' | 'license' | 'invoice' | 'general'
}

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'supabase', label: 'Supabase' },
  { value: 'livekit', label: 'LiveKit' },
  { value: 'agora', label: 'Agora' },
  { value: 'vercel_hosting', label: 'Vercel / Hosting' },
  { value: 'domain', label: 'Domain' },
  { value: 'gift_animations', label: 'Gift Animations' },
  { value: 'video_licenses', label: 'Video Licenses' },
  { value: 'software_tools', label: 'Software Tools' },
  { value: 'paypal_fees', label: 'PayPal Fees' },
  { value: 'word_of_mouth', label: 'Word of Mouth' },
  { value: 'empire_partner', label: 'Empire Partner Program' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS: ExpenseStatus[] = ['planned', 'paid', 'pending', 'reimbursed', 'cancelled']

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  planned: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  reimbursed: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  cancelled: 'bg-red-500/15 text-red-300 border-red-500/30',
}

const LOW_BALANCE_THRESHOLD = 40
const WARNING_BALANCE_THRESHOLD = 75

const LS_KEYS = {
  expenses: 'tc_startup_expenses',
  assets: 'tc_gift_assets',
  promoters: 'tc_promoters',
  infra: 'tc_infra_items',
  notes: 'tc_startup_notes',
  files: 'tc_startup_files',
  // Track total funds added to available cash
  fundsAdded: 'tc_startup_funds_added',
  // Editable starting cash (default $175)
  startingCash: 'tc_startup_starting_cash',
}

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveLS<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val))
}

let _idCounter = 0
function uid() {
  _idCounter++
  return `_${Date.now()}_${_idCounter}`
}

// ── Sub-components ──

const StatCard: React.FC<{
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent?: string
  glow?: 'cyan' | 'green' | 'amber' | 'red' | 'purple'
}> = ({ label, value, sub, icon, accent = 'text-cyan-200', glow }) => {
  const glowStyle: React.CSSProperties | undefined = glow
    ? { boxShadow: `0 0 22px rgba(${glow === 'cyan' ? '45,212,191' : glow === 'green' ? '52,211,153' : glow === 'amber' ? '251,191,36' : glow === 'red' ? '244,63,94' : '167,139,250'},0.28)` }
    : undefined
  return (
    <div
      className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm transition-all duration-200 hover:border-white/20"
      style={glowStyle}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={accent}>{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-black text-white">{value}</p>
      {sub && <p className="text-[11px] font-medium text-slate-400 mt-0.5">{sub}</p>}
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
    ghost: 'bg-white/[0.04] border border-white/10 text-slate-300 hover:border-white/20 hover:text-white',
  }
  return (
    <button type="button" className={cx(base, variants[variant], className)} {...props}>
      {icon}
      {children}
    </button>
  )
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string }> = ({
  label, className = '', ...props
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</label>
    <input
      className={cx(
        'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20',
        className
      )}
      {...props}
    />
  </div>
)

const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }> = ({
  label, className = '', children, ...props
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</label>
    <select
      className={cx(
        'rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white transition-all duration-200 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20',
        className
      )}
      {...props}
    >
      {children}
    </select>
  </div>
)

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StartupExpenseTracker() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const allowed = useMemo(() => hasRole(profile, ['admin', 'ceo'] as any), [profile])
  useEffect(() => {
    if (!allowed) {
      toast.error('Admin or CEO access only')
      navigate('/', { replace: true })
    }
  }, [allowed, navigate])

  // ── Local state ──
  const [expenses, setExpenses] = useState<ExpenseRow[]>(() => loadLS(LS_KEYS.expenses, []))
  const [giftAssets, setGiftAssets] = useState<GiftAsset[]>(() => loadLS(LS_KEYS.assets, []))
  const [promoters, setPromoters] = useState<Promoter[]>(() => loadLS(LS_KEYS.promoters, []))
  const [infraItems, setInfraItems] = useState<InfraItem[]>(() => loadLS(LS_KEYS.infra, []))
  const [notes, setNotes] = useState<NoteItem[]>(() => loadLS(LS_KEYS.notes, []))
  const [files, setFiles] = useState<FileItem[]>(() => loadLS(LS_KEYS.files, []))
  const [fundsAdded, setFundsAdded] = useState<number>(() => loadLS(LS_KEYS.fundsAdded, 0))
  const [startingCash, setStartingCash] = useState<number>(() => loadLS(LS_KEYS.startingCash, 175))
  const [editingStartingCash, setEditingStartingCash] = useState(false)
  const [startingCashInput, setStartingCashInput] = useState('')

  // ── Expense form state ──
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null)
  const [expForm, setExpForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'other' as ExpenseCategory,
    vendor: '', description: '', amount: '', paymentMethod: '', status: 'pending' as ExpenseStatus, notes: '',
  })

  // ── Asset form state ──
  const [showAssetForm, setShowAssetForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<GiftAsset | null>(null)
  const [assetForm, setAssetForm] = useState({
    assetName: '', vendorSource: '', licenseOwned: false, commercialUse: false,
    cost: '', videoLength: '', targetCoinValue: '', status: 'owned', notes: '',
  })

  // ── Promoter form state ──
  const [showPromoterForm, setShowPromoterForm] = useState(false)
  const [promoForm, setPromoForm] = useState({ name: '', basePay: '5', qualifiedSignups: '0', signupBonus: '1', paid: false, notes: '' })

  // ── Infra form state ──
  const [showInfraForm, setShowInfraForm] = useState(false)
  const [infraForm, setInfraForm] = useState({ service: '', monthlyEstimate: '', actualPaid: '', billingDate: '', status: 'active', notes: '' })

  // ── Add Funds form state ──
  const [showFundsForm, setShowFundsForm] = useState(false)
  const [fundsAmount, setFundsAmount] = useState('')

  // ── Note form state ──
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  // ── File manager state ──
  const [fileFilter, setFileFilter] = useState<string>('all')
  const [fileSearch, setFileSearch] = useState('')
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<{ name: string; type: string; data: string } | null>(null)
  const [editingFileName, setEditingFileName] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [editingFileNote, setEditingFileNote] = useState<string | null>(null)
  const [newFileNote, setNewFileNote] = useState('')

  // ── Persist ──
  useEffect(() => { saveLS(LS_KEYS.expenses, expenses) }, [expenses])
  useEffect(() => { saveLS(LS_KEYS.assets, giftAssets) }, [giftAssets])
  useEffect(() => { saveLS(LS_KEYS.promoters, promoters) }, [promoters])
  useEffect(() => { saveLS(LS_KEYS.infra, infraItems) }, [infraItems])
  useEffect(() => { saveLS(LS_KEYS.notes, notes) }, [notes])
  useEffect(() => { saveLS(LS_KEYS.files, files) }, [files])
  useEffect(() => { saveLS(LS_KEYS.fundsAdded, fundsAdded) }, [fundsAdded])
  useEffect(() => { saveLS(LS_KEYS.startingCash, startingCash) }, [startingCash])

  // ── Computed totals ──
  const totalSpent = useMemo(() =>
    expenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0)
  , [expenses])

  const totalPendingPayouts = useMemo(() => {
    const pendingExp = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0)
    const promoOwed = promoters.reduce((s, p) => s + p.totalOwed, 0)
    return pendingExp + promoOwed
  }, [expenses, promoters])

  // ── Startup cash ────────────────────────────────────────
  // Starting cash is editable (default $175); additional funds (received money) are added on top
  // Expenses and pending payouts subtract from the total available
  const availableCash = startingCash + fundsAdded
  const remainingBalance = useMemo(() => Math.max(0, availableCash - totalSpent - totalPendingPayouts), [availableCash, totalSpent, totalPendingPayouts])

  const infraMonthly = useMemo(() =>
    infraItems.reduce((s, i) => s + i.monthlyEstimate, 0)
  , [infraItems])

  const giftLicenseSpend = useMemo(() =>
    giftAssets.reduce((s, a) => s + a.cost, 0)
  , [giftAssets])

  const balanceColor = remainingBalance <= LOW_BALANCE_THRESHOLD ? 'text-red-400' : remainingBalance <= WARNING_BALANCE_THRESHOLD ? 'text-amber-400' : 'text-emerald-400'

  // ── Expense CRUD ──
  const resetExpForm = () => setExpForm({ date: new Date().toISOString().split('T')[0], category: 'other', vendor: '', description: '', amount: '', paymentMethod: '', status: 'pending', notes: '' })

  const openAddExpense = () => { resetExpForm(); setEditingExpense(null); setShowExpenseForm(true) }
  const openEditExpense = (e: ExpenseRow) => { setExpForm({ date: e.date, category: e.category, vendor: e.vendor, description: e.description, amount: String(e.amount), paymentMethod: e.paymentMethod, status: e.status, notes: e.notes }); setEditingExpense(e); setShowExpenseForm(true) }

  const saveExpense = () => {
    const amt = parseFloat(expForm.amount) || 0
    if (amt <= 0) { toast.error('Enter a valid amount'); return }
    if (!expForm.description.trim()) { toast.error('Description required'); return }
    if (editingExpense) {
      setExpenses(prev => prev.map(e => e.id === editingExpense.id ? { ...e, ...expForm, amount: amt } : e))
      toast.success('Expense updated')
    } else {
      setExpenses(prev => [...prev, { id: uid(), ...expForm, amount: amt }])
      toast.success('Expense added')
    }
    setShowExpenseForm(false); setEditingExpense(null); resetExpForm()
  }

  const deleteExpense = (id: string) => { setExpenses(prev => prev.filter(e => e.id !== id)); toast.success('Expense deleted') }
  // ── Asset CRUD ──
  const resetAssetForm = () => setAssetForm({ assetName: '', vendorSource: '', licenseOwned: false, commercialUse: false, cost: '', videoLength: '', targetCoinValue: '', status: 'owned', notes: '' })

  const openAddAsset = () => { resetAssetForm(); setEditingAsset(null); setShowAssetForm(true) }
  const openEditAsset = (a: GiftAsset) => { setAssetForm({ assetName: a.assetName, vendorSource: a.vendorSource, licenseOwned: a.licenseOwned, commercialUse: a.commercialUse, cost: String(a.cost), videoLength: a.videoLength, targetCoinValue: String(a.targetCoinValue), status: a.status, notes: a.notes }); setEditingAsset(a); setShowAssetForm(true) }

  const saveAsset = () => {
    if (!assetForm.assetName.trim()) { toast.error('Asset name required'); return }
    const cost = parseFloat(assetForm.cost) || 0
    const tcv = parseInt(assetForm.targetCoinValue) || 0
    if (editingAsset) {
      setGiftAssets(prev => prev.map(a => a.id === editingAsset.id ? { ...a, ...assetForm, cost, targetCoinValue: tcv } : a))
      toast.success('Asset updated')
    } else {
      setGiftAssets(prev => [...prev, { id: uid(), ...assetForm, cost, targetCoinValue: tcv }])
      toast.success('Asset added')
    }
    setShowAssetForm(false); setEditingAsset(null); resetAssetForm()
  }

  const deleteAsset = (id: string) => { setGiftAssets(prev => prev.filter(a => a.id !== id)); toast.success('Asset deleted') }

  // ── Promoter CRUD ──
  const savePromoter = () => {
    if (!promoForm.name.trim()) { toast.error('Promoter name required'); return }
    const basePay = parseFloat(promoForm.basePay) || 0
    const signups = parseInt(promoForm.qualifiedSignups) || 0
    const bonus = parseFloat(promoForm.signupBonus) || 1
    const total = basePay + signups * bonus
    setPromoters(prev => [...prev, { id: uid(), ...promoForm, basePay, qualifiedSignups: signups, signupBonus: bonus, totalOwed: total }])
    setShowPromoterForm(false); setPromoForm({ name: '', basePay: '5', qualifiedSignups: '0', signupBonus: '1', paid: false, notes: '' })
    toast.success('Promoter added')
  }

  const togglePromoterPaid = (id: string) => {
    setPromoters(prev => prev.map(p => p.id === id ? { ...p, paid: !p.paid } : p))
    toast.success('Promoter status updated')
  }

  const deletePromoter = (id: string) => { setPromoters(prev => prev.filter(p => p.id !== id)) }

  // ── Infra CRUD ──
  const saveInfra = () => {
    if (!infraForm.service.trim()) { toast.error('Service name required'); return }
    const me = parseFloat(infraForm.monthlyEstimate) || 0
    const ap = parseFloat(infraForm.actualPaid) || 0
    setInfraItems(prev => [...prev, { id: uid(), ...infraForm, monthlyEstimate: me, actualPaid: ap }])
    setShowInfraForm(false); setInfraForm({ service: '', monthlyEstimate: '', actualPaid: '', billingDate: '', status: 'active', notes: '' })
    toast.success('Infrastructure item added')
  }

  const deleteInfra = (id: string) => { setInfraItems(prev => prev.filter(i => i.id !== id)) }

  // ── Add Funds ────────────────────────────────────────────
  const addFunds = () => {
    const amt = parseFloat(fundsAmount) || 0
    if (amt <= 0) { toast.error('Enter a valid amount'); return }
    setFundsAdded(prev => prev + amt)
    toast.success(`$${amt.toFixed(2)} added to Available Cash`)
    setShowFundsForm(false); setFundsAmount('')
  }

  // ── Notes ──
  const saveNote = () => {
    if (!noteTitle.trim()) { toast.error('Note title required'); return }
    if (editingNoteId) {
      setNotes(prev => prev.map(n => n.id === editingNoteId ? { ...n, title: noteTitle, body: noteBody, updatedAt: new Date().toISOString() } : n))
      toast.success('Note updated')
    } else {
      setNotes(prev => [{ id: uid(), title: noteTitle, body: noteBody, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev])
      toast.success('Note added')
    }
    setNoteTitle(''); setNoteBody(''); setEditingNoteId(null)
  }

  const editNote = (n: NoteItem) => { setNoteTitle(n.title); setNoteBody(n.body); setEditingNoteId(n.id) }
  const deleteNote = (id: string) => { setNotes(prev => prev.filter(n => n.id !== id)); if (editingNoteId === id) { setNoteTitle(''); setNoteBody(''); setEditingNoteId(null) } }

  // ── File Manager ──
  // Supabase Storage bucket: 'admin-files' (create in Supabase Dashboard → Storage → New bucket 'admin-files', private)
  // Storage RLS note: Add policies allowing admin/ceo roles full access via service-role or allow authenticated admins
  const BUCKET_NAME = 'admin-files'

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(file)
    })

  const handleFileUpload = async () => {
    if (!uploadFile) return
    const fi: FileItem = {
      id: uid(),
      name: uploadFile.name,
      type: uploadFile.type,
      size: Math.round((uploadFile.data.length * 3) / 4),
      dataUrl: uploadFile.data,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: 'general',
    }
    setFiles(prev => [fi, ...prev])
    toast.success(`"${uploadFile.name}" uploaded`)
    setUploadFile(null); setShowFileUpload(false)
  }

  const deleteFile = (id: string) => { setFiles(prev => prev.filter(f => f.id !== id)) }

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      if (fileFilter !== 'all' && f.category !== fileFilter) return false
      if (fileSearch && !f.name.toLowerCase().includes(fileSearch.toLowerCase())) return false
      return true
    })
  }, [files, fileFilter, fileSearch])

  if (!allowed) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050A14] via-[#08101F] to-[#0A0514] text-white p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* ── Page Title ── */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Startup Expense Tracker
          </h1>
          <p className="text-sm text-slate-400">
            Track Mai Troll startup expenses, infrastructure, licensed gifts, promoters, and remaining runway.
            <span className="text-cyan-300 font-bold ml-1">Admin / CEO only.</span>
          </p>
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* §1  STARTUP CASH SUMMARY                          */}
        {/* ══════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <SectionHeader icon={<PiggyBank size={18} />} label="Startup Cash Summary" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Available Cash"
              value={`$${availableCash.toFixed(2)}`}
              sub={`Starting: $${startingCash.toFixed(2)} + Added: $${fundsAdded.toFixed(2)}`}
              icon={<DollarSign size={16} />}
              accent="text-cyan-200"
              glow="cyan"
            />
            <StatCard
              label="Total Spent"
              value={`$${totalSpent.toFixed(2)}`}
              icon={<TrendingDown size={16} />}
              accent="text-red-300"
            />
            <StatCard
              label={`Remaining ${
                remainingBalance <= LOW_BALANCE_THRESHOLD ? '⚠️ LOW' :
                remainingBalance <= WARNING_BALANCE_THRESHOLD ? '⚠ Caution' : 'Balance'
              }`}
              value={`$${remainingBalance.toFixed(2)}`}
              sub={remainingBalance <= LOW_BALANCE_THRESHOLD ? 'Act immediately' : remainingBalance <= WARNING_BALANCE_THRESHOLD ? 'Watch spending' : 'Healthy'}
              icon={<Wallet size={16} />}
              accent={balanceColor}
              glow={remainingBalance <= LOW_BALANCE_THRESHOLD ? 'red' : remainingBalance <= WARNING_BALANCE_THRESHOLD ? 'amber' : 'green'}
            />
            <StatCard
              label="Pending Payouts"
              value={`$${totalPendingPayouts.toFixed(2)}`}
              sub="Expenses + Promoters"
              icon={<AlertTriangle size={16} />}
              accent="text-amber-200"
              glow="amber"
            />
            <StatCard
              label="Infra / Month"
              value={`$${infraMonthly.toFixed(2)}`}
              sub={`${infraItems.length} services`}
              icon={<Server size={16} />}
              accent="text-blue-200"
            />
            <StatCard
              label="Gift / Licenses"
              value={`$${giftLicenseSpend.toFixed(2)}`}
              sub={`${giftAssets.length} assets`}
              icon={<Gift size={16} />}
              accent="text-purple-200"
              glow="purple"
            />
          </div>

          {/* Edit Starting Cash inline panel */}
          {editingStartingCash && (
            <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.04] p-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-300">Edit Starting Cash ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={startingCashInput}
                  onChange={e => setStartingCashInput(e.target.value)}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-950/40 px-3 py-2 text-sm text-white placeholder-cyan-300/40 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <ActionButton onClick={() => {
                const amt = parseFloat(startingCashInput)
                if (isNaN(amt) || amt < 0) { toast.error('Enter a valid amount'); return }
                setStartingCash(amt)
                setEditingStartingCash(false); setStartingCashInput('')
                toast.success(`Starting cash set to $${amt.toFixed(2)}`)
              }} icon={<Save size={14} />}>Save</ActionButton>
              <ActionButton variant="ghost" onClick={() => { setEditingStartingCash(false); setStartingCashInput('') }}>Cancel</ActionButton>
            </div>
          )}

          {!editingStartingCash && (
            <ActionButton onClick={() => { setStartingCashInput(String(startingCash)); setEditingStartingCash(true) }} icon={<Edit3 size={14} />} variant="ghost">Edit Starting Cash</ActionButton>
          )}

          {/* Add Funds inline panel */}
          {showFundsForm && (
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.04] p-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-300">Amount Received ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={fundsAmount}
                  onChange={e => setFundsAmount(e.target.value)}
                  className="rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-3 py-2 text-sm text-white placeholder-emerald-300/40 focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/20"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <ActionButton onClick={addFunds} icon={<TrendingUp size={14} />}>Add to Cash</ActionButton>
              <ActionButton variant="ghost" onClick={() => { setShowFundsForm(false); setFundsAmount('') }}>Cancel</ActionButton>
            </div>
          )}

          {!showFundsForm && (
            <ActionButton onClick={() => setShowFundsForm(true)} icon={<Plus size={14} />} variant="ghost">Add Funds</ActionButton>
          )}
        </section>

        {/* ══════════════════════════════════════════════════ */}
        {/* §2  EXPENSE LOG                                   */}
        {/* ══════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Receipt size={18} />} label="Expense Log" />
            <ActionButton onClick={openAddExpense} icon={<Plus size={14} />}>Add Expense</ActionButton>
          </div>

          {showExpenseForm && (
            <ExpenseForm
              form={expForm}
              setForm={setExpForm}
              editing={!!editingExpense}
              onSave={saveExpense}
              onCancel={() => { setShowExpenseForm(false); setEditingExpense(null); resetExpForm() }}
            />
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04]">
                    {['Date', 'Category', 'Vendor', 'Description', 'Amount', 'Method', 'Status', 'Notes', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">No expenses recorded yet.</td></tr>
                  ) : expenses.map(e => (
                    <tr key={e.id} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{e.date}</td>
                      <td className="px-3 py-2 text-cyan-200 font-medium whitespace-nowrap">{EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label ?? e.category}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{e.vendor || '—'}</td>
                      <td className="px-3 py-2 text-slate-200 max-w-[200px] truncate" title={e.description}>{e.description}</td>
                      <td className="px-3 py-2 font-black whitespace-nowrap">{e.currency ?? '$'}{e.amount.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{e.paymentMethod || '—'}</td>
                      <td className="px-3 py-2"><span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[e.status]}`}>{e.status}</span></td>
                      <td className="px-3 py-2 text-slate-500 text-xs max-w-[150px] truncate" title={e.notes}>{e.notes || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEditExpense(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition" title="Edit"><Edit3 size={13} /></button>
                          <button onClick={() => deleteExpense(e.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {expenses.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-cyan-400/30 bg-cyan-500/5">
                      <td colSpan={4} className="px-3 py-2.5 text-right text-slate-400 text-xs uppercase tracking-wider">Totals</td>
                      <td className="px-3 py-2.5 font-black text-cyan-200">
                        ${expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════ */}
        {/* §3  GIFT ANIMATION / LICENSE TRACKER              */}
        {/* ══════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Gift size={18} />} label="Gift Animation / License Tracker" />
            <ActionButton onClick={openAddAsset} icon={<Plus size={14} />}>Add Asset</ActionButton>
          </div>

          {showAssetForm && (
            <AssetForm
              form={assetForm}
              setForm={setAssetForm}
              editing={!!editingAsset}
              onSave={saveAsset}
              onCancel={() => { setShowAssetForm(false); setEditingAsset(null); resetAssetForm() }}
            />
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04]">
                    {['Asset Name', 'Vendor / Source', 'License', 'Commercial Use', 'Cost', 'Video Length', 'Coin Target', 'Status', 'Notes', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {giftAssets.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500 text-sm">No assets tracked yet.</td></tr>
                  ) : giftAssets.map(a => (
                    <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-3 py-2 text-purple-200 font-medium whitespace-nowrap">{a.assetName}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{a.vendorSource || '—'}</td>
                      <td className="px-3 py-2"><BoolBadge value={a.licenseOwned} /></td>
                      <td className="px-3 py-2"><BoolBadge value={a.commercialUse} /></td>
                      <td className="px-3 py-2 font-black text-emerald-300 whitespace-nowrap">${a.cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{a.videoLength || '—'}</td>
                      <td className="px-3 py-2 text-cyan-200 font-bold whitespace-nowrap">{a.targetCoinValue.toLocaleString()} 🪙</td>
                      <td className="px-3 py-2"><span className="text-xs font-bold text-slate-300 capitalize">{a.status}</span></td>
                      <td className="px-3 py-2 text-slate-500 text-xs max-w-[150px] truncate" title={a.notes}>{a.notes || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => openEditAsset(a)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition" title="Edit"><Edit3 size={13} /></button>
                          <button onClick={() => deleteAsset(a.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition" title="Delete"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {giftAssets.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-purple-400/30 bg-purple-500/5">
                      <td colSpan={4} className="px-3 py-2.5 text-right text-slate-400 text-xs uppercase tracking-wider">Total Spend</td>
                      <td className="px-3 py-2.5 font-black text-purple-200">${giftAssets.reduce((s, a) => s + a.cost, 0).toFixed(2)}</td>
                      <td colSpan={5} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════ */}
        {/* §4  WORD-OF-MOUTH PROMOTER TRACKER                */}
        {/* ══════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Megaphone size={18} />} label="Word-of-Mouth Promoter Tracker" />
            <ActionButton onClick={() => setShowPromoterForm(true)} icon={<Plus size={14} />}>Add Promoter</ActionButton>
          </div>
          <p className="text-xs text-slate-500">
            Business rule: Pay 2 users $5 each to run broadcasts, then $1 per qualified signup via the Empire Partner Program.
          </p>

          {showPromoterForm && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Add Promoter</h3>
                <button onClick={() => setShowPromoterForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InputField label="Promoter Name / User" value={promoForm.name} onChange={e => setPromoForm(p => ({ ...p, name: e.target.value }))} />
                <InputField label="Base Broadcast Pay ($)" type="number" value={promoForm.basePay} onChange={e => setPromoForm(p => ({ ...p, basePay: e.target.value }))} />
                <InputField label="Qualified Signups" type="number" value={promoForm.qualifiedSignups} onChange={e => setPromoForm(p => ({ ...p, qualifiedSignups: e.target.value }))} />
                <InputField label="Signup Bonus Per ($)" type="number" value={promoForm.signupBonus} onChange={e => setPromoForm(p => ({ ...p, signupBonus: e.target.value }))} />
                <div className="col-span-2 md:col-span-4">
                  <InputField label="Notes" value={promoForm.notes} onChange={e => setPromoForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <ActionButton variant="ghost" onClick={() => setShowPromoterForm(false)}>Cancel</ActionButton>
                <ActionButton onClick={savePromoter} icon={<Save size={14} />}>Save Promoter</ActionButton>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04]">
                    {['Promoter', 'Base Pay', 'Signups', 'Bonus $/Signup', 'Total Owed', 'Paid', 'Notes', 'Actions'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promoters.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">No promoters tracked yet.</td></tr>
                  ) : promoters.map(p => (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                      <td className="px-3 py-2 text-pink-200 font-medium whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 font-bold text-slate-200">${p.basePay.toFixed(2)}</td>
                      <td className="px-3 py-2 text-cyan-200 font-medium">{p.qualifiedSignups}</td>
                      <td className="px-3 py-2 text-slate-300">${p.signupBonus.toFixed(2)}</td>
                      <td className="px-3 py-2 font-black text-amber-300">${p.totalOwed.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => togglePromoterPaid(p.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase transition ${
                            p.paid
                              ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                              : 'bg-amber-500/15 border-amber-400/30 text-amber-300'
                          }`}
                        >
                          {p.paid ? '✓ Paid' : '⏳ Owed'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-500 text-xs max-w-[150px] truncate" title={p.notes}>{p.notes || '—'}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => deletePromoter(p.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition" title="Delete"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {promoters.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-amber-400/30 bg-amber-500/5">
                      <td colSpan={4} className="px-3 py-2.5 text-right text-slate-400 text-xs uppercase tracking-wider">Total Owed</td>
                      <td className="px-3 py-2.5 font-black text-amber-300">${promoters.reduce((s, p) => s + p.totalOwed, 0).toFixed(2)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════ */}
        {/* §5  INFRASTRUCTURE TRACKER                        */}
        {/* ══════════════════════════════════════════════════ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader icon={<Server size={18} />} label="Infrastructure Tracker" />
            <ActionButton onClick={() => setShowInfraForm(true)} icon={<Plus size={14} />}>Add Service</ActionButton>
          </div>

          {showInfraForm && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">Add Infrastructure Item</h3>
                <button onClick={() => setShowInfraForm(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InputField label="Service" value={infraForm.service} onChange={e => setInfraForm(f => ({ ...f, service: e.target.value }))} />
                <InputField label="Monthly Estimate ($)" type="number" value={infraForm.monthlyEstimate} onChange={e => setInfraForm(f => ({ ...f, monthlyEstimate: e.target.value }))} />
                <InputField label="Actual Paid ($)" type="number" value={infraForm.actualPaid} onChange={e => setInfraForm(f => ({ ...f, actualPaid: e.target.value }))} />
                <InputField label="Billing Date" type="date" value={infraForm.billingDate} onChange={e => setInfraForm(f => ({ ...f, billingDate: e.target.value }))} />
                <div className="col-span-2 md:col-span-4">
                  <InputField label="Notes" value={infraForm.notes} onChange={e => setInfraForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <ActionButton variant="ghost" onClick={() => setShowInfraForm(false)}>Cancel</ActionButton>
                <ActionButton onClick={saveInfra} icon={<Save size={14} />}>Save</ActionButton>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {infraItems.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500 text-sm">
                No infrastructure items tracked yet.
              </div>
            ) : infraItems.map(i => (
              <div key={i.id} className="group relative rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2 hover:border-cyan-400/25 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-blue-300" />
                    <span className="font-bold text-white">{i.service}</span>
                  </div>
                  <button onClick={() => deleteInfra(i.id)} className="p-1 rounded-lg text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition" title="Remove"><Trash2 size={12} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">Est. / mo</span>
                    <p className="font-bold text-blue-200">${i.monthlyEstimate.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Actually Paid</span>
                    <p className="font-bold text-emerald-300">${i.actualPaid.toFixed(2)}</p>
                  </div>
                </div>
                {i.billingDate && <p className="text-[10px] text-slate-500">Billing: {i.billingDate}</p>}
                {i.notes && <p className="text-[11px] text-slate-500 truncate" title={i.notes}>{i.notes}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════ */}
        {/* §6  NOTES                                         */}
        {/* ══════════════════════════════════════════════════ */}
        <NotesSection
          notes={notes}
          noteTitle={noteTitle}
          setNoteTitle={setNoteTitle}
          noteBody={noteBody}
          setNoteBody={setNoteBody}
          editingNoteId={editingNoteId}
          setEditingNoteId={setEditingNoteId}
          onSave={saveNote}
          onEdit={editNote}
          onDelete={deleteNote}
        />

        {/* ══════════════════════════════════════════════════ */}
        {/* §7  FILE MANAGER                                   */}
        {/* ══════════════════════════════════════════════════ */}
        <FileManager
          files={files}
          fileFilter={fileFilter}
          setFileFilter={setFileFilter}
          fileSearch={fileSearch}
          setFileSearch={setFileSearch}
          showFileUpload={showFileUpload}
          setShowFileUpload={setShowFileUpload}
          uploadFile={uploadFile}
          setUploadFile={setUploadFile}
          editingFileName={editingFileName}
          setEditingFileName={setEditingFileName}
          newFileName={newFileName}
          setNewFileName={setNewFileName}
          editingFileNote={editingFileNote}
          setEditingFileNote={setEditingFileNote}
          newFileNote={newFileNote}
          setNewFileNote={setNewFileNote}
          filteredFiles={filteredFiles}
          onUpload={handleFileUpload}
          onDelete={deleteFile}
        />

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-cyan-300">{icon}</span>
      <h2 className="text-base font-black uppercase tracking-[0.12em] text-cyan-100/80">{label}</h2>
      <span className="flex-1 h-px bg-gradient-to-r from-cyan-400/30 via-purple-400/15 to-transparent" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE FORM
// ─────────────────────────────────────────────────────────────────────────────

function ExpenseForm({
  form, setForm, editing, onSave, onCancel,
}: {
  form: any; setForm: (f: any) => void
  editing: boolean; onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.04] p-5 space-y-4 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-base font-bold text-white">{editing ? 'Edit Expense' : 'New Expense'}</h3>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InputField label="Date" type="date" value={form.date} onChange={e => setForm((f: any) => ({ ...f, date: e.target.value }))} />
        <SelectField label="Category" value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}>
          {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </SelectField>
        <InputField label="Vendor" value={form.vendor} onChange={e => setForm((f: any) => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Amazon, Stripe" />
        <InputField label="Amount ($)" type="number" step="0.01" value={form.amount} onChange={e => setForm((f: any) => ({ ...f, amount: e.target.value }))} />
        <InputField label="Description" value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="What was this for?" />
        <InputField label="Payment Method" value={form.paymentMethod} onChange={e => setForm((f: any) => ({ ...f, paymentMethod: e.target.value }))} placeholder="PayPal, Card, etc." />
        <SelectField label="Status" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </SelectField>
        <div className="col-span-2 md:col-span-2">
          <InputField label="Notes" value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <ActionButton variant="ghost" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton onClick={onSave} icon={<Save size={14} />}>{editing ? 'Update' : 'Add Expense'}</ActionButton>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET FORM
// ─────────────────────────────────────────────────────────────────────────────

function AssetForm({
  form, setForm, editing, onSave, onCancel,
}: {
  form: any; setForm: (f: any) => void
  editing: boolean; onSave: () => void; onCancel: () => void
}) {
  return (
    <div className="rounded-2xl border border-purple-400/25 bg-purple-500/[0.04] p-5 space-y-4 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-base font-bold text-white">{editing ? 'Edit Asset' : 'Add Licensed Asset'}</h3>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InputField label="Asset Name" value={form.assetName} onChange={e => setForm((f: any) => ({ ...f, assetName: e.target.value }))} />
        <InputField label="Vendor / Source" value={form.vendorSource} onChange={e => setForm((f: any) => ({ ...f, vendorSource: e.target.value }))} />
        <InputField label="Cost ($)" type="number" step="0.01" value={form.cost} onChange={e => setForm((f: any) => ({ ...f, cost: e.target.value }))} />
        <InputField label="Video Length" value={form.videoLength} onChange={e => setForm((f: any) => ({ ...f, videoLength: e.target.value }))} placeholder="e.g. 15s" />
        <InputField label="Target Coin Value" type="number" value={form.targetCoinValue} onChange={e => setForm((f: any) => ({ ...f, targetCoinValue: e.target.value }))} />
        <SelectField label="Status" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
          {['owned', 'purchased', 'licensed', 'expired', 'pending'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </SelectField>
        <div className="col-span-2 md:col-span-2">
          <InputField label="Notes" value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <Toggle label="License Owned" checked={form.licenseOwned} onChange={v => setForm((f: any) => ({ ...f, licenseOwned: v }))} />
        <Toggle label="Commercial Use OK" checked={form.commercialUse} onChange={v => setForm((f: any) => ({ ...f, commercialUse: v }))} />
      </div>
      <div className="flex justify-end gap-2">
        <ActionButton variant="ghost" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton onClick={onSave} icon={<Save size={14} />}>{editing ? 'Update' : 'Add Asset'}</ActionButton>
      </div>
    </div>
  )
}

function BoolBadge({ value }: { value: boolean }) {
  return value
    ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">Yes</span>
    : <span className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/12 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">No</span>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-white/10 transition-colors duration-200 ${
          checked ? 'bg-cyan-500 border-cyan-400' : 'bg-white/[0.06]'
        }`}
      >
        <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[14px]' : 'translate-x-0.5'
        }`} />
      </button>
      <span className="text-xs text-slate-300 font-medium">{label}</span>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTES SECTION
// ─────────────────────────────────────────────────────────────────────────────

function NotesSection({
  notes, noteTitle, setNoteTitle, noteBody, setNoteBody, editingNoteId, setEditingNoteId, onSave, onEdit, onDelete,
}: {
  notes: NoteItem[]
  noteTitle: string; setNoteTitle: (v: string) => void
  noteBody: string; setNoteBody: (v: string) => void
  editingNoteId: string | null; setEditingNoteId: (v: string | null) => void
  onSave: () => void; onEdit: (n: NoteItem) => void; onDelete: (id: string) => void
}) {
  return (
    <section className="space-y-3">
      <SectionHeader icon={<StickyNote size={18} />} label="Admin Notes" />
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Title</label>
            <input
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              placeholder="Note title..."
              onKeyDown={e => e.key === 'Enter' && onSave()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Body</label>
            <input
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
              value={noteBody}
              onChange={e => setNoteBody(e.target.value)}
              placeholder="Write your note..."
              onKeyDown={e => e.key === 'Enter' && onSave()}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {editingNoteId && <ActionButton variant="ghost" onClick={() => onEdit(notes.find(n => n.id === editingNoteId)!)} icon={<Edit3 size={14} />}>Cancel Edit</ActionButton>}
          <ActionButton onClick={onSave} icon={<Save size={14} />}>{editingNoteId ? 'Update Note' : 'Add Note'}</ActionButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {notes.length === 0 ? (
          <p className="col-span-full text-center text-slate-500 text-xs py-4">No notes yet.</p>
        ) : notes.map(n => (
          <div key={n.id} className={`rounded-2xl border p-4 space-y-2 ${
            editingNoteId === n.id
              ? 'border-cyan-400/50 bg-cyan-500/[0.08] shadow-[0_0_20px_rgba(45,212,191,0.15)]'
              : 'border-white/10 bg-white/[0.04]'
          }`}>
            <div className="flex items-start justify-between">
              <h4 className="font-bold text-white truncate flex-1">{n.title}</h4>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => onEdit(n)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition" title="Edit"><Edit3 size={13} /></button>
                <button onClick={() => onDelete(n.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition" title="Delete"><Trash2 size={13} /></button>
              </div>
            </div>
            {n.body && <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{n.body}</p>}
            <p className="text-[10px] text-slate-500">
              Updated {new Date(n.updatedAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE MANAGER
// ─────────────────────────────────────────────────────────────────────────────
//
// Supabase Storage integration:
//   1. Create bucket 'admin-files' in Supabase Dashboard → Storage
//   2. Add RLS policy allowing admin/ceo SELECT/INSERT/UPDATE/DELETE on the bucket
//   3. Replace localStorage calls below with:
//      const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', { limit: 100 })
//      for upload:  await supabase.storage.from(BUCKET_NAME).upload(filePath, file)
//      for delete:  await supabase.storage.from(BUCKET_NAME).remove([filePath])
//      for url:     const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
//
// The current localStorage implementation is a safe frontend-only fallback
// that keeps all file data accessible immediately while the bucket is being set up.

function FileManager({
  files, fileFilter, setFileFilter, fileSearch, setFileSearch,
  showFileUpload, setShowFileUpload, uploadFile, setUploadFile,
  editingFileName, setEditingFileName, newFileName, setNewFileName,
  editingFileNote, setEditingFileNote, newFileNote, setNewFileNote,
  onUpload, onDelete,
}: {
  files: FileItem[]
  fileFilter: string; setFileFilter: (v: string) => void
  fileSearch: string; setFileSearch: (v: string) => void
  showFileUpload: boolean; setShowFileUpload: (v: boolean) => void
  uploadFile: { name: string; type: string; data: string } | null; setUploadFile: (v: any) => void
  editingFileName: string | null; setEditingFileName: (v: string | null) => void
  newFileName: string; setNewFileName: (v: string) => void
  editingFileNote: string | null; setEditingFileNote: (v: string | null) => void
  newFileNote: string; setNewFileNote: (v: string) => void
  onUpload: () => void; onDelete: (id: string) => void
}) {
  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = rej
      r.readAsDataURL(file)
    })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10 MB per file'); return }
    const dataUrl = await readFileAsDataURL(file)
    setUploadFile({ name: file.name, type: file.type, data: dataUrl })
  }

  const filteredFiles = React.useMemo(() => {
    return files.filter(f => {
      if (fileFilter !== 'all' && f.category !== fileFilter) return false
      if (fileSearch && !f.name.toLowerCase().includes(fileSearch.toLowerCase())) return false
      return true
    })
  }, [files, fileFilter, fileSearch])

  return (
    <section className="space-y-3">
      <SectionHeader icon={<FolderOpen size={18} />} label="File Manager" />
      <p className="text-[10px] text-slate-500">
        Upload receipts, license documents, invoices, and general files.{' '}
        <span className="text-purple-300">Supabase Storage bucket coming soon.</span>
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <ActionButton onClick={() => setShowFileUpload(!showFileUpload)} icon={<Upload size={14} />}>Upload File</ActionButton>
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-400/40 focus:outline-none"
              placeholder="Search files..."
              value={fileSearch}
              onChange={e => setFileSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-400/40 focus:outline-none"
            value={fileFilter}
            onChange={e => setFileFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="receipt">Receipts</option>
            <option value="license">Licenses</option>
            <option value="invoice">Invoices</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      {showFileUpload && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-white">Upload File</h3>
            <button onClick={() => { setShowFileUpload(false); setUploadFile(null) }} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition"><X size={16} /></button>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cyan-400/20 bg-white/[0.02] p-8 cursor-pointer hover:border-cyan-400/45 hover:bg-white/[0.04] transition">
              <Upload size={28} className="text-cyan-300" />
              <span className="text-sm font-medium text-slate-300">Click to select file (max 10 MB)</span>
              <input type="file" className="hidden" accept="*/*" onChange={handleFileSelect} />
            </label>
            {uploadFile && (
              <div className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">
                <FileText size={18} className="text-cyan-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{uploadFile.name}</p>
                  <p className="text-[11px] text-slate-400">{(uploadFile.data.length / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <ActionButton variant="ghost" onClick={() => { setShowFileUpload(false); setUploadFile(null) }}>Cancel</ActionButton>
            <ActionButton onClick={onUpload} disabled={!uploadFile} icon={<Upload size={14} />}>Upload</ActionButton>
          </div>
        </div>
      )}

      {files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-500 text-sm">
          No files uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFiles.map(f => (
            <div key={f.id} className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden hover:border-cyan-400/25 transition-all group">
              {f.type.startsWith('image/') && (
                <div className="h-36 w-full overflow-hidden">
                  <img src={f.dataUrl} alt={f.name} className="h-full w-full object-cover" />
                </div>
              )}
              {f.type.startsWith('text/') && (
                <div className="h-36 w-full overflow-hidden bg-slate-900/60 p-3">
                  <p className="text-xs text-slate-300 truncate">📄 Text file — {(f.dataUrl.length / 1024).toFixed(1)} KB</p>
                </div>
              )}
              {!f.type.startsWith('image/') && !f.type.startsWith('text/') && (
                <div className="h-20 w-full flex items-center justify-center bg-slate-900/60">
                  <FileText size={28} className="text-slate-400" />
                </div>
              )}
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  {editingFileName === f.id ? (
                    <input
                      className="flex-1 min-w-0 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-sm text-white focus:outline-none"
                      value={newFileName}
                      onChange={e => setNewFileName(e.target.value)}
                      onBlur={() => {
                        if (newFileName.trim()) {
                          setFiles(prev => prev.map(fi => fi.id === f.id ? { ...fi, name: newFileName, updatedAt: new Date().toISOString() } : fi))
                        }
                        setEditingFileName(null); setNewFileName('')
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (newFileName.trim()) {
                            setFiles(prev => prev.map(fi => fi.id === f.id ? { ...fi, name: newFileName, updatedAt: new Date().toISOString() } : fi))
                          }
                          setEditingFileName(null); setNewFileName('')
                        } else if (e.key === 'Escape') { setEditingFileName(null); setNewFileName('') }
                      }}
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm font-medium text-white truncate flex-1 cursor-text"
                      onDoubleClick={() => { setEditingFileName(f.id); setNewFileName(f.name) }}
                      title="Double-click to rename"
                    >
                      {f.name}
                    </p>
                  )}
                  <button onClick={() => onDelete(f.id)} className="p-1 rounded-lg text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition" title="Delete"><Trash2 size={13} /></button>
                </div>
                {editingFileNote === f.id ? (
                  <input
                    className="w-full rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                    value={newFileNote}
                    onChange={e => setNewFileNote(e.target.value)}
                    placeholder="Category / description..."
                    onBlur={() => {
                      setFiles(prev => prev.map(fi => fi.id === f.id ? { ...fi, category: newFileNote as any, updatedAt: new Date().toISOString() } : fi))
                      setEditingFileNote(null); setNewFileNote('')
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        setFiles(prev => prev.map(fi => fi.id === f.id ? { ...fi, category: newFileNote as any, updatedAt: new Date().toISOString() } : fi))
                        setEditingFileNote(null); setNewFileNote('')
                      } else if (e.key === 'Escape') { setEditingFileNote(null); setNewFileNote('') }
                    }}
                    autoFocus
                  />
                ) : (
                  <p className="text-[10px] text-slate-500 truncate cursor-text hover:text-slate-300"
                    onDoubleClick={() => { setEditingFileNote(f.id); setNewFileNote(f.category || '') }}
                    title="Double-click to set category"
                  >
                    📁 {f.category.toUpperCase()} · {(f.dataUrl.length / 1024).toFixed(1)} KB · {new Date(f.uploadedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
