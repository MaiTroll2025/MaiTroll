import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { Loader } from '../../components/ui/loader'
import { Badge } from '../../components/ui/badge'
import AgencyStatsCard from './components/AgencyStatsCard'
import AgencyMembersTable from './components/AgencyMembersTable'
import { AgencyApplicationsTable } from './components/AgencyApplicationsTable'
import { AgencyGoalsTable } from './components/AgencyGoalsTable'
import { AgencyEarningsChart } from './components/AgencyEarningsChart'
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Clock3, FileText, RefreshCw, ShieldCheck, Sparkles, XCircle } from 'lucide-react';

type AgencyStatus = 'pending' | 'approved' | 'suspended' | 'denied' | 'under_review' | 'active' | 'inactive' | 'rejected' | string

type Agency = {
  id: string
  name: string
  slug?: string | null
  bio?: string | null
  logo_url?: string | null
  banner_url?: string | null
  status: AgencyStatus | null
  default_split_percent?: number | null
  owner_id?: string | null
  created_at?: string | null
  updated_at?: string | null
  monthly_fee_amount?: number | null
  billing_status?: string | null
  next_monthly_fee_due_at?: string | null
}

type AgencyMember = {
  id?: string
  agency_id?: string | null
  user_id?: string | null
  role?: 'owner' | 'manager' | 'creator' | 'agency_leader' | string | null
  status?: string | null
  agencies?: Agency | null
}

type AgencyApplication = {
  id: string
  agency_id?: string | null
  applicant_id?: string | null
  status?: string | null
  message?: string | null
  content_type?: string | null
  live_schedule?: string | null
  battle_interest?: string | null
  social_links?: unknown
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string | null
  application_type?: string | null
  application_fee_paid?: boolean | null
  application_fee_amount?: number | null
  fee_paid_at?: string | null
  source_family_id?: string | null
}

type AgencyContract = {
  id: string
  agency_id?: string | null
  creator_id?: string | null
  user_id?: string | null
  title?: string | null
  contract_type?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
  contract_body?: string | null
  body?: string | null
  fee_percentage?: number | null
  split_percent?: number | null
  payout_terms?: string | null
  agency_responsibilities?: string | null
  leader_responsibilities?: string | null
  termination_terms?: string | null
  effective_date?: string | null
  expiration_date?: string | null
  created_by?: string | null
  sent_at?: string | null
  signed_at?: string | null
  signed_by?: string | null
  signature_name?: string | null
  signature_note?: string | null
  signed_terms_accepted_at?: string | null
}

type ActivityLog = {
  id: string
  agency_id: string
  actor_id: string
  target_user_id?: string | null
  action: string
  metadata?: unknown
  details?: unknown
  created_at?: string | null
}

type UserRole = 'owner' | 'manager' | 'creator' | 'agency_leader' | string | null

const shellClass = 'min-h-screen overflow-y-auto bg-[#050507] text-white'
const glassPanel = 'rounded-[1.75rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/30 backdrop-blur-xl'
const softPanel = 'rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl'
const tabClass =
  'rounded-2xl border border-cyan-500/20 bg-slate-950/60 px-4 py-2 text-slate-300 data-[state=active]:border-cyan-300/40 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-100'

const statusConfig: Record<
  string,
  {
    label: string
    badge: string
    icon: React.ElementType
    headline: string
    description: string
    nextSteps: string[]
  }
