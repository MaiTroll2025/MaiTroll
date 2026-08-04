import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { getRoleDisplayName, supabase } from '@/lib/supabase'
import { isAgencyHRProfile } from '@/lib/staff'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  FileSignature,
  FileText,
  Gavel,
  PencilLine,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'

type DashboardTab = 'overview' | 'applications' | 'contracts' | 'fees' | 'agencies' | 'reports' | 'audit'

type AgencyRow = {
  id: string
  name: string
  status: string | null
  created_at: string | null
  agency_fee_percent?: number | null
  platform_fee_percent?: number | null
  leader_commission_percent?: number | null
  recruiter_commission_percent?: number | null
  fee_updated_at?: string | null
  fee_updated_by?: string | null
}

type AgencyPreview = AgencyRow & {
  member_count: number
  pending_applications: number
  pending_contracts: number
}

type AgencyApplication = {
  id: string
  agency_id: string | null
  applicant_id: string | null
  message?: string | null
  content_type?: string | null
  live_schedule?: string | null
  battle_interest?: string | null
  social_links?: unknown
  status: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at: string | null
  recruiter_user_id?: string | null
  recruiter_bonus_paid?: boolean | null
  recruiter_bonus_paid_at?: string | null
}

type AgencyContract = {
  id: string
  agency_id: string | null
  creator_id?: string | null
  user_id?: string | null
  title?: string | null
  contract_type?: string | null
  contract_body?: string | null
  body?: string | null
  status: string | null
  fee_percentage?: number | null
  payout_terms?: string | null
  effective_date?: string | null
  expiration_date?: string | null
  created_at: string | null
  agencies?: { id: string; name: string } | null
}

type ActivityLog = {
  id: string
  action: string
  details: unknown
  created_at: string
  agency_id: string | null
  agencies?: { id: string; name: string } | null
}

type ContractForm = {
  agency_id: string
  leader_id: string
  title: string
  contract_type: string
  fee_percentage: string
  payout_terms: string
  agency_responsibilities: string
  leader_responsibilities: string
  termination_terms: string
  contract_body: string
  effective_date: string
  expiration_date: string
}

type FeeForm = {
  agency_id: string
  agency_fee_percent: string
  platform_fee_percent: string
  leader_commission_percent: string
  recruiter_commission_percent: string
  reason: string
}

type ReportForm = {
  agency_id: string
  title: string
  severity: string
  category: string
  notes: string
}

const statsCardClasses =
  'rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/30 backdrop-blur-xl'

const panelClasses =
  'rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/30 backdrop-blur-xl'

const inputClasses =
  'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20'

const labelClasses = 'text-xs font-black uppercase tracking-[0.16em] text-slate-300'

const primaryButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50'

const dangerButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-black text-red-50 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50'

const softButtonClasses =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'

const tabs: Array<{ id: DashboardTab; label: string }> = [
   { id: 'overview', label: 'Overview' },
   { id: 'applications', label: 'Applications' },
   { id: 'contracts', label: 'Contracts' },
   { id: 'fees', label: 'Fees' },
   { id: 'agencies', label: 'Agencies' },
   { id: 'reports', label: 'Reports' },
   { id: 'audit', label: 'Audit Logs' },
 ]

const parseNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const safeDate = (value?: string | null) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString()
}

const safeShortDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

const renderDetails = (details: unknown) => {
  if (!details) return 'No additional details recorded.'
  if (typeof details === 'string') return details
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return 'Details could not be displayed.'
  }
}

const statusTone = (status?: string | null) => {
  const normalized = (status || '').toLowerCase()
  if (['approved', 'active', 'completed', 'signed'].includes(normalized)) return 'bg-emerald-500/10 text-emerald-100 border-emerald-300/20'
  if (['pending', 'pending_signature', 'under_review', 'changes_requested'].includes(normalized)) return 'bg-amber-500/10 text-amber-100 border-amber-300/20'
  if (['rejected', 'void', 'voided', 'suspended'].includes(normalized)) return 'bg-red-500/10 text-red-100 border-red-300/20'
  return 'bg-cyan-500/10 text-cyan-100 border-cyan-300/20'
}

type DashboardErrorInfo = {
  message: string
  label?: string
  code?: string | null
  details?: string | null
  hint?: string | null
  status?: number | null
  raw?: any
}

const serializeDashboardError = (error: any): DashboardErrorInfo => {
  if (!error) {
    return {
      message: 'Unknown dashboard error',
      raw: error,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error || 'Empty string error',
      raw: error,
    }
  }

  const message =
    error.message ||
    error.error_description ||
    error.error ||
    error.details ||
    error.hint ||
    error.statusText ||
    ''

  return {
    message: message || JSON.stringify(error) || 'Dashboard error returned no message',
    code: error.code || null,
    details: error.details || null,
    hint: error.hint || null,
    status: error.status || null,
    raw: error,
  }
}

const runDashboardQuery = async <T,>(
  label: string,
  query: PromiseLike<{ data: T; error: any; count?: number | null }>,
): Promise<{ data: T; count?: number | null }> => {
  console.log(`[AgencyHRDashboard] starting: ${label}`)

  const result = await query

  if (result.error) {
    const serialized = serializeDashboardError(result.error)

    console.error(`[AgencyHRDashboard] failed: ${label}`, {
      label,
      ...serialized,
    })

    const err = new Error(`${label} failed: ${serialized.message}`)
    ;(err as any).label = label
    ;(err as any).supabaseError = serialized
    throw err
  }

  console.log(`[AgencyHRDashboard] loaded: ${label}`, {
    label,
    count: result.count ?? (Array.isArray(result.data) ? result.data.length : null),
    hasData: !!result.data,
  })

  return {
    data: result.data,
    count: result.count,
  }
}

