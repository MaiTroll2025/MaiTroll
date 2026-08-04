import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle,
  Clock,
  FileText,
  Gavel,
  Loader2,
  LockKeyhole,
  Plus,
  Save,
  Scale,
  ScrollText,
  Shield,
  Trash2,
  User,
  Users,
  X
} from 'lucide-react'

interface AttorneyCase {
  id: string
  case_id: string
  victim_id: string
  victim_username?: string
  victim_avatar?: string
  status: string
  fee_paid: number
  is_pro_bono: boolean
  case_details: any
}

interface CourtCaseDetails {
  id: string
  reason: string
  status: string
  description?: string
  evidence_url?: string
  plaintiff_id: string
  defendant_id: string
  created_at: string
  updated_at?: string
  plaintiff?: { username: string; avatar_url: string }
  defendant?: { username: string; avatar_url: string }
}

interface AvailableCase {
  id: string
  reason: string
  status: string
  plaintiff_id: string
  defendant_id: string
  plaintiff?: { username: string; avatar_url: string }
  defendant?: { username: string; avatar_url: string }
  created_at: string
}

function formatDate(value?: string) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return date.toLocaleDateString()
}

function statusClass(status?: string) {
  if (status === 'active') return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
  if (status === 'pending') return 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
  if (status === 'closed') return 'border-slate-400/30 bg-slate-400/10 text-slate-200'
  return 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
}