> = {
  pending: {
    label: 'Pending Review',
    badge: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
    icon: Clock3,
    headline: 'Your agency application is pending HR approval.',
    description:
      'Agency HR is reviewing your application, payment status, and agency details. Your full agency dashboard unlocks after approval.',
    nextSteps: [
      'Wait for Agency HR Manager review.',
      'Check that your 25,000 Troll Coin application fee was paid.',
      'Keep your agency name, bio, and creator plan ready for approval.',
    ],
  },
  under_review: {
    label: 'Under Review',
    badge: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
    icon: FileText,
    headline: 'Your agency is actively under review.',
    description:
      'Agency HR may be checking your application details, creator roster, contract terms, or billing setup before approval.',
    nextSteps: [
      'Watch for any requested changes from Agency HR.',
      'Make sure your agency leader contract details are accurate.',
      'Do not recreate the application while review is in progress.',
    ],
  },
  approved: {
    label: 'Approved',
    badge: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
    icon: CheckCircle2,
    headline: 'Your agency is approved.',
    description: 'Your agency dashboard is ready.',
    nextSteps: ['Manage members.', 'Review applications.', 'Track goals and earnings.'],
  },
  active: {
    label: 'Active',
    badge: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
    icon: CheckCircle2,
    headline: 'Your agency is active.',
    description: 'Your agency dashboard is ready.',
    nextSteps: ['Manage members.', 'Review applications.', 'Track goals and earnings.'],
  },
  suspended: {
    label: 'Suspended',
    badge: 'border-red-300/30 bg-red-500/10 text-red-100',
    icon: AlertTriangle,
    headline: 'Your agency is suspended.',
    description:
      'Agency tools are paused. This can happen because of billing, policy review, or an Agency HR Manager action.',
    nextSteps: [
      'Contact Agency HR or admin for review.',
      'Resolve any past-due monthly agency fee.',
      'Wait for reactivation before managing creators.',
    ],
  },
  denied: {
    label: 'Denied',
    badge: 'border-red-300/30 bg-red-500/10 text-red-100',
    icon: XCircle,
    headline: 'Your agency application was denied.',
    description:
      'This application is not approved. You may need to correct information or contact Agency HR before applying again.',
    nextSteps: [
      'Review any HR notes or status updates.',
      'Prepare corrected agency details.',
      'Do not pay another application fee unless the app flow requires a new application.',
    ],
  },
  rejected: {
    label: 'Rejected',
    badge: 'border-red-300/30 bg-red-500/10 text-red-100',
    icon: XCircle,
    headline: 'Your agency application was rejected.',
    description:
      'This application is not approved. You may need to correct information or contact Agency HR before applying again.',
    nextSteps: [
      'Review any HR notes or status updates.',
      'Prepare corrected agency details.',
      'Do not pay another application fee unless the app flow requires a new application.',
    ],
  },
  inactive: {
    label: 'Inactive',
    badge: 'border-slate-300/30 bg-slate-500/10 text-slate-100',
    icon: AlertTriangle,
    headline: 'Your agency is inactive.',
    description: 'Agency tools are not available until this agency is reactivated.',
    nextSteps: ['Contact Agency HR.', 'Check billing status.', 'Wait for reactivation.'],
  },
}

const normalizeStatus = (status?: string | null) => String(status || 'pending').toLowerCase()

const getStatusConfig = (status?: string | null) => {
  const normalized = normalizeStatus(status)
  return (
    statusConfig[normalized] || {
      label: normalized.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      badge: 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100',
      icon: ShieldCheck,
      headline: `Agency status: ${normalized}`,
      description: 'Your agency status is being checked before full dashboard access is unlocked.',
      nextSteps: ['Refresh this page.', 'Check with Agency HR if this status looks wrong.', 'Wait for the next status update.'],
    }
  )
}

const safeDate = (value?: string | null) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

const renderDetails = (details: unknown) => {
  if (!details) return 'No extra details.'
  if (typeof details === 'string') return details
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return 'Details could not be displayed.'
  }
}

const normalizeContractStatus = (status?: string | null) => String(status || 'draft').trim().toLowerCase()

const contractStatusTone = (status?: string | null) => {
  const normalized = normalizeContractStatus(status)
  if (['signed', 'approved', 'active', 'completed'].includes(normalized)) return 'border-emerald-300/20 bg-emerald-500/10 text-emerald-100'
  if (['pending', 'pending_signature', 'sent', 'awaiting_signature'].includes(normalized)) return 'border-amber-300/20 bg-amber-500/10 text-amber-100'
  if (['voided', 'rejected', 'cancelled', 'expired'].includes(normalized)) return 'border-red-300/20 bg-red-500/10 text-red-100'
  return 'border-slate-300/20 bg-slate-500/10 text-slate-100'
}

const isContractAwaitingSignature = (status?: string | null) =>
  ['pending', 'pending_signature', 'sent', 'awaiting_signature'].includes(normalizeContractStatus(status))

const getContractBody = (contract?: AgencyContract | null) => {
  if (!contract) return ''
  return (
    contract.contract_body ||
    contract.body ||
    [
      contract.payout_terms ? `Payout Terms:\n${contract.payout_terms}` : '',
      contract.agency_responsibilities ? `Agency Responsibilities:\n${contract.agency_responsibilities}` : '',
      contract.leader_responsibilities ? `Agency Leader Responsibilities:\n${contract.leader_responsibilities}` : '',
      contract.termination_terms ? `Termination Terms:\n${contract.termination_terms}` : '',
    ]
      .filter(Boolean)
      .join('\n\n') ||
    'No contract body was provided.'
  )
}

