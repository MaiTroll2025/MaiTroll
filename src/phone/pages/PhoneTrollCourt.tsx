import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Gavel,
  Landmark,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  Stamp,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { startCourtSession } from '../../lib/courtSessions'
import { generateUUID } from '../../lib/uuid'

import FileLawsuitModal from '../../components/FileLawsuitModal'
import JudgeRulingModal from '../../components/JudgeRulingModal'
import PayWarrantModal from '../../components/PayWarrantModal'
import { UserSearchInput } from '../../components/UserSearchDropdown'

const CASE_TYPE_MAP: Record<string, string> = {
  'Harassment / Threats': 'criminal',
  'Hate Speech / Discrimination': 'criminal',
  'Nudity / Sexual Content': 'criminal',
  'Doxxing / Personal Info': 'criminal',
  'Scamming / Fraud': 'criminal',
  'Chargeback / Payment Abuse': 'civil',
  'Gift Manipulation / Fake gifting': 'civil',
  'Ban Evasion': 'criminal',
  'Family War Dispute': 'civil',
  'Streamer Misconduct': 'criminal',
  'Officer Misconduct': 'criminal',
  'Appeal Case': 'civil',
  'Copyright / Content Claim': 'civil',
  'TrollCourt Civil Case': 'civil',
  'MaiTroll Policy Violation': 'criminal',
}

const CASE_TYPES = Object.keys(CASE_TYPE_MAP)