export default function AttorneyDashboard() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  const [activeCases, setActiveCases] = useState<AttorneyCase[]>([])
  const [availableCases, setAvailableCases] = useState<AvailableCase[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState<'cases' | 'available'>('cases')
  const [attorneyInfo, setAttorneyInfo] = useState<any>(null)

  const [selectedCase, setSelectedCase] = useState<AttorneyCase | null>(null)
  const [caseDetails, setCaseDetails] = useState<CourtCaseDetails | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [attorneyNotes, setAttorneyNotes] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const isProBono = Boolean(profile?.is_pro_bono)
  const attorneyFee = Number(profile?.attorney_fee || 0)
  const earnings = activeCases.filter((c) => c.is_pro_bono).length * 200

  const totalCases = attorneyInfo?.casesCount || activeCases.length

  const chamberStatus = useMemo(() => {
    if (activeCases.length > 0) return 'Court in Session'
    if (availableCases.length > 0) return 'Docket Open'
    return 'No Cases Filed'
  }, [activeCases.length, availableCases.length])

  useEffect(() => {
    if (user?.id) fetchAttorneyData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const fetchAttorneyData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)

      setAttorneyInfo({
        isProBono: profile?.is_pro_bono,
        fee: profile?.attorney_fee,
        casesCount: profile?.attorney_cases_count || 0
      })

      const { data: casesData, error: casesError } = await supabase
        .from('attorney_cases')
        .select('*')
        .eq('attorney_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (casesError) throw casesError

      const victimIds = [...new Set((casesData || []).map((c: any) => c.victim_id).filter(Boolean))]
      const victimMap: Record<string, any> = {}

      if (victimIds.length > 0) {
        const { data: victims } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', victimIds)

        victims?.forEach((v: any) => {
          victimMap[v.id] = v
        })
      }

      setActiveCases(
        (casesData || []).map((c: any) => ({
          id: c.id,
          case_id: c.case_id,
          victim_id: c.victim_id,
          victim_username: victimMap[c.victim_id]?.username || 'Unknown',
          victim_avatar: victimMap[c.victim_id]?.avatar_url,
          status: c.status,
          fee_paid: Number(c.fee_paid || 0),
          is_pro_bono: Boolean(c.is_pro_bono),
          case_details: c.case_details || {}
        }))
      )

      const { data: availableData, error: availableError } = await supabase
        .from('court_cases')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)

      if (availableError) throw availableError

      setAvailableCases(availableData || [])
    } catch (err) {
      console.error('Error fetching attorney data:', err)
      toast.error('Failed to load attorney dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleTakeCase = async (caseData: AvailableCase) => {
    if (!user?.id) return

    const confirmMsg = isProBono
      ? 'Take this case as Pro Bono? You will receive 200 Troll Coins from the public pool.'
      : `Take this case for ${attorneyFee} Troll Coins?`

    if (!confirm(confirmMsg)) return

    try {
      const { error } = await supabase.from('attorney_cases').insert({
        attorney_id: user.id,
        case_id: caseData.id,
        victim_id: caseData.plaintiff_id,
        status: 'active',
        fee_paid: isProBono ? 0 : attorneyFee,
        is_pro_bono: isProBono,
        case_details: {
          reason: caseData.reason,
          plaintiff: caseData.plaintiff?.username,
          defendant: caseData.defendant?.username,
          accepted_at: new Date().toISOString()
        }
      })

      if (error) throw error

      if (isProBono) {
        const { data: poolData } = await supabase
          .from('system_wallets')
          .select('balance')
          .eq('id', 'public_pool')
          .maybeSingle()

        if (poolData && Number(poolData.balance || 0) >= 200) {
          await supabase
            .from('user_profiles')
            .update({ troll_coins: Number(profile?.troll_coins || 0) + 200 })
            .eq('id', user.id)

          await supabase
            .from('system_wallets')
            .update({ balance: Number(poolData.balance || 0) - 200 })
            .eq('id', 'public_pool')
        }
      }

      toast.success('Case accepted and added to your docket')
      fetchAttorneyData()
    } catch (err: any) {
      toast.error(err.message || 'Failed to take case')
    }
  }

  const handleViewCase = async (caseItem: AttorneyCase) => {
    setSelectedCase(caseItem)
    setLoadingDetails(true)
    setIsModalOpen(true)

    try {
      const { data, error } = await supabase
        .from('court_cases')
        .select(`
          id,
          reason,
          status,
          description,
          evidence_url,
          plaintiff_id,
          defendant_id,
          created_at,
          updated_at,
          plaintiff:plaintiff_id(id, username, avatar_url),
          defendant:defendant_id(id, username, avatar_url)
        `)
        .eq('id', caseItem.case_id)
        .single()

      if (error) throw error

      setCaseDetails(data as any)
      setAttorneyNotes(caseItem.case_details?.attorney_notes || '')
      setEvidence(caseItem.case_details?.evidence || [])
    } catch (err) {
      console.error('Error loading case details:', err)
      toast.error('Failed to load case details')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleCloseModal = () => {
    setSelectedCase(null)
    setCaseDetails(null)
    setAttorneyNotes('')
    setEvidence([])
    setNewEvidenceUrl('')
    setIsModalOpen(false)
  }

  const handleAddEvidence = () => {
    const url = newEvidenceUrl.trim()
    if (!url) return
    if (evidence.includes(url)) {
      toast.error('Evidence already added')
      return
    }

    setEvidence((prev) => [...prev, url])
    setNewEvidenceUrl('')
  }

  const handleRemoveEvidence = (index: number) => {
    setEvidence((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSaveCase = async () => {
    if (!selectedCase) return

    setSaving(true)

    try {
      const nextDetails = {
        ...selectedCase.case_details,
        attorney_notes: attorneyNotes,
        evidence,
        last_updated: new Date().toISOString()
      }

      const { error } = await supabase
        .from('attorney_cases')
        .update({ case_details: nextDetails })
        .eq('id', selectedCase.id)

      if (error) throw error

      setActiveCases((prev) =>
        prev.map((c) =>
          c.id === selectedCase.id
            ? { ...c, case_details: nextDetails }
            : c
        )
      )

      toast.success('Case file saved')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save case')
    } finally {
      setSaving(false)
    }
  }

  const handleEnterCourt = () => {
    if (!selectedCase?.case_id) return
    navigate(`/troll-court?case=${selectedCase.case_id}`)
    handleCloseModal()
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_30%),linear-gradient(135deg,#020617_0%,#07111f_45%,#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.13] bg-[linear-gradient(rgba(34,211,238,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.18)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-amber-950/25 to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 sm:p-6">
        <header className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/72 p-5 shadow-[0_0_55px_rgba(34,211,238,0.14)] backdrop-blur-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-300/35 bg-amber-300/10 shadow-[0_0_34px_rgba(251,191,36,0.22)]">
                <Scale className="h-9 w-9 text-amber-200" />
                <Gavel className="absolute -right-2 -top-2 h-6 w-6 rotate-12 text-cyan-200" />
              </div>

              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100">
                  Mai Troll Court Chamber
                </div>
                <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                  Attorney Dashboard
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-cyan-100/70">
                  Manage your docket, prepare evidence, save case notes, and enter court.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100/60">Court Status</p>
                <p className="mt-1 text-lg font-black text-amber-100">{chamberStatus}</p>
              </div>

              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/60">Active Cases</p>
                <p className="mt-1 font-mono text-3xl font-black text-cyan-100">{activeCases.length}</p>
              </div>

              <div className="col-span-2 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/10 p-4 sm:col-span-1">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-100/60">Attorney Type</p>
                <p className="mt-1 text-sm font-black text-fuchsia-50">
                  {isProBono ? 'Pro Bono Counsel' : `${attorneyFee} TC / Case`}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 backdrop-blur-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10">
                <Briefcase className="h-5 w-5 text-amber-200" />
              </div>
              <p className="font-black text-white">Total Case Files</p>
            </div>
            <p className="font-mono text-4xl font-black text-cyan-100">{totalCases}</p>
          </div>

          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 backdrop-blur-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10">
                <Clock className="h-5 w-5 text-cyan-100" />
              </div>
              <p className="font-black text-white">Pending Docket</p>
            </div>
            <p className="font-mono text-4xl font-black text-amber-100">{availableCases.length}</p>
          </div>

          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-5 backdrop-blur-2xl">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10">
                <Banknote className="h-5 w-5 text-emerald-200" />
              </div>
              <p className="font-black text-white">Court Compensation</p>
            </div>
            <p className="font-mono text-3xl font-black text-emerald-100">
              {isProBono ? `${earnings} TC` : `${attorneyFee} TC`}
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 shadow-[0_0_45px_rgba(34,211,238,0.1)] backdrop-blur-2xl">
          <div className="flex flex-col gap-3 border-b border-cyan-300/15 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedTab('cases')}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  selectedTab === 'cases'
                    ? 'border border-cyan-300/35 bg-cyan-300/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                    : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Briefcase className="mr-2 inline h-4 w-4" />
                My Docket ({activeCases.length})
              </button>

              <button
                onClick={() => setSelectedTab('available')}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  selectedTab === 'available'
                    ? 'border border-amber-300/35 bg-amber-300/15 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                    : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <ScrollText className="mr-2 inline h-4 w-4" />
                Available Cases ({availableCases.length})
              </button>
            </div>

            <div className="hidden items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100 md:flex">
              <Building2 className="h-4 w-4" />
              Courtroom access stays on /troll-court
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-9 w-9 animate-spin text-cyan-100" />
              </div>
            ) : selectedTab === 'cases' ? (
              activeCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10">
                    <Briefcase className="h-10 w-10 text-cyan-100/70" />
                  </div>
                  <p className="text-xl font-black">No active cases on your docket</p>
                  <button
                    onClick={() => setSelectedTab('available')}
                    className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 font-black text-amber-100 hover:bg-amber-300/20"
                  >
                    Browse available cases
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {activeCases.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className="rounded-3xl border border-cyan-300/15 bg-slate-900/72 p-5 transition hover:border-cyan-300/35 hover:bg-slate-900/95"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                            {caseItem.victim_avatar ? (
                              <img src={caseItem.victim_avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-7 w-7 text-cyan-100/65" />
                            )}
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                              Case File
                            </p>
                            <p className="text-lg font-black text-white">{caseItem.victim_username}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {caseItem.case_details?.reason || 'Pending review'}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(caseItem.status)}`}>
                                {caseItem.status.toUpperCase()}
                              </span>
                              {caseItem.is_pro_bono && (
                                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
                                  Pro Bono
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleViewCase(caseItem)}
                          className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-300/10 px-4 py-2 text-sm font-black text-fuchsia-100 hover:bg-fuchsia-300/20"
                        >
                          View File
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : availableCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-300/20 bg-amber-300/10">
                  <ScrollText className="h-10 w-10 text-amber-100/70" />
                </div>
                <p className="text-xl font-black">No pending cases in the court docket</p>
                <p className="mt-2 text-sm text-slate-400">Check again when new disputes are filed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {availableCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="rounded-3xl border border-amber-300/15 bg-slate-900/72 p-5 transition hover:border-amber-300/35 hover:bg-slate-900/95"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(caseItem.status)}`}>
                        {caseItem.status.toUpperCase()}
                      </span>
                      <span className="text-xs font-bold text-slate-500">Filed {formatDate(caseItem.created_at)}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3 rounded-2xl border border-cyan-300/10 bg-white/[0.03] px-4 py-3">
                        <Users className="h-4 w-4 text-cyan-100" />
                        <span className="text-sm font-bold text-slate-200">
                          Plaintiff: {caseItem.plaintiff?.username || 'Unknown'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 rounded-2xl border border-rose-300/10 bg-white/[0.03] px-4 py-3">
                        <User className="h-4 w-4 text-rose-200" />
                        <span className="text-sm font-bold text-slate-200">
                          Defendant: {caseItem.defendant?.username || 'Unknown'}
                        </span>
                      </div>

                      <div className="rounded-2xl border border-amber-300/10 bg-amber-300/[0.06] px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100/50">Complaint</p>
                        <p className="mt-1 text-sm text-amber-50">{caseItem.reason}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTakeCase(caseItem)}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200/35 bg-gradient-to-r from-amber-300 via-yellow-400 to-cyan-300 px-5 py-3 font-black text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.18)] transition hover:scale-[1.01]"
                    >
                      <Gavel className="h-5 w-5" />
                      {isProBono ? 'Take Case — Pro Bono +200 TC' : `Take Case — ${attorneyFee} TC`}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {isModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950 shadow-[0_0_70px_rgba(34,211,238,0.18)]">
            <div className="flex items-center justify-between border-b border-cyan-300/15 bg-slate-950/95 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10">
                  <Gavel className="h-7 w-7 text-amber-200" />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Attorney Case File</h2>
                  <p className="font-mono text-xs text-cyan-100/60">Case ID: {selectedCase.case_id}</p>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="rounded-2xl border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:border-rose-300/40 hover:text-rose-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-9 w-9 animate-spin text-cyan-100" />
                </div>
              ) : caseDetails ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-cyan-300/15 bg-slate-900/72 p-5">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100/50">Plaintiff</p>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                          {caseDetails.plaintiff?.avatar_url ? (
                            <img src={caseDetails.plaintiff.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-cyan-100" />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-cyan-100">{caseDetails.plaintiff?.username || 'Unknown'}</p>
                          <p className="font-mono text-xs text-slate-500">{caseDetails.plaintiff_id}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-rose-300/15 bg-slate-900/72 p-5">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-rose-100/50">Defendant</p>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-rose-300/20 bg-rose-300/10">
                          {caseDetails.defendant?.avatar_url ? (
                            <img src={caseDetails.defendant.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-rose-100" />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-rose-100">{caseDetails.defendant?.username || 'Unknown'}</p>
                          <p className="font-mono text-xs text-slate-500">{caseDetails.defendant_id}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
                    <div className="rounded-3xl border border-amber-300/15 bg-slate-900/72 p-5">
                      <h3 className="mb-4 flex items-center gap-2 text-lg font-black">
                        <ScrollText className="h-5 w-5 text-amber-200" />
                        Case Information
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Reason</p>
                          <p className="mt-1 text-white">{caseDetails.reason}</p>
                        </div>

                        {caseDetails.description && (
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Description</p>
                            <p className="mt-1 text-slate-200">{caseDetails.description}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3">
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(caseDetails.status)}`}>
                            {caseDetails.status.toUpperCase()}
                          </span>
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
                            Filed {formatDate(caseDetails.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-cyan-300/15 bg-slate-900/72 p-5">
                      <h3 className="mb-4 flex items-center gap-2 text-lg font-black">
                        <Shield className="h-5 w-5 text-cyan-100" />
                        Counsel Info
                      </h3>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-cyan-300/10 bg-white/[0.03] px-4 py-3">
                          <p className="text-xs uppercase tracking-widest text-slate-500">Representation</p>
                          <p className="font-black text-white">{selectedCase.is_pro_bono ? 'Pro Bono' : 'Private Counsel'}</p>
                        </div>

                        <div className="rounded-2xl border border-amber-300/10 bg-white/[0.03] px-4 py-3">
                          <p className="text-xs uppercase tracking-widest text-slate-500">Fee Paid</p>
                          <p className="font-mono text-xl font-black text-amber-100">{selectedCase.fee_paid} TC</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {caseDetails.evidence_url && (
                    <div className="rounded-3xl border border-cyan-300/15 bg-slate-900/72 p-5">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-cyan-100/50">Original Evidence</p>
                      <a
                        href={caseDetails.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 font-black text-cyan-100 hover:bg-cyan-300/20"
                      >
                        <FileText className="h-4 w-4" />
                        View Submitted Evidence
                      </a>
                    </div>
                  )}

                  <div className="rounded-3xl border border-amber-300/15 bg-slate-900/72 p-5">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <h3 className="flex items-center gap-2 text-lg font-black">
                        <LockKeyhole className="h-5 w-5 text-amber-200" />
                        Evidence Locker
                      </h3>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="url"
                          value={newEvidenceUrl}
                          onChange={(e) => setNewEvidenceUrl(e.target.value)}
                          placeholder="Enter evidence URL..."
                          className="min-w-[280px] rounded-2xl border border-cyan-300/15 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                        />
                        <button
                          onClick={handleAddEvidence}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 font-black text-amber-100 hover:bg-amber-300/20"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                    </div>

                    {evidence.length > 0 ? (
                      <div className="space-y-2">
                        {evidence.map((url, index) => (
                          <div
                            key={`${url}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/10 bg-slate-950/70 p-3"
                          >
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-sm font-medium text-cyan-100 hover:text-cyan-50"
                            >
                              {url}
                            </a>
                            <button
                              onClick={() => handleRemoveEvidence(index)}
                              className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-2 text-rose-200 hover:bg-rose-300/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">
                        No attorney evidence added.
                      </p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-cyan-300/15 bg-slate-900/72 p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-black">
                      <FileText className="h-5 w-5 text-cyan-100" />
                      Attorney Notes
                    </h3>
                    <textarea
                      value={attorneyNotes}
                      onChange={(e) => setAttorneyNotes(e.target.value)}
                      placeholder="Prepare arguments, witness notes, strategy, settlement terms, or court reminders..."
                      className="h-36 w-full resize-none rounded-2xl border border-cyan-300/15 bg-slate-950 p-4 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <FileText className="mb-4 h-16 w-16 text-slate-600" />
                  <p className="text-lg font-black">Failed to load case details</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-cyan-300/15 bg-slate-950/95 p-5 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={handleCloseModal}
                className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 font-black text-slate-300 hover:text-white"
              >
                Close File
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleSaveCase}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-6 py-3 font-black text-amber-100 hover:bg-amber-300/20 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  Save Case
                </button>

                <button
                  onClick={handleEnterCourt}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200/35 bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 px-6 py-3 font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.22)] hover:scale-[1.01]"
                >
                  <Gavel className="h-5 w-5" />
                  Enter Courtroom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}