export default function AgencyDashboard() {
  const { user } = useAuth()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [membership, setMembership] = useState<AgencyMember | null>(null)
  const [latestApplication, setLatestApplication] = useState<AgencyApplication | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [pendingApplications, setPendingApplications] = useState(0)
  const [activeGoals, setActiveGoals] = useState(0)
  const [contractCount, setContractCount] = useState(0)
  const [contracts, setContracts] = useState<AgencyContract[]>([])
  const [userRole, setUserRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedContract, setSelectedContract] = useState<AgencyContract | null>(null)
  const [signatureName, setSignatureName] = useState('')
  const [signatureNote, setSignatureNote] = useState('')
  const [contractAgreed, setContractAgreed] = useState(false)
   const [signingContract, setSigningContract] = useState(false)
   const navigate = useNavigate();

   const agencyStatus = normalizeStatus(agency?.status || latestApplication?.status)
  const statusInfo = getStatusConfig(agency?.status || latestApplication?.status)
  const StatusIcon = statusInfo.icon
  const isApprovedAgency = agencyStatus === 'approved' || agencyStatus === 'active'
  const isOwnerOrManager = ['owner', 'manager', 'agency_leader'].includes(String(userRole || '').toLowerCase())

  const fetchCounts = useCallback(async (agencyId: string) => {
    const [membersResult, appsResult, goalsResult, contractsResult, logsResult] = await Promise.all([
      supabase.from('agency_members').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'active'),
      supabase.from('agency_applications').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).in('status', ['pending', 'under_review', 'changes_requested']),
      supabase.from('agency_goals').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'active'),
      supabase.from('agency_contracts').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId),
      supabase
        .from('agency_activity_logs')
        .select('id, agency_id, actor_id, target_user_id, action, metadata, details, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    setMemberCount(membersResult.count || 0)
    setPendingApplications(appsResult.count || 0)
    setActiveGoals(goalsResult.count || 0)
    setContractCount(contractsResult.count || 0)

    if (!logsResult.error) {
      setActivityLogs((logsResult.data || []) as ActivityLog[])
    }
  }, [])

  const fetchContracts = useCallback(async (agencyId: string) => {
    try {
      const { data, error } = await supabase
        .from('agency_contracts')
        .select('id, agency_id, creator_id, user_id, title, contract_type, status, fee_percentage, split_percent, payout_terms, agency_responsibilities, leader_responsibilities, termination_terms, contract_body, body, effective_date, expiration_date, created_by, sent_at, signed_at, signed_by, signature_name, signature_note, signed_terms_accepted_at, created_at, updated_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.warn('Could not load agency contracts', error)
        setContracts([])
        return
      }

      setContracts((data || []) as AgencyContract[])
    } catch (err) {
      console.warn('Could not load agency contracts', err)
      setContracts([])
    }
  }, [])

  const fetchLatestApplication = useCallback(async (userId: string) => {
    const { data, error: applicationError } = await supabase
      .from('agency_applications')
      .select(
        'id, agency_id, applicant_id, status, message, content_type, live_schedule, battle_interest, social_links, reviewed_by, reviewed_at, created_at, application_type, application_fee_paid, application_fee_amount, fee_paid_at, source_family_id',
      )
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (applicationError) {
      console.warn('Could not load latest agency application', applicationError)
      return null
    }

    return (data || null) as AgencyApplication | null
  }, [])

  const fetchAgencyById = useCallback(async (agencyId: string) => {
    const { data, error: agencyError } = await supabase
      .from('agencies')
      .select(
        'id, name, slug, bio, logo_url, banner_url, status, default_split_percent, owner_id, created_at, updated_at, monthly_fee_amount, billing_status, next_monthly_fee_due_at',
      )
      .eq('id', agencyId)
      .maybeSingle()

    if (agencyError) {
      const fallback = await supabase
        .from('agencies')
        .select('id, name, slug, bio, logo_url, banner_url, status, default_split_percent, owner_id, created_at, updated_at')
        .eq('id', agencyId)
        .maybeSingle()

      if (fallback.error) throw fallback.error
      return (fallback.data || null) as Agency | null
    }

    return (data || null) as Agency | null
  }, [])

  const fetchAgencyData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setError(null)

       const { data: membershipData, error: membershipError } = await supabase
         .from('agency_members')
         .select(
           `
           *,
           agencies (
             id,
             name,
             slug,
             bio,
             logo_url,
             banner_url,
             status,
             default_split_percent,
             owner_id,
             created_at,
             updated_at,
             monthly_fee_amount,
             billing_status,
             next_monthly_fee_due_at
           )
         `,
         )
         .eq('user_id', user.id)
         .order('created_at', { ascending: false })
         .limit(1)
         .maybeSingle()

      let loadedMembership = (membershipData || null) as AgencyMember | null
      let loadedAgency = loadedMembership?.agencies || null

      if (membershipError) {
        console.warn('Agency membership join failed, using fallback loaders', membershipError)

        const fallbackMembership = await supabase
          .from('agency_members')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (fallbackMembership.error) throw fallbackMembership.error

        loadedMembership = (fallbackMembership.data || null) as AgencyMember | null
        loadedAgency = loadedMembership?.agency_id ? await fetchAgencyById(loadedMembership.agency_id) : null
      }

      const app = await fetchLatestApplication(user.id)

      if (!loadedAgency && app?.agency_id) {
        loadedAgency = await fetchAgencyById(app.agency_id)
      }

      setMembership(loadedMembership)
      setAgency(loadedAgency)
      setLatestApplication(app)
      const resolvedRole = (loadedMembership?.role || (loadedAgency?.owner_id === user.id ? 'owner' : null)) as UserRole
      setUserRole(resolvedRole)

      const isAgencyDashboardAllowed = ['owner', 'manager', 'agency_leader'].includes(String(resolvedRole || '').toLowerCase())
      if (loadedAgency?.id && loadedMembership && !isAgencyDashboardAllowed) {
        navigate(`/agency/${loadedAgency.slug || loadedAgency.id}`, { replace: true })
        return
      }

      if (loadedAgency?.id) {
        await fetchCounts(loadedAgency.id)
        await fetchContracts(loadedAgency.id)
      }

      if (!loadedAgency && !app) {
        setError('You do not have an agency application or agency membership yet.')
      }
    } catch (err: any) {
      console.error('Failed to load agency dashboard', err)
      setError(err?.message || 'We could not load your agency dashboard right now.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user.id, fetchLatestApplication, fetchAgencyById, navigate, fetchCounts, fetchContracts])

  useEffect(() => {
    void fetchAgencyData()
  }, [fetchAgencyData])

  const refresh = async () => {
    setRefreshing(true)
    await fetchAgencyData()
  }

  const ownerLabel = useMemo(() => {
    if (!agency?.owner_id) return 'Not assigned yet'
    return agency.owner_id === user?.id ? 'You' : agency.owner_id.slice(0, 8)
  }, [agency?.owner_id, user?.id])

  const contractsNeedingSignature = useMemo(
    () =>
      contracts.filter((contract) => {
        if (!isContractAwaitingSignature(contract.status)) return false
        const recipientId = contract.user_id || contract.creator_id
        if (!recipientId) return isOwnerOrManager
        return recipientId === user?.id || isOwnerOrManager
      }),
    [contracts, isOwnerOrManager, user?.id],
  )

  const openContractModal = (contract: AgencyContract) => {
    setSelectedContract(contract)
    setSignatureName(
      contract.signature_name ||
        (user as any)?.user_metadata?.full_name ||
        (user as any)?.email?.split('@')?.[0] ||
        '',
    )
    setSignatureNote('')
    setContractAgreed(false)
    setError(null)
    setSuccess(null)
  }

  const writeContractActivityLog = async (contract: AgencyContract, action: string, details: Record<string, unknown>) => {
    if (!contract.agency_id) return

    const { error: logError } = await supabase.from('agency_activity_logs').insert({
      agency_id: contract.agency_id,
      actor_id: user?.id,
      target_user_id: contract.user_id || contract.creator_id || user?.id || null,
      action,
      details,
    })

    if (logError) {
      console.warn('Failed to write agency contract activity log', logError)
    }
  }

  const signSelectedContract = async () => {
    if (!selectedContract || !user?.id) return

    if (!contractAgreed) {
      setError('You must agree to the contract terms before sending it back to Agency HR.')
      setSuccess(null)
      return
    }

    if (!signatureName.trim()) {
      setError('Enter your signature name before sending the contract back to Agency HR.')
      setSuccess(null)
      return
    }

    try {
      setSigningContract(true)
      setError(null)
      setSuccess(null)

      const signedAt = new Date().toISOString()
      const signaturePayload = {
        status: 'signed',
        signed_at: signedAt,
        signed_by: user.id,
        signature_name: signatureName.trim(),
        signature_note: signatureNote.trim() || null,
        signed_terms_accepted_at: signedAt,
        updated_at: signedAt,
      }

      const { error: signatureError } = await supabase
        .from('agency_contracts')
        .update(signaturePayload)
        .eq('id', selectedContract.id)

      if (signatureError) {
        console.warn('Full contract signature update failed, falling back to status-only update', signatureError)

        const { error: fallbackError } = await supabase
          .from('agency_contracts')
          .update({ status: 'signed' })
          .eq('id', selectedContract.id)

        if (fallbackError) throw fallbackError
      }

      await writeContractActivityLog(selectedContract, 'contract_signed_by_agency', {
        contract_id: selectedContract.id,
        contract_title: selectedContract.title || null,
        signed_by: user.id,
        signature_name: signatureName.trim(),
        signature_note: signatureNote.trim() || null,
      })

      setSelectedContract(null)
      setContractAgreed(false)
      setSignatureName('')
      setSignatureNote('')
      setSuccess('Contract signed and sent back to Agency HR.')
      await fetchAgencyData()
    } catch (err: any) {
      console.error('Failed to sign agency contract', err)
      setError(err?.message || 'Contract signature failed. Check agency_contracts columns and RLS.')
      setSuccess(null)
    } finally {
      setSigningContract(false)
    }
  }

  const renderContractInbox = () => (
    <section className={`${glassPanel} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Contract inbox</p>
          <h2 className="mt-2 text-xl font-black text-white">Contracts sent by Agency HR</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
            When Agency HR sends a contract, it appears here. Open the contract, review the terms, agree, sign, and send it back to HR.
          </p>
        </div>
        <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-100">
          {contractsNeedingSignature.length} awaiting signature
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {contracts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">
            No contracts have been sent to this agency yet.
          </div>
        ) : (
          contracts.map((contract) => {
            const awaitingSignature = isContractAwaitingSignature(contract.status)
            const canSign =
              awaitingSignature &&
              ((contract.user_id || contract.creator_id) === user?.id || isOwnerOrManager || !(contract.user_id || contract.creator_id))

            return (
              <div key={contract.id} className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-white">{contract.title || 'Untitled contract'}</h3>
                    <p className="mt-2 text-sm text-slate-400">Type: {contract.contract_type || 'agency_leader'}</p>
                    <p className="mt-1 text-xs text-slate-500">Sent: {safeDate(contract.sent_at || contract.created_at)}</p>
                    {contract.signed_at && <p className="mt-1 text-xs text-emerald-200">Signed: {safeDate(contract.signed_at)}</p>}
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${contractStatusTone(contract.status)}`}>
                    {contract.status || 'unknown'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Recipient</p>
                    <p className="mt-2 break-all text-sm font-bold text-white">{contract.user_id || contract.creator_id || 'Agency leader / owner'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Pay terms</p>
                    <p className="mt-2 text-sm font-bold text-white">{contract.payout_terms || 'Not set'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Fee percentage</p>
                    <p className="mt-2 text-sm font-bold text-white">{contract.fee_percentage ?? contract.split_percent ?? 'Unknown'}%</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button type="button" onClick={() => openContractModal(contract)} className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
                    <FileText className="mr-2 h-4 w-4" />
                    {canSign ? 'Review & Sign' : 'View Contract'}
                  </Button>
                  {awaitingSignature && !canSign && (
                    <p className="self-center text-xs text-amber-200">Awaiting signature from assigned agency leader.</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )

  if (loading) return <Loader />

  if (error && !agency && !latestApplication) {
    return (
      <div className={shellClass}>
        <BackgroundGlow />
        <main className="relative mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
          <section className={`${glassPanel} p-6 sm:p-8`}>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-red-500/10 p-3 text-red-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">Agency dashboard</p>
                <h1 className="mt-2 text-2xl font-black text-white">No agency access found</h1>
                 {error === 'You do not have an agency application or agency membership yet.' ? (
                   <p className="mt-3 text-sm leading-7 text-slate-300">
                     You do not have an agency application or agency membership yet. Please visit the Agencies page to apply.
                   </p>
                 ) : (
                   <p className="mt-3 text-sm leading-7 text-slate-300">{error}</p>
                 )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button onClick={refresh} disabled={refreshing} className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.history.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (!isApprovedAgency) {
    return (
      <div className={shellClass}>
        <BackgroundGlow />
        <main className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <section className={`${glassPanel} overflow-hidden`}>
            {agency?.banner_url ? (
              <div className="h-40 w-full bg-cover bg-center" style={{ backgroundImage: `url(${agency.banner_url})` }} />
            ) : (
              <div className="h-40 w-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),transparent_35%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(88,28,135,0.55))]" />
            )}

            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  {agency?.logo_url ? (
                    <img src={agency.logo_url} alt={`${agency.name} logo`} className="-mt-14 h-24 w-24 rounded-3xl border-4 border-[#050507] object-cover shadow-2xl shadow-cyan-950/40" />
                  ) : (
                    <div className="-mt-14 flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-[#050507] bg-slate-900 shadow-2xl shadow-cyan-950/40">
                      <Building2 className="h-10 w-10 text-cyan-200" />
                    </div>
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-3xl font-black tracking-tight text-white">{agency?.name || 'Agency Application'}</h1>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${statusInfo.badge}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                      {agency?.bio || latestApplication?.message || statusInfo.description}
                    </p>
                  </div>
                </div>

                <Button onClick={refresh} disabled={refreshing} className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Status
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusMiniCard label="Application Status" value={statusInfo.label} helper={latestApplication ? `Submitted ${safeDate(latestApplication.created_at)}` : 'No application row found'} />
            <StatusMiniCard label="Application Fee" value={latestApplication?.application_fee_paid ? 'Paid' : 'Check Required'} helper={`${latestApplication?.application_fee_amount || 25000} Troll Coins`} />
            <StatusMiniCard label="Billing Status" value={agency?.billing_status || 'Pending Approval'} helper={agency?.next_monthly_fee_due_at ? `Next due ${safeDate(agency.next_monthly_fee_due_at)}` : 'Monthly fee unlocks after approval'} />
            <StatusMiniCard label="Your Role" value={userRole || 'Applicant'} helper={membership?.status ? `Membership ${membership.status}` : 'Waiting for approval'} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div className={`${glassPanel} p-5`}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-100">
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Status center</p>
                  <h2 className="text-xl font-black text-white">{statusInfo.headline}</h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-300">{statusInfo.description}</p>

              <div className="mt-5 grid gap-3">
                {statusInfo.nextSteps.map((step) => (
                  <div key={step} className={`${softPanel} flex items-start gap-3 p-4`}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-cyan-200" />
                    <p className="text-sm text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${glassPanel} p-5`}>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Application Details</p>
              <div className="mt-4 space-y-3 text-sm">
                <DetailRow label="Application ID" value={latestApplication?.id || 'Not available'} />
                <DetailRow label="Type" value={latestApplication?.application_type || 'standard'} />
                <DetailRow label="Content Type" value={latestApplication?.content_type || 'Not provided'} />
                <DetailRow label="Live Schedule" value={latestApplication?.live_schedule || 'Not provided'} />
                <DetailRow label="Battle Interest" value={latestApplication?.battle_interest || 'Not provided'} />
                <DetailRow label="Reviewed At" value={safeDate(latestApplication?.reviewed_at)} />
                <DetailRow label="Agency Owner" value={ownerLabel} />
              </div>
            </div>
          </section>

          {renderContractInbox()}

          <section className={`${glassPanel} p-5`}>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Recent agency updates</p>
            <div className="mt-4 space-y-3">
              {activityLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                  No agency activity updates are available yet.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className={`${softPanel} p-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-bold text-white">{log.action.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-slate-500">{safeDate(log.created_at)}</p>
                    </div>
                    <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-xs text-slate-300">
                      {renderDetails(log.details || log.metadata)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

      <ContractSignatureModal
        contract={selectedContract}
        signatureName={signatureName}
        signatureNote={signatureNote}
        agreed={contractAgreed}
        signing={signingContract}
        canSign={
          !!selectedContract &&
          isContractAwaitingSignature(selectedContract.status) &&
          (((selectedContract.user_id || selectedContract.creator_id) === user?.id) ||
            isOwnerOrManager ||
            !(selectedContract.user_id || selectedContract.creator_id))
        }
        onSignatureNameChange={setSignatureName}
        onSignatureNoteChange={setSignatureNote}
        onAgreedChange={setContractAgreed}
        onClose={() => setSelectedContract(null)}
        onSign={signSelectedContract}
      />
      </div>
    )
  }

  if (!isOwnerOrManager) {
    return (
      <div className={shellClass}>
        <BackgroundGlow />
        <main className="relative mx-auto max-w-xl px-4 py-8">
          <div className={`${glassPanel} p-6`}>
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-100">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Agency member access</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Your agency is approved, but only owners, agency leaders, and managers can access the management dashboard.
                </p>
                <p className="mt-3 text-sm text-slate-400">Your current agency role: {userRole || 'member'}</p>
                 <Button variant="outline" className="mt-6 border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => navigate(`/agency/${agency?.slug || agency?.id}`)}>
                   Go Back
                 </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <BackgroundGlow />
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className={`${glassPanel} mb-6 overflow-hidden`}>
          {agency?.banner_url ? (
            <div className="h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url(${agency.banner_url})` }} />
          ) : (
            <div className="h-44 w-full bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.26),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.20),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))]" />
          )}

          <div className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex gap-4">
                {agency?.logo_url ? (
                  <img src={agency.logo_url} alt={`${agency.name} logo`} className="-mt-14 h-24 w-24 rounded-3xl border-4 border-[#050507] object-cover shadow-2xl shadow-cyan-950/40" />
                ) : (
                  <div className="-mt-14 flex h-24 w-24 items-center justify-center rounded-3xl border-4 border-[#050507] bg-slate-900 shadow-2xl shadow-cyan-950/40">
                    <span className="text-4xl font-black text-cyan-200">{agency?.name?.charAt(0) || 'A'}</span>
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-3xl font-black text-white">{agency?.name}</h2>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-300">
                      Approved
                    </Badge>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                      {userRole}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Owner: <span className="text-cyan-300">@{ownerLabel}</span>
                  </p>
                  {agency?.bio && <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{agency.bio}</p>}
                </div>
              </div>

              <Button onClick={refresh} disabled={refreshing} className="bg-cyan-500/20 text-cyan-50 hover:bg-cyan-500/30">
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                👥 {memberCount} Creators
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                📄 {pendingApplications} Pending Apps
              </Badge>
              <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                🎯 {activeGoals} Active Goals
              </Badge>
              <Badge variant="outline" className="border-pink-500/30 text-pink-300">
                📝 {contractCount} Contracts
              </Badge>
            </div>
          </div>
        </section>

        {(error || success) && (
          <div
            className={`mb-6 rounded-[1.5rem] border px-4 py-3 text-sm ${
              error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
            }`}
          >
            {error || success}
          </div>
        )}

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-2 border border-white/10 bg-black/30 p-2 backdrop-blur-xl">
            <TabsTrigger value="overview" className={tabClass}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" className={tabClass}>
              Members
            </TabsTrigger>
            <TabsTrigger value="applications" className={tabClass}>
              Applications
            </TabsTrigger>
            <TabsTrigger value="contracts" className={tabClass}>
              Contracts
            </TabsTrigger>
            <TabsTrigger value="invites" className={tabClass}>
              Invites
            </TabsTrigger>
            <TabsTrigger value="goals" className={tabClass}>
              Goals
            </TabsTrigger>
            <TabsTrigger value="earnings" className={tabClass}>
              Earnings
            </TabsTrigger>
            <TabsTrigger value="activity" className={tabClass}>
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <AgencyStatsCard label="Live Hours This Week" value="0" icon="⏰" color="blue" />
                <AgencyStatsCard label="Gift Earnings This Week" value="0 coins" icon="🎁" color="purple" />
                <AgencyStatsCard label="Battles This Week" value="0" icon="⚔️" color="pink" />
                <AgencyStatsCard label="Active Creators" value={String(memberCount)} icon="👥" color="cyan" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Button variant="default" className="w-full bg-cyan-500/20 px-6 py-3 text-cyan-50 hover:bg-cyan-500/30" onClick={() => alert('Edit agency profile')}>
                  Edit Agency Profile
                </Button>

                <Button variant="outline" className="w-full border border-cyan-500/30 bg-transparent px-6 py-3 text-cyan-50 hover:bg-cyan-500/10" onClick={() => alert('Upload new logo/banner')}>
                  Update Agency Media
                </Button>
              </div>

              <div className={`${glassPanel} p-5`}>
                <h3 className="mb-3 text-lg font-black text-cyan-300">Recent Activity</h3>
                <div className="space-y-3">
                  {activityLogs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                      No activity has been logged for this agency yet.
                    </div>
                  ) : (
                    activityLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="flex items-center space-x-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/20">
                          <Sparkles className="h-4 w-4 text-cyan-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{log.action.replaceAll('_', ' ')}</p>
                          <p className="text-xs text-slate-400">{safeDate(log.created_at)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <AgencyMembersTable agencyId={agency!.id} currentUserId={user?.id} canManage={isOwnerOrManager} />
          </TabsContent>

          <TabsContent value="applications">
            <AgencyApplicationsTable agencyId={agency!.id} currentUserId={user?.id} canManage={isOwnerOrManager} />
          </TabsContent>

          <TabsContent value="contracts">
            {renderContractInbox()}
          </TabsContent>

          <TabsContent value="goals">
            <AgencyGoalsTable agencyId={agency!.id} userRole={userRole} />
          </TabsContent>

          <TabsContent value="earnings">
            <AgencyEarningsChart agencyId={agency!.id} />
          </TabsContent>

          <TabsContent value="activity">
            <div className={`${glassPanel} p-6`}>
              <h3 className="mb-4 text-lg font-black text-cyan-300">Agency Activity Log</h3>
              <div className="space-y-3">
                {activityLogs.length === 0 ? (
                  <p className="text-slate-400">No agency activity logs are available yet.</p>
                ) : (
                  activityLogs.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <p className="font-bold text-white">{log.action.replaceAll('_', ' ')}</p>
                        <p className="text-xs text-slate-500">{safeDate(log.created_at)}</p>
                      </div>
                      <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-3 text-xs text-slate-300">
                        {renderDetails(log.details || log.metadata)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <ContractSignatureModal
        contract={selectedContract}
        signatureName={signatureName}
        signatureNote={signatureNote}
        agreed={contractAgreed}
        signing={signingContract}
        canSign={
          !!selectedContract &&
          isContractAwaitingSignature(selectedContract.status) &&
          (((selectedContract.user_id || selectedContract.creator_id) === user?.id) ||
            isOwnerOrManager ||
            !(selectedContract.user_id || selectedContract.creator_id))
        }
        onSignatureNameChange={setSignatureName}
        onSignatureNoteChange={setSignatureNote}
        onAgreedChange={setContractAgreed}
        onClose={() => setSelectedContract(null)}
        onSign={signSelectedContract}
      />
    </div>
  )
}


function ContractSignatureModal({
  contract,
  signatureName,
  signatureNote,
  agreed,
  signing,
  canSign,
  onSignatureNameChange,
  onSignatureNoteChange,
  onAgreedChange,
  onClose,
  onSign,
}: {
  contract: AgencyContract | null
  signatureName: string
  signatureNote: string
  agreed: boolean
  signing: boolean
  canSign: boolean
  onSignatureNameChange: (value: string) => void
  onSignatureNoteChange: (value: string) => void
  onAgreedChange: (value: boolean) => void
  onClose: () => void
  onSign: () => void
}) {
  if (!contract) return null

  const contractBody = getContractBody(contract)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#070812] shadow-2xl shadow-cyan-950/40">
        <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Agency contract</p>
            <h2 className="mt-2 text-2xl font-black text-white">{contract.title || 'Untitled contract'}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full border px-3 py-1 font-black ${contractStatusTone(contract.status)}`}>
                {contract.status || 'unknown'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold text-slate-300">
                {contract.contract_type || 'agency_leader'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold text-slate-300">
                Sent {safeDate(contract.sent_at || contract.created_at)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(92vh-11rem)] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Fee / split</p>
              <p className="mt-2 text-sm font-black text-white">{contract.fee_percentage ?? contract.split_percent ?? 'Unknown'}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Effective</p>
              <p className="mt-2 text-sm font-black text-white">{safeDate(contract.effective_date)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Expires</p>
              <p className="mt-2 text-sm font-black text-white">{safeDate(contract.expiration_date)}</p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/40 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Contract terms</p>
            <pre className="mt-4 max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-black/40 p-4 text-sm leading-7 text-slate-100">
              {contractBody}
            </pre>
          </div>

          <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-cyan-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Sign and send back to Agency HR</p>

            {canSign ? (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Signature name</span>
                  <input
                    value={signatureName}
                    onChange={(event) => onSignatureNameChange(event.target.value)}
                    placeholder="Type your legal/display signature"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Optional note to Agency HR</span>
                  <textarea
                    value={signatureNote}
                    onChange={(event) => onSignatureNoteChange(event.target.value)}
                    placeholder="Add a note before sending back..."
                    rows={3}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => onAgreedChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-black"
                  />
                  <span className="text-sm leading-6 text-slate-200">
                    I have reviewed this agency contract, agree to the terms shown above, and want to send my signed agreement back to Agency HR.
                  </span>
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={onSign}
                    disabled={signing || !agreed || !signatureName.trim()}
                    className="bg-emerald-500/20 text-emerald-50 hover:bg-emerald-500/30"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {signing ? 'Sending signed contract…' : 'Agree, Sign & Send Back'}
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-slate-300">
                This contract is not currently assigned to your signature or it has already been signed/closed.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


function BackgroundGlow() {
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.15),transparent_28%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_32%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
    </div>
  )
}

function StatusMiniCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className={`${glassPanel} p-5`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="break-all text-sm font-bold text-slate-100">{value}</span>
    </div>
  )
}
