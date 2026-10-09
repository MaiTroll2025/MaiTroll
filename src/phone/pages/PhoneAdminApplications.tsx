import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Clock,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { neonCard, neonTextGradient } from '../phoneTheme'

interface AppUser {
  username?: string | null
  email?: string | null
  role?: string | null
  created_at?: string | null
}

interface PlatformApplication {
  id: string
  user_id: string
  type: string
  status: string
  created_at: string
  store_name?: string | null
  user_profiles?: AppUser | AppUser[] | null
}

interface CareerApplication {
  id: string
  user_id: string
  position_id: string | null
  status: string
  created_at: string
  lead_officer_approved?: boolean | null
  lead_officer_reviewed_at?: string | null
  application_data?: Record<string, unknown> | null
  user_profiles?: AppUser | AppUser[] | null
}

interface JobApplication {
  id: string
  user_id: string
  position_id: string
  status: string
  created_at: string
  user_profiles?: AppUser | AppUser[] | null
}

interface FastPayApplication {
  id: string
  user_id: string
  payout_method: string
  payout_username: string
  user_level: number
  has_verified_identity: boolean
  has_violations: boolean
  has_fraud_history: boolean
  status: string
  created_at: string
  user_profiles?: AppUser | AppUser[] | null
}

const SOURCE_TABS = ['careers', 'platform', 'jobs', 'fastpay'] as const
type SourceTab = (typeof SOURCE_TABS)[number]

const SOURCE_LABELS: Record<SourceTab, string> = {
  careers: 'Careers',
  platform: 'Platform',
  jobs: 'Jobs',
  fastpay: 'Fast Pay',
}

const STATUS_TABS = ['pending', 'approved', 'rejected', 'all'] as const
type StatusTab = (typeof STATUS_TABS)[number]

const PENDING_STATUSES = new Set(['pending', 'applied', 'submitted', 'under_review', 'interview_scheduled'])

const CAREER_ROLE_LABELS: Record<string, string> = {
  broadcaster: 'Broadcaster',
  marketing_agent: 'Marketing Agent',
  lead_troll_officer: 'Lead Troll Officer',
  troll_officer: 'Troll Officer',
  secretary: 'Secretary',
  prosecutor: 'Prosecutor',
  attorney: 'Troll Court Attorney',
  judge: 'Judge',
  auctioneer: 'Auctioneer',
  pastor: 'Pastor',
  journalist: 'Journalist',
  tcnn_news_caster: 'TCNN News Caster',
  tcnn_chief_news_caster: 'TCNN Chief News Caster',
  agency_hr: 'Agency HR',
  agency_hr_manager: 'Agency HR Manager',
  agency_leader: 'Agency Leader',
  hr_manager: 'HR Manager',
}

/** Profile columns granted when a career application is approved. */
const CAREER_ROLE_PROFILE_COLUMNS: Record<string, Record<string, boolean>> = {
  broadcaster: { is_broadcaster: true },
  troll_officer: { is_troll_officer: true, is_officer_active: true },
  lead_troll_officer: { is_lead_officer: true, is_officer_active: true },
  attorney: { is_attorney: true },
  prosecutor: { is_prosecutor: true },
  pastor: { is_pastor: true },
  journalist: { is_journalist: true },
  auctioneer: { is_auctioneer: true },
  secretary: { is_secretary: true },
}

const PLATFORM_TYPE_LABELS: Record<string, string> = {
  seller: 'Seller',
  troll_officer: 'Troll Officer',
  lead_officer: 'Lead Troll Officer',
  auctioneer: 'Auctioneer',
  secretary: 'Secretary',
  journalist: 'Journalist',
  tcnn_news_caster: 'TCNN News Caster',
  tcnn_chief_news_caster: 'TCNN Chief News Caster',
  prosecutor: 'Prosecutor',
  attorney: 'Attorney',
  agency_hr: 'Agency HR',
  agency_hr_manager: 'Agency HR Manager',
  agency_leader: 'Agency Leader',
  ceo_assistant: 'CEO Assistant',
  noah_assistant: 'Noah Assistant',
}