const runOptionalDashboardQuery = async <T,>(
  label: string,
  query: PromiseLike<{ data: T; error: any; count?: number | null }>,
  fallbackData: T,
): Promise<{ data: T; count?: number | null }> => {
  try {
    return await runDashboardQuery(label, query)
  } catch (error) {
    const serialized = serializeDashboardError(error)
    console.warn(`[AgencyHRDashboard] optional query failed, using fallback: ${label}`, serialized)

    return {
      data: fallbackData,
      count: 0,
    }
  }
}

export default function AgencyHRDashboard() {
  const { user, profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [approvedAgencies, setApprovedAgencies] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0)
  const [pendingContractsCount, setPendingContractsCount] = useState(0)
  const [pendingInvites, setPendingInvites] = useState(0)
  const [activeGoals, setActiveGoals] = useState(0)
  const [agencies, setAgencies] = useState<AgencyRow[]>([])
  const [topAgencies, setTopAgencies] = useState<AgencyPreview[]>([])
  const [applications, setApplications] = useState<AgencyApplication[]>([])
  const [contracts, setContracts] = useState<AgencyContract[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('')
  const [applicationNote, setApplicationNote] = useState('')
  const [agencyStatusReason, setAgencyStatusReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [contractForm, setContractForm] = useState<ContractForm>({
    agency_id: '',
    leader_id: '',
    title: '',
    contract_type: 'agency_leader',
    fee_percentage: '',
    payout_terms: '',
    agency_responsibilities: '',
    leader_responsibilities: '',
    termination_terms: '',
    contract_body: '',
    effective_date: '',
    expiration_date: '',
  })

  const [feeForm, setFeeForm] = useState<FeeForm>({
    agency_id: '',
    agency_fee_percent: '',
    platform_fee_percent: '',
    leader_commission_percent: '',
    recruiter_commission_percent: '',
    reason: '',
  })

  const [reportForm, setReportForm] = useState<ReportForm>({
    agency_id: '',
    title: '',
    severity: 'medium',
    category: 'agency_operations',
    notes: '',
  })

  const roleLabel = useMemo(() => getRoleDisplayName(profile?.role, profile?.is_admin), [profile?.is_admin, profile?.role])

  const canManageAgencyHR = Boolean(profile?.is_admin) || isAgencyHRProfile(profile)

  const selectedAgency = useMemo(
    () => agencies.find((agency) => agency.id === selectedAgencyId || agency.id === feeForm.agency_id || agency.id === contractForm.agency_id),
    [agencies, contractForm.agency_id, feeForm.agency_id, selectedAgencyId],
  )

  const selectedAgencyApplications = useMemo(() => {
    if (!selectedAgencyId) return applications
    return applications.filter((application) => application.agency_id === selectedAgencyId)
  }, [applications, selectedAgencyId])

  const selectedAgencyContracts = useMemo(() => {
    if (!selectedAgencyId) return contracts
    return contracts.filter((contract) => contract.agency_id === selectedAgencyId)
  }, [contracts, selectedAgencyId])

  const setNotice = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccess(message)
      setError(null)
    } else {
      setError(message)
      setSuccess(null)
    }
  }

  const writeAgencyLog = async (agencyId: string | null, action: string, details: Record<string, unknown> = {}) => {
    const actorId = profile?.id ?? user?.id
    const { error: logError } = await supabase.from('agency_activity_logs').insert({
      agency_id: agencyId,
      actor_id: actorId,
      action,
      details,
    })

    if (logError) {
      console.warn('Failed to write agency activity log', logError)
    }
  }

  const loadDashboard = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[AgencyHRDashboard] loading dashboard', {
        userId: user?.id,
        profileId: profile?.id,
        role: profile?.role,
        trollRole: profile?.troll_role,
        isAdmin: profile?.is_admin,
      })

      const agencyCount = await runDashboardQuery(
        'agencies approved count',
        supabase
          .from('agencies')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved'),
      )

      const memberCount = await runOptionalDashboardQuery(
        'agency_members active count',
        supabase
          .from('agency_members')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        [],
      )

      const appCount = await runDashboardQuery(
        'agency_applications pending count',
        supabase
          .from('agency_applications')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'changes_requested']),
      )

      const contractCount = await runOptionalDashboardQuery(
        'agency_contracts pending count',
        supabase
          .from('agency_contracts')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'pending_signature']),
        [],
      )

      const inviteCount = await runOptionalDashboardQuery(
        'agency_invites pending count',
        supabase
          .from('agency_invites')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        [],
      )

      const goalCount = await runOptionalDashboardQuery(
        'agency_goals active count',
        supabase
          .from('agency_goals')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        [],
      )

      const agenciesResult = await runDashboardQuery(
        'agencies full load',
        supabase
          .from('agencies')
          .select(
            'id, name, status, created_at, agency_fee_percent, platform_fee_percent, leader_commission_percent, recruiter_commission_percent, fee_updated_at, fee_updated_by',
          )
          .order('created_at', { ascending: false }),
      )

      const loadedAgencies = (agenciesResult.data || []) as AgencyRow[]
      setAgencies(loadedAgencies)

      const applicationsResult = await runDashboardQuery(
        'agency_applications full load',
        supabase
          .from('agency_applications')
          .select(
            'id, agency_id, applicant_id, message, content_type, live_schedule, battle_interest, social_links, status, reviewed_by, reviewed_at, created_at, recruiter_user_id, recruiter_bonus_paid, recruiter_bonus_paid_at',
          )
          .in('status', ['pending', 'changes_requested'])
          .order('created_at', { ascending: false }),
      )

      setApplications((applicationsResult.data || []) as AgencyApplication[])

      const contractsResult = await runOptionalDashboardQuery(
        'agency_contracts full load',
        supabase
          .from('agency_contracts')
          .select(
            'id, agency_id, creator_id, user_id, title, contract_type, contract_body, body, status, fee_percentage, payout_terms, effective_date, expiration_date, created_at',
          )
          .order('created_at', { ascending: false })
          .limit(50),
        [],
      )

      setContracts((contractsResult.data || []) as AgencyContract[])

      const auditResult = await runOptionalDashboardQuery(
        'agency_activity_logs full load',
        supabase
          .from('agency_activity_logs')
          .select('id, action, details, created_at, agency_id')
          .order('created_at', { ascending: false })
          .limit(50),
        [],
      )

      setRecentActivity((auditResult.data || []) as ActivityLog[])

      const previewAgencies = loadedAgencies.slice(0, 6)

      const detailedAgencies = await Promise.all(
        previewAgencies.map(async (agency) => {
          const memberResult = await runOptionalDashboardQuery(
            `agency_members count for ${agency.id}`,
            supabase
              .from('agency_members')
              .select('id', { count: 'exact', head: true })
              .eq('agency_id', agency.id)
              .eq('status', 'active'),
            [],
          )

          const appResult = await runOptionalDashboardQuery(
            `agency_applications count for ${agency.id}`,
            supabase
              .from('agency_applications')
              .select('id', { count: 'exact', head: true })
              .eq('agency_id', agency.id)
              .in('status', ['pending', 'changes_requested']),
            [],
          )

          const contractResult = await runOptionalDashboardQuery(
            `agency_contracts count for ${agency.id}`,
            supabase
              .from('agency_contracts')
              .select('id', { count: 'exact', head: true })
              .eq('agency_id', agency.id)
              .in('status', ['pending', 'pending_signature']),
            [],
          )

          return {
            ...agency,
            member_count: memberResult.count || 0,
            pending_applications: appResult.count || 0,
            pending_contracts: contractResult.count || 0,
          } satisfies AgencyPreview
        }),
      )

      setApprovedAgencies(agencyCount.count || 0)
      setActiveMembers(memberCount.count || 0)
      setPendingApplicationsCount(appCount.count || 0)
      setPendingContractsCount(contractCount.count || 0)
      setPendingInvites(inviteCount.count || 0)
      setActiveGoals(goalCount.count || 0)
      setTopAgencies(detailedAgencies)
    } catch (err: any) {
      const serialized = serializeDashboardError(err)

      console.error('[AgencyHRDashboard] Failed to load agency HR dashboard', {
        ...serialized,
        label: err?.label,
        supabaseError: err?.supabaseError,
      })

      setNotice(
        `Agency HR dashboard failed at ${err?.label || 'unknown query'}: ${
          err?.supabaseError?.message || serialized.message || 'No error message returned'
        }`,
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    if (!feeForm.agency_id) return
    const agency = agencies.find((item) => item.id === feeForm.agency_id)
    if (!agency) return

    setFeeForm((current) => ({
      ...current,
      agency_fee_percent: String(agency.agency_fee_percent ?? 0),
      platform_fee_percent: String(agency.platform_fee_percent ?? 0),
      leader_commission_percent: String(agency.leader_commission_percent ?? 0),
      recruiter_commission_percent: String(agency.recruiter_commission_percent ?? 0),
    }))
  }, [agencies, feeForm.agency_id])

  const approveApplication = async (application: AgencyApplication) => {
    const actorId = profile?.id ?? user?.id
    const isFamilyConversion = application.content_type === 'family_conversion'

    if (!actorId) {
      setNotice('You must be signed in to approve applications.', 'error')
      return
    }

    if (!application.id) {
      setNotice('This application is missing an id.', 'error')
      return
    }

    try {
      setSaving(true)

      if (isFamilyConversion) {
        const { data, error } = await supabase.rpc('approve_family_agency_conversion', {
          p_application_id: application.id,
          p_actor_id: actorId,
          p_reason: applicationNote.trim() || 'Approved by Agency HR Manager',
        })

        if (error) {
          throw error
        }

        const result = data as { success?: boolean; message?: string } | null
        if (!result?.success) {
          throw new Error(result?.message || 'Family conversion approval failed.')
        }
       } else {
         const applicantId = application.applicant_id

         if (!application.agency_id || !applicantId) {
           setNotice('This application is missing agency_id or applicant user_id.', 'error')
           return
         }

         const { data, error } = await supabase.rpc('approve_agency_application_atomic', {
           p_application_id: application.id,
           p_approved_by: actorId,
         })

         if (error) {
           throw error
         }

         const result = data as {
           success?: boolean
           agency_id?: string
           fee_charged_amount?: number
           message?: string
         } | null

         if (!result?.success) {
           throw new Error(result?.message || 'Agency application approval failed.')
         }

         await writeAgencyLog(application.agency_id, 'application_approved', {
           application_id: application.id,
           applicant_id: applicantId,
           approved_by: actorId,
           note: applicationNote || null,
           fee_charged_amount: result.fee_charged_amount ?? 35000,
           rpc_result: result,
         })
       }

      setApplicationNote('')
      setNotice(isFamilyConversion ? 'Family conversion approved.' : 'Application approved and member access was activated.')
      await loadDashboard()
    } catch (err) {
      console.error('Failed to approve agency application', err)
      setNotice('Application approval failed. Check the backend RPC or agency tables and RLS.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const rejectApplication = async (application: AgencyApplication) => {
    const actorId = profile?.id ?? user?.id
    const reason = applicationNote.trim()
    const isFamilyConversion = application.content_type === 'family_conversion'

    if (!actorId) {
      setNotice('You must be signed in to reject applications.', 'error')
      return
    }

    if (!reason) {
      setNotice('Add a rejection reason before rejecting the application.', 'error')
      return
    }

    try {
      setSaving(true)

      if (isFamilyConversion) {
        const { data, error } = await supabase.rpc('reject_family_agency_conversion', {
          p_application_id: application.id,
          p_actor_id: actorId,
          p_reason: reason,
        })

        if (error) {
          throw error
        }

        const result = data as { success?: boolean; message?: string } | null
        if (!result?.success) {
          throw new Error(result?.message || 'Family conversion rejection failed.')
        }
      } else {
        const { error: rejectError } = await supabase
          .from('agency_applications')
          .update({
            status: 'rejected',
            message: reason,
            reviewed_by: actorId,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', application.id)

        if (rejectError) {
          const fallback = await supabase.from('agency_applications').update({ status: 'rejected', message: reason }).eq('id', application.id)
          if (fallback.error) throw fallback.error
        }

        await writeAgencyLog(application.agency_id, 'application_rejected', {
          application_id: application.id,
          applicant_id: application.applicant_id,
          rejected_by: actorId,
          reason,
        })
      }

      setApplicationNote('')
      setNotice(isFamilyConversion ? 'Family conversion rejected.' : 'Application rejected.')
      await loadDashboard()
    } catch (err) {
      console.error('Failed to reject agency application', err)
      setNotice('Application rejection failed. Check the backend RPC or agency tables and RLS.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const requestApplicationChanges = async (application: AgencyApplication) => {
    const notes = applicationNote.trim()
    if (!notes) {
      setNotice('Add notes explaining what changes are needed.', 'error')
      return
    }

    try {
      setSaving(true)
      const { error: changesError } = await supabase
        .from('agency_applications')
        .update({
          status: 'changes_requested',
          message: notes,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', application.id)

      if (changesError) {
        const fallback = await supabase.from('agency_applications').update({ status: 'changes_requested', message: notes }).eq('id', application.id)
        if (fallback.error) throw fallback.error
      }

      await writeAgencyLog(application.agency_id, 'application_changes_requested', {
        application_id: application.id,
        applicant_id: application.applicant_id,
        requested_by: profile?.id,
        notes,
      })

      setApplicationNote('')
      setNotice('Change request sent for this application.')
      await loadDashboard()
    } catch (err) {
      console.error('Failed to request application changes', err)
      setNotice('Change request failed. Check columns and RLS.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const buildContractBody = () => {
    return [
      contractForm.contract_body,
      '',
      'Agency Responsibilities:',
      contractForm.agency_responsibilities,
      '',
      'Agency Leader Responsibilities:',
      contractForm.leader_responsibilities,
      '',
      'Payout Terms:',
      contractForm.payout_terms,
      '',
      'Termination Terms:',
      contractForm.termination_terms,
    ]
      .filter(Boolean)
      .join('\n')
  }

  const createContract = async (status: 'draft' | 'pending_signature' = 'draft') => {
    if (!contractForm.agency_id || !contractForm.title.trim()) {
      setNotice('Select an agency and add a contract title.', 'error')
      return
    }

    try {
      setSaving(true)
      const contractBody = buildContractBody()
      const splitPercent = parseNumber(contractForm.fee_percentage) || 50
      const payload = {
        agency_id: contractForm.agency_id,
        creator_id: contractForm.leader_id || null,
        user_id: contractForm.leader_id || null,
        title: contractForm.title.trim(),
        contract_type: contractForm.contract_type || 'agency_leader',
        contract_body: contractBody,
        body: contractBody,
        status,
        split_percent: splitPercent,
        fee_percentage: splitPercent,
        applies_to: 'gifts',
        payout_terms: contractForm.payout_terms || null,
        agency_responsibilities: contractForm.agency_responsibilities || null,
        leader_responsibilities: contractForm.leader_responsibilities || null,
        termination_terms: contractForm.termination_terms || null,
        effective_date: contractForm.effective_date || null,
        expiration_date: contractForm.expiration_date || null,
        starts_at: contractForm.effective_date || null,
        ends_at: contractForm.expiration_date || null,
        created_by: profile?.id,
      }

      const { error: contractError } = await supabase.from('agency_contracts').insert(payload)

      if (contractError) {
        const fallback = await supabase.from('agency_contracts').insert({
          agency_id: contractForm.agency_id,
          creator_id: contractForm.leader_id || null,
          user_id: contractForm.leader_id || null,
          title: contractForm.title.trim(),
          status,
          split_percent: splitPercent,
          fee_percentage: splitPercent,
          applies_to: 'gifts',
        })

        if (fallback.error) throw fallback.error
      }

      await writeAgencyLog(contractForm.agency_id, status === 'draft' ? 'contract_draft_saved' : 'contract_sent_to_leader', {
        title: contractForm.title,
        leader_id: contractForm.leader_id || null,
        contract_type: contractForm.contract_type,
        fee_percentage: parseNumber(contractForm.fee_percentage),
        created_by: profile?.id,
      })

      setContractForm({
        agency_id: '',
        leader_id: '',
        title: '',
        contract_type: 'agency_leader',
        fee_percentage: '',
        payout_terms: '',
        agency_responsibilities: '',
        leader_responsibilities: '',
        termination_terms: '',
        contract_body: '',
        effective_date: '',
        expiration_date: '',
      })

      setNotice(status === 'draft' ? 'Contract draft saved.' : 'Contract sent to agency leader.')
      await loadDashboard()
    } catch (err) {
      console.error('Failed to create agency contract', err)
      setNotice('Contract creation failed. Check agency_contracts columns and RLS.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateContractStatus = async (contract: AgencyContract, status: string) => {
    try {
      setSaving(true)
      const { error: statusError } = await supabase.from('agency_contracts').update({ status }).eq('id', contract.id)
      if (statusError) throw statusError

      await writeAgencyLog(contract.agency_id, `contract_${status}`, {
        contract_id: contract.id,
        title: contract.title || null,
        updated_by: profile?.id,
      })

      setNotice(`Contract marked as ${status}.`)
      await loadDashboard()
    } catch (err) {
      console.error('Failed to update contract status', err)
      setNotice('Contract status update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateAgencyFees = async () => {
    if (!feeForm.agency_id) {
      setNotice('Select an agency before saving fee changes.', 'error')
      return
    }
    if (!feeForm.reason.trim()) {
      setNotice('Add a reason for the fee change.', 'error')
      return
    }

    const oldAgency = agencies.find((agency) => agency.id === feeForm.agency_id)
    const newValues = {
      agency_fee_percent: parseNumber(feeForm.agency_fee_percent),
      platform_fee_percent: parseNumber(feeForm.platform_fee_percent),
      leader_commission_percent: parseNumber(feeForm.leader_commission_percent),
      recruiter_commission_percent: parseNumber(feeForm.recruiter_commission_percent),
      fee_updated_at: new Date().toISOString(),
      fee_updated_by: profile?.id,
    }

    const totalCommission = newValues.agency_fee_percent + newValues.platform_fee_percent + newValues.leader_commission_percent + newValues.recruiter_commission_percent
    if (totalCommission > 100) {
      setNotice('Total fee and commission percentages cannot exceed 100%.', 'error')
      return
    }

    try {
      setSaving(true)
      const { error: feeError } = await supabase.from('agencies').update(newValues).eq('id', feeForm.agency_id)

      if (feeError) throw feeError

      await writeAgencyLog(feeForm.agency_id, 'agency_fees_updated', {
        updated_by: profile?.id,
        reason: feeForm.reason,
        old_values: {
          agency_fee_percent: oldAgency?.agency_fee_percent ?? null,
          platform_fee_percent: oldAgency?.platform_fee_percent ?? null,
          leader_commission_percent: oldAgency?.leader_commission_percent ?? null,
          recruiter_commission_percent: oldAgency?.recruiter_commission_percent ?? null,
        },
        new_values: newValues,
      })

      setFeeForm((current) => ({ ...current, reason: '' }))
      setNotice('Agency fees updated.')
      await loadDashboard()
    } catch (err) {
      console.error('Failed to update agency fees', err)
      setNotice('Fee update failed. Add the fee columns to agencies or check RLS.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateAgencyStatus = async (agency: AgencyRow, status: 'approved' | 'suspended' | 'under_review') => {
    try {
      setSaving(true)
      const { error: statusError } = await supabase.from('agencies').update({ status }).eq('id', agency.id)
      if (statusError) throw statusError

      await writeAgencyLog(agency.id, `agency_${status}`, {
        agency_name: agency.name,
        previous_status: agency.status,
        new_status: status,
        reason: agencyStatusReason || null,
        updated_by: profile?.id,
      })

      setAgencyStatusReason('')
      setNotice(`Agency marked as ${status}.`)
      await loadDashboard()
    } catch (err) {
      console.error('Failed to update agency status', err)
      setNotice('Agency status update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const sendAdminReport = async () => {
    if (!reportForm.title.trim() || !reportForm.notes.trim()) {
      setNotice('Add a report title and notes before sending.', 'error')
      return
    }

    const details = {
      notes: reportForm.notes,
      severity: reportForm.severity,
      category: reportForm.category,
      submitted_from: 'AgencyHRDashboard',
    }

    try {
      setSaving(true)

      const primary = await supabase.from('admin_reports').insert({
        agency_id: reportForm.agency_id || null,
        submitted_by: profile?.id,
        title: reportForm.title,
        severity: reportForm.severity,
        category: reportForm.category,
        details,
        status: 'open',
      })

      if (primary.error) {
        const fallback = await supabase.from('agency_admin_reports').insert({
          agency_id: reportForm.agency_id || null,
          submitted_by: profile?.id,
          title: reportForm.title,
          severity: reportForm.severity,
          category: reportForm.category,
          details,
          status: 'open',
        })

        if (fallback.error) throw fallback.error
      }

      await writeAgencyLog(reportForm.agency_id || null, 'admin_report_sent', {
        title: reportForm.title,
        severity: reportForm.severity,
        category: reportForm.category,
        submitted_by: profile?.id,
      })

      setReportForm({
        agency_id: '',
        title: '',
        severity: 'medium',
        category: 'agency_operations',
        notes: '',
      })

      setNotice('Report sent to the admin dashboard.')
      await loadDashboard()
    } catch (err) {
      console.error('Failed to send admin report', err)
      setNotice('Report failed. Create admin_reports or agency_admin_reports and check RLS.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const summaryCards = [
    { label: 'Approved agencies', value: approvedAgencies, helper: 'Talent offices currently active', icon: Building2, tone: 'text-cyan-300' },
    { label: 'Active members', value: activeMembers, helper: 'Creators, recruiters, and managers', icon: Users, tone: 'text-purple-300' },
    { label: 'Pending applications', value: pendingApplicationsCount, helper: 'Needs HR review before onboarding', icon: FileText, tone: 'text-amber-300' },
    { label: 'Pending contracts', value: pendingContractsCount, helper: 'Awaiting approval or signature', icon: ShieldCheck, tone: 'text-emerald-300' },
  ]

  if (!canManageAgencyHR) {
    return (
      <div className="min-h-screen bg-[#050507] px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-400/30 bg-red-500/10 p-8 shadow-2xl shadow-red-950/30">
          <div className="flex items-center gap-3 text-red-100">
            <ShieldAlert className="h-6 w-6" />
            <h1 className="text-2xl font-black">Agency HR access required</h1>
          </div>
          <p className="mt-4 text-sm leading-7 text-red-100/90">
            Your current role is {roleLabel}. This page is restricted to Admin and Agency HR Manager roles.
          </p>
          <Link to="/" className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">
            Return home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_30%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.15),transparent_28%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_32%)]" />
      </div>

      <main className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-100">
                <Sparkles className="h-4 w-4" />
                Agency HR Manager Control Center
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Approve agencies, write contracts, control fees, and report live operations
              </h1>
              <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
                {roleLabel} access for agency applications, contracts, fee controls, agency status actions, reports, audit logs, and RTC monitoring.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[24rem]">
              <button type="button" onClick={() => void loadDashboard()} disabled={loading || saving} className={primaryButtonClasses}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <Link
                to="/agencies"
                className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-center text-sm font-bold text-fuchsia-50 transition hover:border-fuchsia-200/50 hover:bg-fuchsia-500/15"
              >
                Browse agencies
              </Link>
            </div>
          </div>
        </section>

        {(error || success) && (
          <div
            className={`rounded-[1.5rem] border px-4 py-3 text-sm ${
              error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
            }`}
          >
            {error || success}
          </div>
        )}

        <section className="flex gap-2 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-black/30 p-2 backdrop-blur-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black transition ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-50 shadow-lg shadow-cyan-950/30'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </section>

        {(activeTab === 'overview' || activeTab === 'applications' || activeTab === 'contracts' || activeTab === 'fees' || activeTab === 'agencies' || activeTab === 'reports') && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className={statsCardClasses}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">{card.label}</p>
                      <p className="mt-3 text-3xl font-black text-white">{loading ? '…' : card.value}</p>
                    </div>
                    <div className={`rounded-2xl bg-white/5 p-3 ${card.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{card.helper}</p>
                </div>
              )
            })}
          </section>
        )}

        {activeTab === 'overview' && (
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className={panelClasses}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Agency health</p>
                  <h2 className="mt-2 text-xl font-black text-white">Top agencies and queue volume</h2>
                </div>
                <button type="button" onClick={() => setActiveTab('agencies')} className="inline-flex items-center gap-2 text-sm font-bold text-cyan-100">
                  Manage all
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">Loading agency snapshots...</div>
                ) : topAgencies.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">No agencies are available for review yet.</div>
                ) : (
                  topAgencies.map((agency) => (
                    <div key={agency.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">{agency.name}</p>
                          <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusTone(agency.status)}`}>
                            {agency.status || 'unknown'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-cyan-500/10 px-3 py-1 font-bold text-cyan-100">{agency.member_count} members</span>
                          <span className="rounded-full bg-amber-500/10 px-3 py-1 font-bold text-amber-100">{agency.pending_applications} apps</span>
                          <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-bold text-emerald-100">{agency.pending_contracts} contracts</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={panelClasses}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Operations pulse</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Pending invites</p>
                      <p className="text-xs text-slate-300">Open invitations awaiting response</p>
                    </div>
                    <span className="text-2xl font-black text-white">{loading ? '…' : pendingInvites}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Active goals</p>
                      <p className="text-xs text-slate-300">Agency performance targets in motion</p>
                    </div>
                    <span className="text-2xl font-black text-white">{loading ? '…' : activeGoals}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Live operations</p>
                      <p className="text-xs text-slate-300">RTC monitor remains attached to this dashboard</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-100">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'applications' && (
          <section className={panelClasses}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Application approval center</p>
                <h2 className="mt-2 text-xl font-black text-white">Approve, reject, or request changes</h2>
              </div>
              <select value={selectedAgencyId} onChange={(event) => setSelectedAgencyId(event.target.value)} className={`${inputClasses} lg:max-w-xs`}>
                <option value="">All agencies</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5">
              <label className={labelClasses}>HR notes / rejection reason / change request</label>
              <textarea
                value={applicationNote}
                onChange={(event) => setApplicationNote(event.target.value)}
                className={`${inputClasses} mt-2 min-h-[6rem]`}
                placeholder="Write approval notes, rejection reason, or requested changes..."
              />
            </div>

            <div className="mt-5 space-y-3">
              {selectedAgencyApplications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">No pending applications found.</div>
              ) : (
                selectedAgencyApplications.map((application) => {
                  const applicantName = application.applicant_id || 'Unknown applicant'
                  const agencyName = agencies.find((agency) => agency.id === application.agency_id)?.name || 'Unknown agency'
                  const isFamilyConversion = application.content_type === 'family_conversion'

                  return (
                    <div key={application.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black text-white">
                              {isFamilyConversion ? 'Family conversion request' : applicantName}
                            </h3>
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(application.status)}`}>
                              {application.status || 'pending'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-300">Agency: {agencyName}</p>
                          <p className="text-sm text-slate-400">
                             {isFamilyConversion ? 'Type: Family-to-Agency conversion' : 'Requested role: creator'}
                          </p>
                          <p className="text-xs text-slate-500">Submitted: {safeDate(application.created_at)}</p>
                          {(application.message) && (
                            <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                              {application.message}
                            </p>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[31rem]">
                          <button type="button" disabled={saving} onClick={() => void approveApplication(application)} className={primaryButtonClasses}>
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </button>
                          <button type="button" disabled={saving} onClick={() => void requestApplicationChanges(application)} className={softButtonClasses}>
                            <PencilLine className="h-4 w-4" />
                            Changes
                          </button>
                          <button type="button" disabled={saving} onClick={() => void rejectApplication(application)} className={dangerButtonClasses}>
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}

        {activeTab === 'contracts' && (
          <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className={panelClasses}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-fuchsia-500/10 p-3 text-fuchsia-100">
                  <FileSignature className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200">Contract writer</p>
                  <h2 className="text-lg font-black text-white">Agency leader contract</h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div>
                  <label className={labelClasses}>Agency</label>
                  <select
                    value={contractForm.agency_id}
                    onChange={(event) => setContractForm((current) => ({ ...current, agency_id: event.target.value }))}
                    className={`${inputClasses} mt-2`}
                  >
                    <option value="">Select agency</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClasses}>Agency leader user id</label>
                  <input
                    value={contractForm.leader_id}
                    onChange={(event) => setContractForm((current) => ({ ...current, leader_id: event.target.value }))}
                    className={`${inputClasses} mt-2`}
                    placeholder="Paste leader user id"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelClasses}>Title</label>
                    <input
                      value={contractForm.title}
                      onChange={(event) => setContractForm((current) => ({ ...current, title: event.target.value }))}
                      className={`${inputClasses} mt-2`}
                      placeholder="Agency Leader Agreement"
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Contract type</label>
                    <input
                      value={contractForm.contract_type}
                      onChange={(event) => setContractForm((current) => ({ ...current, contract_type: event.target.value }))}
                      className={`${inputClasses} mt-2`}
                      placeholder="agency_leader"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className={labelClasses}>Fee %</label>
                    <input
                      value={contractForm.fee_percentage}
                      onChange={(event) => setContractForm((current) => ({ ...current, fee_percentage: event.target.value }))}
                      className={`${inputClasses} mt-2`}
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Effective date</label>
                    <input
                      type="date"
                      value={contractForm.effective_date}
                      onChange={(event) => setContractForm((current) => ({ ...current, effective_date: event.target.value }))}
                      className={`${inputClasses} mt-2`}
                    />
                  </div>
                  <div>
                    <label className={labelClasses}>Expiration date</label>
                    <input
                      type="date"
                      value={contractForm.expiration_date}
                      onChange={(event) => setContractForm((current) => ({ ...current, expiration_date: event.target.value }))}
                      className={`${inputClasses} mt-2`}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClasses}>Payout terms</label>
                  <textarea
                    value={contractForm.payout_terms}
                    onChange={(event) => setContractForm((current) => ({ ...current, payout_terms: event.target.value }))}
                    className={`${inputClasses} mt-2 min-h-[5rem]`}
                    placeholder="Payout terms, fees, commission rules..."
                  />
                </div>

                <div>
                  <label className={labelClasses}>Agency responsibilities</label>
                  <textarea
                    value={contractForm.agency_responsibilities}
                    onChange={(event) => setContractForm((current) => ({ ...current, agency_responsibilities: event.target.value }))}
                    className={`${inputClasses} mt-2 min-h-[5rem]`}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Leader responsibilities</label>
                  <textarea
                    value={contractForm.leader_responsibilities}
                    onChange={(event) => setContractForm((current) => ({ ...current, leader_responsibilities: event.target.value }))}
                    className={`${inputClasses} mt-2 min-h-[5rem]`}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Termination terms</label>
                  <textarea
                    value={contractForm.termination_terms}
                    onChange={(event) => setContractForm((current) => ({ ...current, termination_terms: event.target.value }))}
                    className={`${inputClasses} mt-2 min-h-[5rem]`}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Custom contract body</label>
                  <textarea
                    value={contractForm.contract_body}
                    onChange={(event) => setContractForm((current) => ({ ...current, contract_body: event.target.value }))}
                    className={`${inputClasses} mt-2 min-h-[10rem]`}
                    placeholder="Write the main contract terms here..."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" disabled={saving} onClick={() => void createContract('draft')} className={softButtonClasses}>
                    <PencilLine className="h-4 w-4" />
                    Save draft
                  </button>
                  <button type="button" disabled={saving} onClick={() => void createContract('pending_signature')} className={primaryButtonClasses}>
                    <Send className="h-4 w-4" />
                    Send to leader
                  </button>
                </div>
              </div>
            </div>

            <div className={panelClasses}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Contracts queue</p>
                  <h2 className="mt-2 text-xl font-black text-white">Approve, send, or void contracts</h2>
                </div>
                <select value={selectedAgencyId} onChange={(event) => setSelectedAgencyId(event.target.value)} className={`${inputClasses} lg:max-w-xs`}>
                  <option value="">All agencies</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 space-y-3">
                {selectedAgencyContracts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">No contracts found.</div>
                ) : (
                  selectedAgencyContracts.map((contract) => (
                    <div key={contract.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-black text-white">{contract.title || 'Untitled contract'}</h3>
                            <p className="mt-1 text-sm text-slate-300">Agency: {agencies.find((agency) => agency.id === contract.agency_id)?.name || 'Unknown agency'}</p>
                            <p className="text-xs text-slate-500">Created: {safeDate(contract.created_at)}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(contract.status)}`}>{contract.status || 'unknown'}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <button type="button" disabled={saving} onClick={() => void updateContractStatus(contract, 'approved')} className={primaryButtonClasses}>
                            Approve
                          </button>
                          <button type="button" disabled={saving} onClick={() => void updateContractStatus(contract, 'pending_signature')} className={softButtonClasses}>
                            Send
                          </button>
                          <button type="button" disabled={saving} onClick={() => void updateContractStatus(contract, 'voided')} className={dangerButtonClasses}>
                            Void
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'fees' && (
          <section className={panelClasses}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-100">
                <Gavel className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Fee control center</p>
                <h2 className="text-lg font-black text-white">Change agency fees and commission settings</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <label className={labelClasses}>Agency</label>
                <select
                  value={feeForm.agency_id}
                  onChange={(event) => setFeeForm((current) => ({ ...current, agency_id: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                >
                  <option value="">Select agency</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses}>Reason for change</label>
                <input
                  value={feeForm.reason}
                  onChange={(event) => setFeeForm((current) => ({ ...current, reason: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="Required audit reason"
                />
              </div>

              <div>
                <label className={labelClasses}>Agency fee %</label>
                <input
                  value={feeForm.agency_fee_percent}
                  onChange={(event) => setFeeForm((current) => ({ ...current, agency_fee_percent: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={labelClasses}>Platform fee %</label>
                <input
                  value={feeForm.platform_fee_percent}
                  onChange={(event) => setFeeForm((current) => ({ ...current, platform_fee_percent: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={labelClasses}>Leader commission %</label>
                <input
                  value={feeForm.leader_commission_percent}
                  onChange={(event) => setFeeForm((current) => ({ ...current, leader_commission_percent: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="0"
                />
              </div>

              <div>
                <label className={labelClasses}>Recruiter commission %</label>
                <input
                  value={feeForm.recruiter_commission_percent}
                  onChange={(event) => setFeeForm((current) => ({ ...current, recruiter_commission_percent: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="0"
                />
              </div>
            </div>

            {selectedAgency && (
              <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                Current selection: {selectedAgency.name}. Last fee update: {safeDate(selectedAgency.fee_updated_at)}.
              </div>
            )}

            <button type="button" disabled={saving} onClick={() => void updateAgencyFees()} className={`${primaryButtonClasses} mt-5`}>
              <ShieldCheck className="h-4 w-4" />
              Save fee changes
            </button>
          </section>
        )}

        {activeTab === 'agencies' && (
          <section className={panelClasses}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Agency command center</p>
              <h2 className="mt-2 text-xl font-black text-white">Status, review, suspension, and agency workflow controls</h2>
            </div>

            <div className="mt-5">
              <label className={labelClasses}>Status action reason</label>
              <input
                value={agencyStatusReason}
                onChange={(event) => setAgencyStatusReason(event.target.value)}
                className={`${inputClasses} mt-2`}
                placeholder="Reason for suspension, review, or reactivation..."
              />
            </div>

            <div className="mt-5 space-y-3">
              {agencies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">No agencies found.</div>
              ) : (
                agencies.map((agency) => (
                  <div key={agency.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-black text-white">{agency.name}</h3>
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone(agency.status)}`}>{agency.status || 'unknown'}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Created: {safeDate(agency.created_at)}</p>
                        <p className="mt-2 text-sm text-slate-300">
                          Fees: Agency {agency.agency_fee_percent ?? 0}% · Platform {agency.platform_fee_percent ?? 0}% · Leader {agency.leader_commission_percent ?? 0}% · Recruiter{' '}
                          {agency.recruiter_commission_percent ?? 0}%
                        </p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[34rem] xl:grid-cols-4">
                        <button type="button" onClick={() => { setSelectedAgencyId(agency.id); setActiveTab('applications') }} className={softButtonClasses}>
                          Apps
                        </button>
                        <button type="button" onClick={() => { setSelectedAgencyId(agency.id); setActiveTab('contracts') }} className={softButtonClasses}>
                          Contracts
                        </button>
                        <button type="button" onClick={() => { setFeeForm((current) => ({ ...current, agency_id: agency.id })); setActiveTab('fees') }} className={softButtonClasses}>
                          Fees
                        </button>
                        <button type="button" onClick={() => { setReportForm((current) => ({ ...current, agency_id: agency.id })); setActiveTab('reports') }} className={softButtonClasses}>
                          Report
                        </button>
                        <button type="button" disabled={saving} onClick={() => void updateAgencyStatus(agency, 'under_review')} className={softButtonClasses}>
                          Review
                        </button>
                        <button type="button" disabled={saving} onClick={() => void updateAgencyStatus(agency, 'approved')} className={primaryButtonClasses}>
                          Reactivate
                        </button>
<button type="button" disabled={saving} onClick={() => void updateAgencyStatus(agency, 'suspended')} className={dangerButtonClasses}>
                           Suspend
                         </button>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'reports' && (
          <section className={panelClasses}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">Admin reports</p>
                <h2 className="text-lg font-black text-white">Send agency reports to the admin dashboard</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <label className={labelClasses}>Agency</label>
                <select
                  value={reportForm.agency_id}
                  onChange={(event) => setReportForm((current) => ({ ...current, agency_id: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                >
                  <option value="">No agency / general report</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClasses}>Title</label>
                <input
                  value={reportForm.title}
                  onChange={(event) => setReportForm((current) => ({ ...current, title: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="Agency issue title"
                />
              </div>

              <div>
                <label className={labelClasses}>Severity</label>
                <select
                  value={reportForm.severity}
                  onChange={(event) => setReportForm((current) => ({ ...current, severity: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className={labelClasses}>Category</label>
                <input
                  value={reportForm.category}
                  onChange={(event) => setReportForm((current) => ({ ...current, category: event.target.value }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="agency_operations"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClasses}>Report notes</label>
              <textarea
                value={reportForm.notes}
                onChange={(event) => setReportForm((current) => ({ ...current, notes: event.target.value }))}
                className={`${inputClasses} mt-2 min-h-[10rem]`}
                placeholder="Write the issue, action taken, and what admin needs to review..."
              />
            </div>

            <button type="button" disabled={saving} onClick={() => void sendAdminReport()} className={`${primaryButtonClasses} mt-5`}>
              <Send className="h-4 w-4" />
              Send report
            </button>
          </section>
        )}


          {activeTab === 'audit' && (
          <section className={panelClasses}>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-100">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Audit trail</p>
                <h2 className="text-lg font-black text-white">Latest agency actions</h2>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-300">No agency audit events are available yet.</div>
              ) : (
                recentActivity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">{entry.action}</p>
                        <p className="mt-1 text-xs text-slate-500">Agency: {agencies.find((agency) => agency.id === entry.agency_id)?.name || entry.agency_id || 'General'}</p>
                        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-slate-300">
                          {renderDetails(entry.details)}
                        </pre>
                      </div>
                      <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {safeDate(entry.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <section className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4 text-xs text-slate-400">
          <p>
            Database note: this dashboard expects agency_activity_logs.details jsonb and agency fee columns on agencies. If an action fails, add the SQL migration provided with this rewrite.
          </p>
        </section>
      </main>
    </div>
  )
}