export default function PhoneTrollCourt() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [courtSession, setCourtSession] = useState<any>(null)
  const [pendingSummons, setPendingSummons] = useState<any[]>([])
  const [recentCases, setRecentCases] = useState<any[]>([])
  const [myCivilCases, setMyCivilCases] = useState<any[]>([])
  const [assignedCases, setAssignedCases] = useState<any[]>([])

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isFileLawsuitModalOpen, setIsFileLawsuitModalOpen] = useState(false)
  const [showPayWarrantModal, setShowPayWarrantModal] = useState(false)
  const [selectedCaseForRuling, setSelectedCaseForRuling] = useState<any>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedCaseType, setSelectedCaseType] = useState('')
  const [isStartingSession, setIsStartingSession] = useState(false)

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)
  const [selectedDateCases, setSelectedDateCases] = useState<any[]>([])
  const [showCalendar, setShowCalendar] = useState(false)

  const canSummonUser =
    profile?.is_admin === true ||
    profile?.is_judge === true ||
    profile?.is_lead_officer === true ||
    profile?.is_secretary === true ||
    profile?.is_troll_officer === true ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(
      String(profile?.role || ''),
    ) ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(
      String(profile?.troll_role || ''),
    )

  const canStartCourt =
    profile?.is_admin === true ||
    profile?.is_judge === true ||
    profile?.is_lead_officer === true ||
    profile?.is_troll_officer === true ||
    ['admin', 'judge', 'lead_troll_officer', 'troll_officer'].includes(
      String(profile?.role || ''),
    ) ||
    ['admin', 'judge', 'lead_troll_officer', 'troll_officer'].includes(
      String(profile?.troll_role || ''),
    )

  const canAddCase =
    profile?.is_admin === true ||
    profile?.is_judge === true ||
    profile?.is_lead_officer === true ||
    profile?.is_secretary === true ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary'].includes(
      String(profile?.role || ''),
    ) ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary'].includes(
      String(profile?.troll_role || ''),
    )

  const loadRecentCases = useCallback(async () => {
    const { data } = await supabase
      .from('court_cases')
      .select(
        '*, defendant:defendant_id!left(username, avatar_url), plaintiff:plaintiff_id!left(username, avatar_url)',
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) setRecentCases(data)
  }, [])

  const loadCourtState = useCallback(async () => {
    try {
      const { data: currentSession, error } = await supabase.rpc(
        'get_current_court_session',
      )

      let session: any = Array.isArray(currentSession)
        ? currentSession[0]
        : currentSession

      if (error || !session?.id) {
        const { data: fallbackSession } = await supabase
          .from('court_sessions')
          .select('*')
          .in('status', ['live', 'active', 'waiting'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        session = fallbackSession
      }

      setCourtSession(session?.id ? session : null)
    } catch {
      setCourtSession(null)
    }

    if (!user?.id) {
      setPendingSummons([])
      return
    }

    try {
      const { data: summons } = await supabase
        .from('court_summons')
        .select(
          `
            *,
            served_to_user:served_to(username, avatar_url),
            court_cases!court_cases_docket_id_fkey(
              docket_id,
              court_dockets!court_dockets_case_id_fkey!inner(court_date)
            )
          `,
        )
        .eq('summoned_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      const { data: cases } = await supabase
        .from('court_cases')
        .select(
          `
            *,
            defendant_user:defendant_id(username, avatar_url),
            plaintiff_user:plaintiff_id(username, avatar_url),
            court_dockets!inner(court_date)
          `,
        )
        .eq('defendant_id', user.id)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const transformedSummons = (summons || []).map((s: any) => ({
        ...s,
        source: 'summons',
        court_date:
          s.court_cases?.court_dockets?.court_date ||
          s.scheduled_for ||
          null,
        summoned_user: s.served_to_user,
      }))

      const transformedCases = (cases || []).map((c: any) => ({
        ...c,
        source: 'case',
        court_date: c.court_dockets?.court_date || null,
        defendant: c.defendant_user,
        plaintiff: c.plaintiff_user,
      }))

      setPendingSummons([
        ...transformedSummons,
        ...transformedCases,
      ])
    } catch (error) {
      console.error('[PhoneTrollCourt] Failed loading summons:', error)
    }
  }, [user?.id])

  const loadMyCases = useCallback(async () => {
    if (!user?.id) return

    const { data } = await supabase
      .from('troll_court_cases')
      .select(
        '*, defendant:defendant_id!left(username, avatar_url), plaintiff:plaintiff_id!left(username, avatar_url)',
      )
      .or(`plaintiff_id.eq.${user.id},defendant_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (data) setMyCivilCases(data)

    if (
      ['admin', 'lead_troll_officer', 'judge'].includes(
        String(profile?.role || ''),
      )
    ) {
      const { data: assigned } = await supabase
        .from('troll_court_cases')
        .select(
          '*, defendant:defendant_id!left(username, avatar_url), plaintiff:plaintiff_id!left(username, avatar_url)',
        )
        .eq('assigned_judge_id', user.id)
        .neq('status', 'ruled')
        .neq('status', 'dismissed')
        .order('created_at', { ascending: true })

      if (assigned) setAssignedCases(assigned)
    }
  }, [user?.id, profile?.role])

  const fetchCalendarCases = useCallback(async () => {
    const startStr = `${calendarYear}-${String(calendarMonth + 1).padStart(
      2,
      '0',
    )}-01`

    const lastDay = new Date(
      calendarYear,
      calendarMonth + 1,
      0,
    ).getDate()

    const endStr = `${calendarYear}-${String(calendarMonth + 1).padStart(
      2,
      '0',
    )}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('court_dockets')
      .select(
        `
          *,
          court_cases!court_cases_docket_id_fkey(
            *,
            defendant:defendant_id!left(username, avatar_url),
            plaintiff:plaintiff_id!left(username, avatar_url)
          )
        `,
      )
      .gte('court_date', startStr)
      .lte('court_date', endStr)
      .is('court_cases.deleted_at', null)
      .order('court_date', { ascending: true })

    if (data) {
      const cases = data.flatMap((d: any) => d.court_cases || [])
      setSelectedDateCases(
        selectedCalendarDate
          ? cases.filter((c: any) => {
              const date =
                c.court_date ||
                c.scheduled_for ||
                c.court_dockets?.court_date

              return date?.startsWith(selectedCalendarDate)
            })
          : [],
      )

      return data
    }

    return []
  }, [
    calendarMonth,
    calendarYear,
    selectedCalendarDate,
  ])

  useEffect(() => {
    loadRecentCases()
    loadCourtState()
    loadMyCases()

    const channel = supabase
      .channel('phone-court-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_sessions',
        },
        () => loadCourtState(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_summons',
        },
        () => loadCourtState(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'court_cases',
        },
        () => {
          loadRecentCases()
          loadMyCases()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [
    loadRecentCases,
    loadCourtState,
    loadMyCases,
  ])

  useEffect(() => {
    fetchCalendarCases()
  }, [fetchCalendarCases])

  const openCourtModal = () => {
    if (!canSummonUser) return

    setSelectedUser(null)
    setSearchQuery('')
    setSelectedCaseType('')
    setIsCreateModalOpen(true)
  }

  const handleSummonOrStart = async () => {
    if (!user?.id) {
      toast.error('You must be signed in.')
      return
    }

    setIsStartingSession(true)

    try {
      let activeSessionId = courtSession?.id
      const dbCaseType = CASE_TYPE_MAP[selectedCaseType]

      if (!activeSessionId) {
        const newSessionId = generateUUID()

        const { data, error } = await startCourtSession({
          sessionId: newSessionId,
          maxBoxes: 2,
          roomName: newSessionId,
          userId: user.id,
          defendantId: selectedUser?.id,
        })

        if (error) throw error

        activeSessionId = data?.id || newSessionId

        setCourtSession(
          data || {
            id: activeSessionId,
            status: 'active',
            created_at: new Date().toISOString(),
          },
        )
      }

      if (selectedUser && activeSessionId && dbCaseType) {
        const { error } = await supabase.rpc('create_court_case', {
          p_case_type: dbCaseType,
          p_plaintiff_id: user.id,
          p_defendant_id: selectedUser.id,
          p_court_session_id: activeSessionId,
        })

        if (error) throw error

        toast.success(
          courtSession
            ? 'Summons issued'
            : 'Court opened and case docketed',
        )
      } else if (activeSessionId) {
        toast.success(
          courtSession
            ? 'Court session updated'
            : 'Court session opened',
        )
      }

      setIsCreateModalOpen(false)

      if (activeSessionId) {
        navigate(`/court/${activeSessionId}`)
      }
    } catch (error: any) {
      toast.error(
        error?.message || 'Unable to open court session.',
      )
    } finally {
      setIsStartingSession(false)
    }
  }

  const handleEndCourtSession = async () => {
    if (!courtSession?.id) {
      toast.error('No active court session.')
      return
    }

    if (
      !window.confirm(
        'Are you sure you want to adjourn this court session?',
      )
    ) {
      return
    }

    try {
      const { error } = await supabase.rpc('end_court_session', {
        p_session_id: String(courtSession.id),
      })

      if (error) throw error

      const sessionId = courtSession.id

      setCourtSession(null)

      toast.success('Court session adjourned.')

      navigate(`/court/${sessionId}/summary`)
    } catch (error: any) {
      toast.error(
        error?.message || 'Failed to adjourn court.',
      )
    }
  }

  const calendarCases = useMemo(() => {
    return selectedDateCases
  }, [selectedDateCases])

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      calendarYear,
      calendarMonth,
      1,
    ).getDay()

    const daysInMonth = new Date(
      calendarYear,
      calendarMonth + 1,
      0,
    ).getDate()

    const days: (number | null)[] = []

    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }, [calendarMonth, calendarYear])

  const monthLabel = new Date(
    calendarYear,
    calendarMonth,
  ).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const selectedDateLabel = selectedCalendarDate
    ? (() => {
        const [year, month, day] =
          selectedCalendarDate.split('-').map(Number)

        return new Date(
          year,
          month - 1,
          day,
        ).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      })()
    : null

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#08050D] text-white">
      {/* PHONE COURT BACKGROUND */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(168,85,247,0.20),transparent_35%),radial-gradient(circle_at_100%_30%,rgba(245,158,11,0.10),transparent_35%),linear-gradient(180deg,#0C0712,#08050D_55%,#050308)]" />

        <div className="absolute left-1/2 top-[-100px] h-72 w-72 -translate-x-1/2 rounded-full bg-purple-600/10 blur-3xl" />

        <div className="absolute bottom-[-100px] right-[-100px] h-72 w-72 rounded-full bg-amber-600/10 blur-3xl" />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#09060F]/90 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 active:scale-95"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Scale
                size={16}
                className="text-amber-300"
              />

              <h1 className="text-sm font-black uppercase tracking-[0.18em]">
                Troll Court
              </h1>
            </div>

            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-white/35">
              Mai Troll Judiciary
            </p>
          </div>

          <div
            className={`h-2.5 w-2.5 rounded-full ${
              courtSession
                ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                : 'bg-white/20'
            }`}
          />
        </div>
      </header>

      <main className="relative mx-auto max-w-xl px-4 pb-28 pt-4">
        {/* COURT HERO */}
        <section className="relative overflow-hidden rounded-[1.7rem] border border-amber-300/15 bg-[#120B18]/90 p-5 shadow-[0_0_45px_rgba(168,85,247,0.08)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_50%)]" />

          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200">
                Official Court
              </span>

              <span
                className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                  courtSession
                    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-white/45'
                }`}
              >
                {courtSession
                  ? 'In Session'
                  : 'Court Adjourned'}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-400/15 to-purple-500/10 shadow-[0_0_25px_rgba(245,158,11,0.10)]">
                <Scale
                  size={30}
                  className="text-amber-300"
                />
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight">
                  Troll Court
                </h2>

                <p className="mt-1 text-xs leading-5 text-white/45">
                  Cases, lawsuits, summons, rulings and
                  official proceedings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="mt-3 grid grid-cols-3 gap-2">
          <MobileStat
            icon={<FileText size={14} />}
            label="Cases"
            value={recentCases.length}
          />

          <MobileStat
            icon={<Calendar size={14} />}
            label="Dockets"
            value={selectedDateCases.length}
          />

          <MobileStat
            icon={<AlertTriangle size={14} />}
            label="Summons"
            value={pendingSummons.length}
          />
        </section>

        {/* SUMMONS */}
        {pendingSummons.length > 0 && (
          <section className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle
                size={20}
                className="mt-0.5 shrink-0 text-yellow-300"
              />

              <div>
                <p className="text-sm font-black text-yellow-200">
                  Court Summons
                </p>

                <p className="mt-1 text-xs leading-5 text-yellow-100/60">
                  {pendingSummons[0]?.reason ||
                    'You have been summoned to Troll Court.'}
                </p>

                {pendingSummons[0]?.court_date && (
                  <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-yellow-300/70">
                    Court Date:{' '}
                    {new Date(
                      pendingSummons[0].court_date,
                    ).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* COURT STATUS */}
        <PhoneSection
          title="Courtroom"
          icon={<Gavel size={17} />}
        >
          {courtSession ? (
            <>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle
                    size={18}
                    className="text-emerald-300"
                  />

                  <span className="text-sm font-black text-emerald-200">
                    Court is in session
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-emerald-100/55">
                  Official proceedings are currently open.
                </p>

                {courtSession.created_at && (
                  <p className="mt-2 text-[10px] text-emerald-200/40">
                    Opened{' '}
                    {new Date(
                      courtSession.created_at,
                    ).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <PhoneAction
                  icon={<Eye size={16} />}
                  label="Enter Court"
                  onClick={() =>
                    navigate(
                      `/court/${courtSession.id}`,
                    )
                  }
                  tone="purple"
                />

                <PhoneAction
                  icon={<FileText size={16} />}
                  label="Civil Lawsuit"
                  onClick={() =>
                    setIsFileLawsuitModalOpen(true)
                  }
                  tone="red"
                />

                {canSummonUser && (
                  <PhoneAction
                    icon={<Stamp size={16} />}
                    label="Summon"
                    onClick={openCourtModal}
                    tone="gold"
                  />
                )}

                {profile?.has_active_warrant && (
                  <PhoneAction
                    icon={<ShieldAlert size={16} />}
                    label="Pay Warrant"
                    onClick={() =>
                      setShowPayWarrantModal(true)
                    }
                    tone="gold"
                  />
                )}

                {canSummonUser && (
                  <PhoneAction
                    icon={<X size={16} />}
                    label="Adjourn"
                    onClick={handleEndCourtSession}
                    tone="danger"
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Landmark
                    size={18}
                    className="text-white/50"
                  />

                  <span className="text-sm font-black text-white/80">
                    Court is adjourned
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-white/40">
                  Court is currently closed, but civil
                  filings and case review remain available.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <PhoneAction
                  icon={<Gavel size={16} />}
                  label="File Lawsuit"
                  onClick={() =>
                    setIsFileLawsuitModalOpen(true)
                  }
                  tone="red"
                />

                {profile?.has_active_warrant && (
                  <PhoneAction
                    icon={<ShieldAlert size={16} />}
                    label="Pay Warrant"
                    onClick={() =>
                      setShowPayWarrantModal(true)
                    }
                    tone="gold"
                  />
                )}

                {canStartCourt && courtSession && (
                  <PhoneAction
                    icon={<Eye size={16} />}
                    label="Watch Live"
                    onClick={() =>
                      navigate(
                        `/troll-court/watch/${courtSession.id}`,
                      )
                    }
                    tone="green"
                  />
                )}

                {canSummonUser && (
                  <PhoneAction
                    icon={<Scale size={16} />}
                    label="Open Court"
                    onClick={openCourtModal}
                    tone="gold"
                  />
                )}
              </div>

              {!canSummonUser && (
                <div className="mt-3 flex gap-3 rounded-2xl border border-red-400/15 bg-red-500/5 p-3">
                  <Shield
                    size={17}
                    className="shrink-0 text-red-300"
                  />

                  <p className="text-[11px] leading-5 text-red-100/50">
                    Court authority is required to open
                    official proceedings.
                  </p>
                </div>
              )}
            </>
          )}
        </PhoneSection>

        {/* JUDGE ASSIGNMENTS */}
        {assignedCases.length > 0 && (
          <PhoneSection
            title="Judge's Bench"
            icon={<Gavel size={17} />}
          >
            <div className="space-y-2">
              {assignedCases.map((caseData) => (
                <PhoneCaseCard
                  key={caseData.id}
                  caseData={caseData}
                  badge="ACTION REQUIRED"
                  tone="purple"
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCaseForRuling(
                          caseData,
                        )
                      }
                      className="mt-3 w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-800 py-2.5 text-xs font-black"
                    >
                      Open Case File
                    </button>
                  }
                />
              ))}
            </div>
          </PhoneSection>
        )}

        {/* MY CASES */}
        {myCivilCases.length > 0 && (
          <PhoneSection
            title="My Civil Lawsuits"
            icon={<FileText size={17} />}
          >
            <div className="space-y-2">
              {myCivilCases.map((caseData) => (
                <PhoneCaseCard
                  key={caseData.id}
                  caseData={caseData}
                  badge={String(
                    caseData.status || 'pending',
                  ).toUpperCase()}
                  tone={
                    caseData.status === 'ruled'
                      ? 'green'
                      : caseData.status === 'dismissed'
                        ? 'neutral'
                        : 'yellow'
                  }
                  subtitle={
                    caseData.claim_amount !== undefined
                      ? `Claim: ${caseData.claim_amount} coins`
                      : undefined
                  }
                  footer={
                    caseData.ruling_verdict
                      ? `Verdict: ${caseData.ruling_verdict}`
                      : undefined
                  }
                />
              ))}
            </div>
          </PhoneSection>
        )}

        {/* CALENDAR */}
        <PhoneSection
          title="Court Docket"
          icon={<Calendar size={17} />}
        >
          <button
            type="button"
            onClick={() =>
              setShowCalendar((value) => !value)
            }
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Calendar
                size={18}
                className="text-amber-300"
              />

              <div className="text-left">
                <p className="text-xs font-black">
                  Court Calendar
                </p>

                <p className="mt-0.5 text-[10px] text-white/35">
                  {selectedDateLabel ||
                    'View scheduled cases'}
                </p>
              </div>
            </div>

            {showCalendar ? (
              <ChevronLeft
                size={18}
                className="rotate-90"
              />
            ) : (
              <ChevronRight
                size={18}
                className="rotate-90"
              />
            )}
          </button>

          {showCalendar && (
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11)
                      setCalendarYear(
                        calendarYear - 1,
                      )
                    } else {
                      setCalendarMonth(
                        calendarMonth - 1,
                      )
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                >
                  <ChevronLeft size={17} />
                </button>

                <span className="text-xs font-black">
                  {monthLabel}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0)
                      setCalendarYear(
                        calendarYear + 1,
                      )
                    } else {
                      setCalendarMonth(
                        calendarMonth + 1,
                      )
                    }
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
                >
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7">
                {[
                  'S',
                  'M',
                  'T',
                  'W',
                  'T',
                  'F',
                  'S',
                ].map((day, index) => (
                  <div
                    key={`${day}-${index}`}
                    className="py-2 text-center text-[9px] font-black text-white/25"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="aspect-square"
                      />
                    )
                  }

                  const dateStr = `${calendarYear}-${String(
                    calendarMonth + 1,
                  ).padStart(2, '0')}-${String(day).padStart(
                    2,
                    '0',
                  )}`

                  const isSelected =
                    selectedCalendarDate === dateStr

                  const isToday =
                    new Date().getFullYear() ===
                      calendarYear &&
                    new Date().getMonth() ===
                      calendarMonth &&
                    new Date().getDate() === day

                  return (
                    <button
                      type="button"
                      key={dateStr}
                      onClick={() => {
                        setSelectedCalendarDate(
                          dateStr,
                        )
                      }}
                      className={`relative aspect-square rounded-xl text-xs font-bold transition ${
                        isSelected
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/[0.03] text-white/60'
                      } ${
                        isToday && !isSelected
                          ? 'ring-1 ring-red-400'
                          : ''
                      }`}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>

              {selectedCalendarDate && (
                <div className="mt-4 rounded-2xl border border-amber-300/10 bg-black/20 p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    {selectedDateLabel}
                  </p>

                  {calendarCases.length > 0 ? (
                    <div className="space-y-2">
                      {calendarCases.map((caseData) => (
                        <button
                          type="button"
                          key={caseData.id}
                          onClick={() => {
                            if (canStartCourt) {
                              setSelectedCaseForRuling(
                                caseData,
                              )
                            }
                          }}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left"
                        >
                          <p className="text-xs font-black">
                            {caseData.title ||
                              caseData.category ||
                              `Case #${String(
                                caseData.id,
                              ).slice(0, 8)}`}
                          </p>

                          <p className="mt-1 text-[10px] text-white/35">
                            {caseData.status ||
                              'pending'}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-xs text-white/30">
                      No cases scheduled for this
                      date.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </PhoneSection>

        {/* PUBLIC CASES */}
        <PhoneSection
          title="Public Case Docket"
          icon={<Gavel size={17} />}
        >
          {recentCases.length > 0 ? (
            <div className="space-y-2">
              {recentCases.map((caseData) => (
                <PhoneCaseCard
                  key={caseData.id}
                  caseData={caseData}
                  badge={
                    caseData.status ===
                    'in_session'
                      ? 'IN SESSION'
                      : caseData.status ===
                          'resolved'
                        ? 'RESOLVED'
                        : 'PENDING'
                  }
                  tone={
                    caseData.status ===
                    'resolved'
                      ? 'green'
                      : caseData.status ===
                          'in_session'
                        ? 'purple'
                        : 'yellow'
                  }
                  footer={
                    caseData.scheduled_for
                      ? `Scheduled: ${new Date(
                          caseData.scheduled_for,
                        ).toLocaleDateString()}`
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-7 text-center">
              <Gavel
                size={28}
                className="mx-auto text-white/15"
              />

              <p className="mt-3 text-xs text-white/30">
                No recent cases found.
              </p>
            </div>
          )}
        </PhoneSection>

        {/* COURT AUTHORITY */}
        <PhoneSection
          title="Court Authority"
          icon={<Shield size={17} />}
        >
          <div className="space-y-2">
            <AuthorityItem
              title="Chief Justice"
              badge="Admin"
            />

            <AuthorityItem
              title="Senior Judges"
              badge="Lead Officers"
            />

            <AuthorityItem
              title="Court Officers"
              badge="Troll Officers"
            />

            <AuthorityItem
              title="Court Clerk"
              badge="Secretary / System"
            />
          </div>
        </PhoneSection>

        {/* PROCEDURE */}
        <PhoneSection
          title="Rules of Procedure"
          icon={<Scale size={17} />}
        >
          <div className="space-y-2">
            {[
              'All rulings must be issued by authorized Troll Court officials.',
              'Evidence must be presented before judgment.',
              'Appeals may be filed within 24 hours.',
              'Court sessions are recorded for transparency.',
            ].map((rule, index) => (
              <div
                key={rule}
                className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-[9px] font-black text-amber-300">
                  {index + 1}
                </span>

                <p className="text-[11px] leading-5 text-white/45">
                  {rule}
                </p>
              </div>
            ))}
          </div>
        </PhoneSection>
      </main>

      {/* OPEN COURT / SUMMON MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border border-amber-300/20 bg-[#100A15] shadow-[0_-20px_80px_rgba(168,85,247,0.15)]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#100A15]/95 px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Gavel
                      size={18}
                      className="text-amber-300"
                    />

                    <h3 className="text-base font-black">
                      Open Court
                    </h3>
                  </div>

                  <p className="mt-1 text-[10px] text-white/35">
                    Create proceedings or summon a
                    defendant.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsCreateModalOpen(false)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/50"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {/* CASE TYPE */}
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-white/40">
                  Case Reason
                </label>

                <select
                  value={selectedCaseType}
                  onChange={(event) =>
                    setSelectedCaseType(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none"
                >
                  <option value="">
                    No Case Reason — Open Court
                  </option>

                  {CASE_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* DEFENDANT */}
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-white/40">
                  Defendant
                </label>

                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3.5 top-3.5 text-white/25"
                  />

                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(
                        event.target.value,
                      )

                      setShowDropdown(true)

                      if (selectedUser) {
                        setSelectedUser(null)
                      }
                    }}
                    onFocus={() =>
                      setShowDropdown(true)
                    }
                    onBlur={() =>
                      setTimeout(
                        () => setShowDropdown(false),
                        200,
                      )
                    }
                    placeholder="Search username..."
                    className="w-full rounded-2xl border border-white/10 bg-black/30 py-3.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-purple-400/40"
                  />

                  {showDropdown && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2">
                      <UserSearchInput
                        query={searchQuery}
                        onSelect={(
                          userId,
                          username,
                        ) => {
                          setSelectedUser({
                            id: userId,
                            username,
                          })

                          setSearchQuery(username)
                          setShowDropdown(false)
                        }}
                        disableNavigation
                      />
                    </div>
                  )}
                </div>
              </div>

              {selectedUser && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300/60">
                    Selected Defendant
                  </p>

                  <p className="mt-1 text-sm font-black text-emerald-200">
                    @{selectedUser.username}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                <p className="text-[10px] leading-5 text-white/35">
                  You can open a courtroom without a
                  defendant and add a defendant later
                  through the docket.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setIsCreateModalOpen(false)
                  }
                  className="rounded-2xl border border-white/10 bg-white/5 py-3.5 text-xs font-black text-white/55"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSummonOrStart}
                  disabled={isStartingSession}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-purple-700 py-3.5 text-xs font-black text-white shadow-[0_0_25px_rgba(245,158,11,0.15)] disabled:opacity-50"
                >
                  {isStartingSession
                    ? 'Processing...'
                    : selectedUser
                      ? courtSession
                        ? 'Issue Summons'
                        : 'Open & Summon'
                      : courtSession
                        ? 'Add Defendant'
                        : 'Open Court'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <FileLawsuitModal
        isOpen={isFileLawsuitModalOpen}
        onClose={() =>
          setIsFileLawsuitModalOpen(false)
        }
        onSuccess={() => {
          loadMyCases()
        }}
      />

      <PayWarrantModal
        isOpen={showPayWarrantModal}
        onClose={() =>
          setShowPayWarrantModal(false)
        }
      />

      <JudgeRulingModal
        isOpen={!!selectedCaseForRuling}
        caseData={selectedCaseForRuling}
        onClose={() =>
          setSelectedCaseForRuling(null)
        }
        onSuccess={() => {
          setSelectedCaseForRuling(null)
          loadMyCases()
          loadRecentCases()
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* MOBILE COMPONENTS                                                          */
/* -------------------------------------------------------------------------- */

function PhoneSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#100A16]/90 p-4 shadow-[0_0_30px_rgba(0,0,0,0.25)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-amber-300">
          {icon}
        </span>

        <h2 className="text-sm font-black">
          {title}
        </h2>
      </div>

      {children}
    </section>
  )
}

function MobileStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#100A16]/90 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-amber-300/70">
        {icon}

        <span className="text-[8px] font-black uppercase tracking-wider text-white/30">
          {label}
        </span>
      </div>

      <p className="text-xl font-black">
        {value}
      </p>
    </div>
  )
}

function PhoneAction({
  icon,
  label,
  onClick,
  tone = 'purple',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'purple' | 'red' | 'gold' | 'green' | 'danger'
}) {
  const tones = {
    purple:
      'border-purple-400/20 bg-gradient-to-br from-purple-700/80 to-indigo-950/80',
    red:
      'border-red-400/20 bg-gradient-to-br from-red-700/80 to-red-950/80',
    gold:
      'border-amber-300/20 bg-gradient-to-br from-amber-500/90 to-purple-900/90',
    green:
      'border-emerald-400/20 bg-gradient-to-br from-emerald-600/80 to-emerald-950/80',
    danger:
      'border-red-400/20 bg-gradient-to-br from-red-950 to-black',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-[10px] font-black text-white transition active:scale-[0.98] ${tones[tone]}`}
    >
      {icon}
      {label}
    </button>
  )
}