type ReviewDecision = 'approve' | 'deny'

interface ReviewRow {
  key: string
  title: string
  status: string
  created_at: string
  user: AppUser | null
  leadOfficerApproved: boolean | null
  notes?: string
  review: (decision: ReviewDecision) => Promise<void>
}

function firstProfile(value: AppUser | AppUser[] | null | undefined): AppUser | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function titleize(value: string | null | undefined): string {
  if (!value) return 'Unknown'
  const known = CAREER_ROLE_LABELS[value] || PLATFORM_TYPE_LABELS[value]
  if (known) return known
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function isPending(status: string): boolean {
  return PENDING_STATUSES.has(status)
}

export default function PhoneAdminApplications() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuthStore()

  const isAdmin = useMemo(
    () =>
      (profile?.role && ['admin', 'ceo', 'superadmin', 'secretary'].includes(profile.role)) ||
      (profile?.troll_role && ['admin', 'ceo', 'superadmin', 'secretary'].includes(profile.troll_role)) ||
      profile?.is_admin === true,
    [profile]
  )

  const [source, setSource] = useState<SourceTab>('careers')
  const [statusTab, setStatusTab] = useState<StatusTab>('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [platformApps, setPlatformApps] = useState<PlatformApplication[]>([])
  const [careerApps, setCareerApps] = useState<CareerApplication[]>([])
  const [jobApps, setJobApps] = useState<JobApplication[]>([])
  const [fastPayApps, setFastPayApps] = useState<FastPayApplication[]>([])

  const loadGuard = useRef(false)

  const loadApplications = useCallback(async (silent = false) => {
    if (loadGuard.current) return
    loadGuard.current = true
    if (silent) setRefreshing(true)
    else setLoading(true)

    try {
      const [platformRes, careerRes, jobRes, fastPayRes] = await Promise.all([
        supabase
          .from('applications')
          .select('id, user_id, type, status, created_at, store_name, user_profiles!user_id(username, email)')
          .neq('status', 'deleted')
          .order('created_at', { ascending: false }),
        supabase
          .from('career_applications')
          .select(
            'id, user_id, position_id, status, created_at, lead_officer_approved, lead_officer_reviewed_at, application_data, user_profiles!user_id(username, email)'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('job_applications')
          .select('id, user_id, position_id, status, created_at, user_profiles!user_id(username, email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('fast_pay_applications')
          .select(
            'id, user_id, payout_method, payout_username, user_level, has_verified_identity, has_violations, has_fraud_history, status, created_at, user_profiles!user_id(username, email)'
          )
          .order('created_at', { ascending: false }),
      ])

      setPlatformApps((platformRes.data as PlatformApplication[]) || [])
      setCareerApps((careerRes.data as CareerApplication[]) || [])
      setJobApps((jobRes.data as JobApplication[]) || [])
      setFastPayApps((fastPayRes.data as FastPayApplication[]) || [])

      const failure = [platformRes, careerRes, jobRes, fastPayRes].find((r) => r.error)
      if (failure?.error) console.error('[PhoneAdminApplications] load error:', failure.error)
    } catch (err) {
      console.error('[PhoneAdminApplications] load error:', err)
      toast.error('Failed to load applications')
    } finally {
      loadGuard.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    void loadApplications()
  }, [isAdmin, loadApplications])

  useEffect(() => {
    if (!isAdmin) return

    let debounce: number | undefined
    const handleChange = () => {
      if (debounce) window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void loadApplications(true), 500)
    }

    const channel = supabase
      .channel('phone_admin_applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'career_applications' }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fast_pay_applications' }, handleChange)
      .subscribe()

    return () => {
      if (debounce) window.clearTimeout(debounce)
      supabase.removeChannel(channel)
    }
  }, [isAdmin, loadApplications])

  /* ----------------------------------------------------------------------- */
  /* Review actions                                                           */
  /* ----------------------------------------------------------------------- */

  const grantCareerRole = useCallback(async (app: CareerApplication) => {
    const position = app.position_id
    if (!position) throw new Error('Career application is missing its role.')

    const { error: roleError } = await supabase.rpc('set_user_role', {
      target_user: app.user_id,
      new_role: position,
      reason: `Approved career application ${app.id}`,
      acting_admin_id: user?.id ?? null,
    })
    if (roleError) throw roleError

    const patch: Record<string, unknown> = { job_title: position }
    const flags = CAREER_ROLE_PROFILE_COLUMNS[position]
    if (flags) Object.assign(patch, flags)

    const { error } = await supabase.from('user_profiles').update(patch).eq('id', app.user_id)
    if (error) throw error
  }, [user?.id])

  const reviewCareer = useCallback(
    async (app: CareerApplication, decision: 'approve' | 'deny') => {
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      const status = decision === 'approve' ? 'approved' : 'rejected'
      setBusyId(app.id)

      try {
        const { error } = await supabase
          .from('career_applications')
          .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
          .eq('id', app.id)
        if (error) throw error

        if (decision === 'approve') {
          await grantCareerRole(app)
          await refreshProfile?.()
        }

        setCareerApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)))
        toast.success(decision === 'approve' ? 'Career application approved' : 'Career application denied')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to review career application'
        toast.error(message)
        await loadApplications(true)
      } finally {
        setBusyId(null)
      }
    },
    [user, grantCareerRole, refreshProfile, loadApplications]
  )

  const reviewPlatform = useCallback(
    async (app: PlatformApplication, decision: 'approve' | 'deny') => {
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      setBusyId(app.id)

      try {
        const { data, error } = await supabase.functions.invoke('admin-actions', {
          body:
            decision === 'approve'
              ? { action: 'approve_application', applicationId: app.id, type: app.type, userId: app.user_id }
              : { action: 'deny_application', applicationId: app.id, reason: null },
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)

        const status = decision === 'approve' ? 'approved' : 'rejected'
        setPlatformApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)))
        toast.success(decision === 'approve' ? 'Application approved' : 'Application denied')
        await refreshProfile?.()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to review application'
        toast.error(message)
        await loadApplications(true)
      } finally {
        setBusyId(null)
      }
    },
    [user, refreshProfile, loadApplications]
  )

  const reviewJob = useCallback(
    async (app: JobApplication, decision: 'approve' | 'deny') => {
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      const status = decision === 'approve' ? 'approved' : 'rejected'
      setBusyId(app.id)

      try {
        const { error } = await supabase
          .from('job_applications')
          .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
          .eq('id', app.id)
        if (error) throw error

        if (decision === 'approve') {
          const { error: profileError } = await supabase
            .from('user_profiles')
            .update({ role: app.position_id })
            .eq('id', app.user_id)
          if (profileError) throw profileError
        }

        setJobApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)))
        toast.success(decision === 'approve' ? 'Job application approved' : 'Job application denied')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to review job application'
        toast.error(message)
        await loadApplications(true)
      } finally {
        setBusyId(null)
      }
    },
    [user, loadApplications]
  )

  const reviewFastPay = useCallback(
    async (app: FastPayApplication, decision: 'approve' | 'deny') => {
      if (!user) {
        toast.error('You must be logged in')
        return
      }

      setBusyId(app.id)

      try {
        const { error } = await supabase.rpc('review_fast_pay_application', {
          p_application_id: app.id,
          p_new_status: decision === 'approve' ? 'approved' : 'rejected',
          p_admin_notes: decision === 'approve' ? 'Approved from phone admin console' : null,
        })
        if (error) throw error

        const status = decision === 'approve' ? 'approved' : 'rejected'
        setFastPayApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)))
        toast.success(decision === 'approve' ? 'Fast Pay application approved' : 'Fast Pay application denied')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to review Fast Pay application'
        toast.error(message)
        await loadApplications(true)
      } finally {
        setBusyId(null)
      }
    },
    [user, loadApplications]
  )

  /* ----------------------------------------------------------------------- */
  /* Filtering                                                                */
  /* ----------------------------------------------------------------------- */

  const sourceCounts = useMemo(
    () => ({
      careers: careerApps.filter((a) => isPending(a.status)).length,
      platform: platformApps.filter((a) => isPending(a.status)).length,
      jobs: jobApps.filter((a) => isPending(a.status)).length,
      fastpay: fastPayApps.filter((a) => isPending(a.status)).length,
    }),
    [careerApps, platformApps, jobApps, fastPayApps]
  )

  const pendingTotal = useMemo(
    () => sourceCounts.careers + sourceCounts.platform + sourceCounts.jobs + sourceCounts.fastpay,
    [sourceCounts]
  )

  const activeRows = useMemo<ReviewRow[]>(() => {
    const query = search.trim().toLowerCase()

    const matchesSearch = (username?: string | null, extra?: string | null) =>
      !query ||
      (username ?? '').toLowerCase().includes(query) ||
      (extra ?? '').toLowerCase().includes(query)

    const matchesStatus = (status: string) =>
      statusTab === 'all' ? true : statusTab === 'pending' ? isPending(status) : status === statusTab

    if (source === 'careers') {
      return careerApps
        .filter((a) => matchesStatus(a.status))
        .filter((a) => matchesSearch(firstProfile(a.user_profiles)?.username, a.position_id))
        .map((a) => ({
          key: a.id,
          title: titleize(a.position_id),
          status: a.status,
          created_at: a.created_at,
          user: firstProfile(a.user_profiles),
          leadOfficerApproved: a.lead_officer_approved ?? null,
          review: (decision) => reviewCareer(a, decision),
        }))
    }

    if (source === 'platform') {
      return platformApps
        .filter((a) => matchesStatus(a.status))
        .filter((a) => matchesSearch(firstProfile(a.user_profiles)?.username, a.type))
        .map((a) => ({
          key: a.id,
          title: titleize(a.type),
          status: a.status,
          created_at: a.created_at,
          user: firstProfile(a.user_profiles),
          leadOfficerApproved: null,
          review: (decision) => reviewPlatform(a, decision),
        }))
    }

    if (source === 'jobs') {
      return jobApps
        .filter((a) => matchesStatus(a.status))
        .filter((a) => matchesSearch(firstProfile(a.user_profiles)?.username, a.position_id))
        .map((a) => ({
          key: a.id,
          title: titleize(a.position_id),
          status: a.status,
          created_at: a.created_at,
          user: firstProfile(a.user_profiles),
          leadOfficerApproved: null,
          review: (decision) => reviewJob(a, decision),
        }))
    }

    return fastPayApps
      .filter((a) => matchesStatus(a.status))
      .filter((a) => matchesSearch(firstProfile(a.user_profiles)?.username, a.payout_username))
      .map((a) => ({
        key: a.id,
        title: `Fast Pay - ${a.payout_method} ${a.payout_username}`,
        status: a.status,
        created_at: a.created_at,
        user: firstProfile(a.user_profiles),
        leadOfficerApproved: null,
        review: (decision) => reviewFastPay(a, decision),
        notes: `Level ${a.user_level} • ID ${a.has_verified_identity ? 'verified' : 'missing'}${
          a.has_violations ? ' • violations' : ''
        }${a.has_fraud_history ? ' • fraud history' : ''}`,
      }))
  }, [
    source,
    statusTab,
    search,
    careerApps,
    platformApps,
    jobApps,
    fastPayApps,
    reviewCareer,
    reviewPlatform,
    reviewJob,
    reviewFastPay,
  ])

  /* ----------------------------------------------------------------------- */
  /* Render                                                                   */
  /* ----------------------------------------------------------------------- */

  if (!isAdmin) {
    return (
      <div className="relative min-h-screen w-full bg-[#05010f] text-white">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
          <button
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={28} className="text-white" />
          </button>
          <h1 className={`text-sm font-black uppercase tracking-widest ${neonTextGradient}`}>Applications</h1>
          <div className="w-12" />
        </header>
        <main className="p-6 text-center text-sm text-zinc-400">Access denied. Admin privileges required.</main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full bg-[#05010f] text-white pb-8">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#00BFFF]/20 bg-[#05010f]/90 px-4 py-3 backdrop-blur-2xl">
        <button
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white active:scale-95"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={28} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
        </button>
        <div className="text-center">
          <h1 className={`text-sm font-black uppercase tracking-widest ${neonTextGradient}`}>Applications</h1>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
            {pendingTotal} pending review
          </p>
        </div>
        <button
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white active:scale-95"
          onClick={() => loadApplications(true)}
          disabled={refreshing}
          aria-label="Refresh applications"
        >
          <RefreshCw size={28} className={cn(refreshing && 'animate-spin', 'text-white')} />
        </button>
      </header>

      <main className="space-y-4 p-4">
        <section className={neonCard}>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search applicant or position..."
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-400/40 focus:outline-none"
              />
            </div>

            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {SOURCE_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSource(tab)}
                  className={cn(
                    'whitespace-nowrap rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition',
                    source === tab
                      ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-200'
                      : 'border-white/10 bg-white/5 text-zinc-400'
                  )}
                >
                  {SOURCE_LABELS[tab]}
                  {sourceCounts[tab] > 0 && <span className="ml-1 text-yellow-300">({sourceCounts[tab]})</span>}
                </button>
              ))}
            </div>

            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusTab(tab)}
                  className={cn(
                    'whitespace-nowrap rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition',
                    statusTab === tab
                      ? 'border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200'
                      : 'border-white/10 bg-white/5 text-zinc-400'
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${neonCard} h-32 animate-pulse`} />
            ))}
          </div>
        ) : activeRows.length === 0 ? (
          <div className={`${neonCard} p-8 text-center`}>
            <FileCheck2 className="mx-auto h-10 w-10 text-zinc-600" />
            <p className="mt-3 text-sm text-zinc-400">
              No {SOURCE_LABELS[source].toLowerCase()} applications match this filter
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRows.map((row) => {
              const pending = isPending(row.status)
              const busy = busyId === row.key

              return (
                <article key={row.key} className={`${neonCard} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">{row.title}</p>
                      <p className="mt-1 truncate text-xs text-zinc-300">
                        {row.user?.username ? `@${row.user.username}` : 'Unknown applicant'}
                      </p>
                      {row.user?.email && <p className="truncate text-[11px] text-zinc-500">{row.user.email}</p>}
                      {row.notes && <p className="mt-1 text-[11px] text-amber-300/80">{row.notes}</p>}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                            pending
                              ? 'border-yellow-400/30 bg-yellow-500/10 text-yellow-300'
                              : row.status === 'approved'
                                ? 'border-green-400/30 bg-green-500/10 text-green-300'
                                : 'border-red-400/30 bg-red-500/10 text-red-300'
                          )}
                        >
                          {row.status}
                        </span>
                        {row.leadOfficerApproved === true && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                            ✓ Officer approved
                          </span>
                        )}
                        {row.leadOfficerApproved === false && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-red-400">
                            ✗ Officer denied
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-500">{relativeTime(row.created_at)}</span>
                      </div>
                    </div>

                    {busy && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" />}
                  </div>

                  {pending && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => row.review('approve')}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-green-400/40 bg-green-500/15 py-2.5 text-[11px] font-black uppercase tracking-wider text-green-300 active:scale-95 disabled:opacity-40"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => row.review('deny')}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-red-400/40 bg-red-500/15 py-2.5 text-[11px] font-black uppercase tracking-wider text-red-300 active:scale-95 disabled:opacity-40"
                      >
                        <X size={14} /> Deny
                      </button>
                    </div>
                  )}

                  {!pending && (
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                      {row.status === 'approved' ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle size={13} /> Approved
                        </span>
                      ) : row.status === 'rejected' ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle size={13} /> Denied
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Clock size={13} /> {titleize(row.status)}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}