function PhoneCaseCard({
  caseData,
  badge,
  tone,
  subtitle,
  footer,
  action,
}: {
  caseData: any
  badge: string
  tone: 'green' | 'yellow' | 'purple' | 'neutral'
  subtitle?: string
  footer?: string
  action?: React.ReactNode
}) {
  const tones = {
    green:
      'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    yellow:
      'border-yellow-400/20 bg-yellow-500/10 text-yellow-300',
    purple:
      'border-purple-400/20 bg-purple-500/10 text-purple-300',
    neutral:
      'border-white/10 bg-white/5 text-white/45',
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white/90">
            {caseData.title ||
              caseData.category ||
              `Case #${String(
                caseData.id,
              ).slice(0, 8)}`}
          </p>

          <p className="mt-1 text-[10px] text-white/30">
            Plaintiff:{' '}
            {caseData.plaintiff?.username ||
              caseData.plaintiff_user?.username ||
              'Unknown'}
          </p>

          <p className="text-[10px] text-white/30">
            Defendant:{' '}
            {caseData.defendant?.username ||
              caseData.defendant_user?.username ||
              'Unknown'}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase ${tones[tone]}`}
        >
          {badge}
        </span>
      </div>

      {subtitle && (
        <p className="mt-2 text-[10px] text-white/35">
          {subtitle}
        </p>
      )}

      {(caseData.description ||
        caseData.reason) && (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] leading-5 italic text-white/40">
          “
          {caseData.description ||
            caseData.reason}
          ”
        </p>
      )}

      {footer && (
        <p className="mt-2 text-[10px] font-bold text-amber-200/60">
          {footer}
        </p>
      )}

      {action}
    </div>
  )
}

function AuthorityItem({
  title,
  badge,
}: {
  title: string
  badge: string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3">
      <span className="text-xs text-white/55">
        {title}
      </span>

      <span className="rounded-full border border-amber-300/15 bg-amber-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-200/70">
        {badge}
      </span>
    </div>
  )
}