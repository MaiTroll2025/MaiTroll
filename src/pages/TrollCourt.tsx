import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
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

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import useSEO from '@/hooks/useSEO';
import { startCourtSession } from '../lib/courtSessions'
import { MaiTrollTheme } from '../styles/trollCityTheme'
import FileLawsuitModal from '../components/FileLawsuitModal'
import JudgeRulingModal from '../components/JudgeRulingModal'
import PayWarrantModal from '../components/PayWarrantModal'
import { UserSearchInput } from '../components/UserSearchDropdown'
import { generateUUID } from '../lib/uuid'

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

const CASE_TYPES = [
  'Harassment / Threats',
  'Hate Speech / Discrimination',
  'Nudity / Sexual Content',
  'Doxxing / Personal Info',
  'Scamming / Fraud',
  'Chargeback / Payment Abuse',
  'Gift Manipulation / Fake gifting',
  'Ban Evasion',
  'Family War Dispute',
  'Streamer Misconduct',
  'Officer Misconduct',
  'Appeal Case',
  'Copyright / Content Claim',
  'TrollCourt Civil Case',
  'MaiTroll Policy Violation',
]

export default function TrollCourt() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()

  useSEO({
    title: 'Troll Court | Community Court & Social Justice | Mai Troll',
    description: 'MaiTroll Court is a community-driven social justice system. File cases, vote on rulings, and participate in virtual court proceedings. A unique online voting and justice experience.',
    keywords: [
      'community court', 'social justice game', 'virtual court', 'online voting system',
      'Troll Court', 'court system', 'community justice', 'vote on cases',
      'online court', 'social court', 'MaiTroll court'
    ]
  });

  const [courtSession, setCourtSession] = useState<any>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [pendingSummons, setPendingSummons] = useState<any[]>([])
  const [recentCases, setRecentCases] = useState<any[]>([])
  const [myCivilCases, setMyCivilCases] = useState<any[]>([])
  const [assignedCases, setAssignedCases] = useState<any[]>([])
  const [selectedCaseForRuling, setSelectedCaseForRuling] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFileLawsuitModalOpen, setIsFileLawsuitModalOpen] = useState(false)
  const [showPayWarrantModal, setShowPayWarrantModal] = useState(false)
  const [_userList, setUserList] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [_isSearchingUsers, setIsSearchingUsers] = useState(false)
  const [selectedCaseType, setSelectedCaseType] = useState<string>('')
  const [showDropdown, setShowDropdown] = useState(false)

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null)
  const [allDockets, setAllDockets] = useState<any[]>([])
  const [showCaseDetailsModal, setShowCaseDetailsModal] = useState(false)
  const [selectedDateCases, setSelectedDateCases] = useState<any[]>([])

  const canSummonUser =
    profile?.is_admin === true ||
    profile?.is_judge === true ||
    profile?.is_lead_officer === true ||
    profile?.is_secretary === true ||
    profile?.is_troll_officer === true ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(String(profile?.role || '')) ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary', 'troll_officer'].includes(String(profile?.troll_role || ''))

  const canAddCase =
    profile?.is_admin === true ||
    profile?.is_judge === true ||
    profile?.is_lead_officer === true ||
    profile?.is_secretary === true ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary'].includes(String(profile?.role || '')) ||
    ['admin', 'judge', 'lead_troll_officer', 'secretary'].includes(String(profile?.troll_role || ''))

  const canStartCourt =
    profile?.is_admin === true ||
    profile?.is_judge === true ||
    profile?.is_lead_officer === true ||
    profile?.is_troll_officer === true ||
    ['admin', 'judge', 'lead_troll_officer', 'troll_officer'].includes(String(profile?.role || '')) ||
    ['admin', 'judge', 'lead_troll_officer', 'troll_officer'].includes(String(profile?.troll_role || ''))

  useEffect(() => {
    const fetchCases = async () => {
      const { data } = await supabase
        .from('court_cases')
        .select('*, defendant:defendant_id!left(username, avatar_url), plaintiff:plaintiff_id!left(username, avatar_url)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5)

      if (data) setRecentCases(data)
    }

    fetchCases()
  }, [])

  useEffect(() => {
    if (!user) return

    const fetchMyCivilCases = async () => {
      const { data } = await supabase
        .from('troll_court_cases')
        .select('*, defendant:defendant_id!left(username, avatar_url), plaintiff:plaintiff_id!left(username, avatar_url)')
        .or(`plaintiff_id.eq.${user.id},defendant_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (data) setMyCivilCases(data)

      if (profile?.role === 'admin' || profile?.role === 'lead_troll_officer' || profile?.role === 'judge') {
        const { data: assigned } = await supabase
          .from('troll_court_cases')
          .select('*, defendant:defendant_id!left(username, avatar_url), plaintiff:plaintiff_id!left(username, avatar_url)')
          .eq('assigned_judge_id', user.id)
          .neq('status', 'ruled')
          .neq('status', 'dismissed')
          .order('created_at', { ascending: true })

        if (assigned) setAssignedCases(assigned)
      }
    }

    fetchMyCivilCases()
  }, [user, isFileLawsuitModalOpen, selectedCaseForRuling, profile?.role])

  const fetchDockets = useCallback(async () => {
    const startStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate()
    const endStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data } = await supabase
      .from('court_dockets')
      .select(`
        *,
        court_cases!court_cases_docket_id_fkey(
          *,
          defendant:defendant_id!left(username, avatar_url),
          plaintiff:plaintiff_id!left(username, avatar_url)
        )
      `)
      .gte('court_date', startStr)
      .lte('court_date', endStr)
      .is('court_cases.deleted_at', null)
      .order('court_date', { ascending: true })

    if (data) setAllDockets(data)
  }, [calendarMonth, calendarYear])

  useEffect(() => {
    fetchDockets()
  }, [fetchDockets])

  useEffect(() => {
    const fetchSelectedDateCases = async () => {
      if (!selectedCalendarDate) return

      const { data: docketData } = await supabase
        .from('court_dockets')
        .select(`
          *,
          court_cases!court_cases_docket_id_fkey(
            *,
            defendant:defendant_id!left(username, avatar_url),
            plaintiff:plaintiff_id!left(username, avatar_url)
          )
        `)
        .eq('court_date', selectedCalendarDate)

      if (docketData) {
        setSelectedDateCases(docketData.flatMap((d) => d.court_cases || []))
      }
    }

    fetchSelectedDateCases()
  }, [selectedCalendarDate])

  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      setUserList([])
      return
    }

    let cancelled = false

    const searchUsers = async () => {
      setIsSearchingUsers(true)

      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `%${searchQuery.trim()}%`)
          .limit(20)

        if (!cancelled && data) setUserList(data)
      } catch (err) {
        console.error('User search error:', err)
      } finally {
        if (!cancelled) setIsSearchingUsers(false)
      }
    }

    const timer = setTimeout(searchUsers, 400)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery])

  const loadPublicCourtState = useCallback(async () => {
    const { data: recent } = await supabase
      .from('court_cases')
      .select('*, defendant:defendant_id!left(username, avatar_url), plaintiff:plaintiff_id!left(username, avatar_url)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5)

    if (recent) setRecentCases(recent)
  }, [])

  const loadCourtState = useCallback(async () => {
    try {
      const { data: currentSession, error: sessionError } = await supabase.rpc('get_current_court_session')

      if (sessionError) throw new Error('RPC not available')

      let session = Array.isArray(currentSession) ? currentSession[0] : currentSession

      if (!session?.id) {
        const { data: fallbackSession } = await supabase
          .from('court_sessions')
          .select('*')
          .in('status', ['live', 'active', 'waiting'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (fallbackSession) session = fallbackSession
      }

      setCourtSession(session?.id ? session : null)
    } catch {
      try {
        const { data: stream } = await supabase
          .from('streams')
          .select('id, title, created_at, started_at')
          .eq('category', 'court')
          .eq('is_live', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (stream?.id) {
          const sessionId = stream.id.startsWith('court-') ? stream.id.slice('court-'.length) : stream.id
          setCourtSession({
            id: sessionId,
            status: 'live',
            created_at: stream.created_at || stream.started_at,
            started_at: stream.started_at || stream.created_at,
          })
        } else {
          setCourtSession(null)
        }
      } catch {
        setCourtSession(null)
      }
    } finally {
      if (user?.id) {
        const { data: summons } = await supabase
          .from('court_summons')
          .select(`
            *,
            served_to_user:served_to(username, avatar_url),
            court_cases!court_cases_docket_id_fkey(
              docket_id,
            court_dockets!court_dockets_case_id_fkey!inner(court_date)
            )
          `)
          .eq('summoned_user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        const { data: cases } = await supabase
          .from('court_cases')
          .select(`
            *,
            defendant_user:defendant_id(username, avatar_url),
            plaintiff_user:plaintiff_id(username, avatar_url),
            court_dockets!court_cases_docket_id_fkey(court_date)
          `)
          .eq('defendant_id', user.id)
          .eq('status', 'pending')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        const transformedSummons = (summons || []).map((s: any) => ({
          ...s,
          reason: s.reason,
          court_date: s.court_cases?.court_dockets?.court_date || s.scheduled_for || null,
          source: 'summons',
          summoned_user: s.served_to_user,
        }))

        const transformedCases = (cases || []).map((c: any) => ({
          id: c.id,
          reason: c.reason,
          court_date: c.court_dockets?.court_date || null,
          source: 'case',
          defendant: c.defendant_user,
          plaintiff: c.plaintiff_user,
        }))

        setPendingSummons([...transformedSummons, ...transformedCases])
      } else {
        setPendingSummons([])
      }
    }
  }, [user?.id])

  useEffect(() => {
    loadPublicCourtState()
    loadCourtState()

    const channel = supabase
      .channel('court-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_sessions' }, () => loadCourtState())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_summons' }, () => loadCourtState())
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user?.id, canStartCourt, canSummonUser, loadPublicCourtState, loadCourtState])

  const openCreateModal = () => {
    if (!canSummonUser) return
    setIsCreateModalOpen(true)
    setSearchQuery('')
    setSelectedUser(null)
  }

  const handleSummonOrStart = async () => {
    if (!user?.id) {
      toast.error('User not authenticated')
      return
    }

    setIsStartingSession(true)

    try {
      let activeSessionId = courtSession?.id
      const dbCaseType = CASE_TYPE_MAP[selectedCaseType]

      if (!activeSessionId) {
        const newSessionId = generateUUID()

        const { data, error: startError } = await startCourtSession({
          sessionId: newSessionId,
          maxBoxes: 2,
          roomName: newSessionId,
          userId: user.id,
          defendantId: selectedUser?.id,
        })

        if (startError) throw startError

        activeSessionId = data?.id || newSessionId
        setCourtSession(data || { id: activeSessionId, created_at: new Date().toISOString() })
      }

      if (selectedUser && activeSessionId && dbCaseType) {
        const { error: caseError } = await supabase.rpc('create_court_case', {
          p_case_type: dbCaseType,
          p_plaintiff_id: user.id,
          p_defendant_id: selectedUser.id,
          p_court_session_id: activeSessionId,
        })

        if (caseError) {
          toast.error(`Failed to create case: ${caseError.message}`)
        } else {
          const { data: newCase } = await supabase
            .from('court_cases')
            .select('id, defendant_id, reason, court_date')
            .eq('court_session_id', activeSessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (newCase?.id) {
            await supabase
              .from('court_sessions')
              .update({ case_id: newCase.id })
              .eq('id', activeSessionId)

            const { notifyAdminCourtStarted } = await import('../lib/notifications')
            notifyAdminCourtStarted(
              newCase.id,
              newCase.defendant_id || selectedUser.id,
              selectedUser.username,
              newCase.reason || 'Court case opened',
              newCase.court_date ? new Date(newCase.court_date).toLocaleDateString() : 'TBD'
            ).catch((e) => console.warn('[TrollCourt] Failed to notify admins:', e))
          }

          toast.success(courtSession ? 'Summons issued to current session' : 'Court session opened and case docketed')
        }
      }

      setIsCreateModalOpen(false)
      if (activeSessionId) navigate(`/court/${activeSessionId}`)
    } catch (startError: any) {
      toast.error(`Error: ${startError?.message || 'Failed to action'}`)
    } finally {
      setIsStartingSession(false)
    }
  }

  const handleEndCourtSession = async () => {
    if (!courtSession?.id) {
      toast.error('No active court session ID found')
      return
    }

    if (!confirm('Are you sure you want to adjourn this court session?')) return

    try {
      const { error } = await supabase.rpc('end_court_session', {
        p_session_id: String(courtSession.id),
      })

      if (error) throw error

      setCourtSession(null)
      toast.success('Court session adjourned')
      navigate(`/court/${courtSession.id}/summary`)
      loadCourtState()
    } catch (err: any) {
      toast.error(`Failed to adjourn court session: ${err?.message || err}`)
    }
  }

  const handleDeleteCase = async (id: string) => {
    if (!confirm('Permanently delete this case docket? This cannot be undone.')) return

    const { data, error } = await supabase.rpc('hard_delete_court_case', {
      p_case_id: id,
    })

    if (error || (data && data.success === false)) toast.error(data?.error || 'Failed to delete case')
    else {
      toast.success('Case docket permanently deleted')
      setRecentCases((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const handleExtendCase = async (id: string) => {
    const daysStr = prompt('Enter number of days to continue this case:', '7')
    if (!daysStr) return

    const days = parseInt(daysStr, 10)
    if (Number.isNaN(days)) return toast.error('Invalid number')

    const date = new Date()
    date.setDate(date.getDate() + days)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    try {
      let { data: docket } = await supabase
        .from('court_dockets')
        .select('id')
        .eq('court_date', dateStr)
        .maybeSingle()

      if (!docket) {
        const { data: newDocket, error: docketErr } = await supabase
          .from('court_dockets')
          .insert({ court_date: dateStr, max_cases: 20 })
          .select('id')
          .single()

        if (docketErr) throw docketErr
        docket = newDocket
      }

      const { error } = await supabase
        .from('court_cases')
        .update({
          docket_id: docket.id,
          status: 'scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      toast.success(`Case continued to ${dateStr}`)
      fetchDockets()
    } catch (err: any) {
      toast.error(err.message || 'Failed to continue case')
    }
  }

  const handleEditCase = async (c: any) => {
    const newTitle = prompt('Edit Case Title:', c.title || '')
    const newDesc = prompt('Edit Statement / Description:', c.description || '')

    if (newTitle === null && newDesc === null) return

    const updates: any = {}
    if (newTitle !== null) updates.title = newTitle
    if (newDesc !== null) updates.description = newDesc

    const { error } = await supabase.from('court_cases').update(updates).eq('id', c.id)

    if (error) toast.error('Failed to update case')
    else {
      toast.success('Case file updated')
      setRecentCases((prev) => prev.map((item) => (item.id === c.id ? { ...item, ...updates } : item)))
    }
  }

  return (
    <div className="relative min-h-screen p-4 text-white md:p-6 overflow-y-auto">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_34%),radial-gradient(circle_at_20%_20%,rgba(127,29,29,0.18),transparent_28%),linear-gradient(135deg,#090604,#11070b_42%,#050308)]" />
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(251,191,36,0.10),transparent)]" />
        <div className="absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-96 w-96 rounded-full bg-red-900/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-[#120b08]/90 p-6 shadow-[0_0_60px_rgba(245,158,11,0.14)] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <CourtBadge icon={<Landmark size={14} />} label="Official Mai Troll Courthouse" />
                <CourtBadge icon={<Scale size={14} />} label={courtSession ? 'Court In Session' : 'Open For Filing'} />
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden h-20 w-20 items-center justify-center rounded-[1.5rem] border border-amber-300/30 bg-amber-400/10 shadow-[0_0_30px_rgba(245,158,11,0.18)] md:flex">
                  <Scale className="h-10 w-10 text-amber-200" />
                </div>

                <div>
                  <h1 className="text-4xl font-black tracking-tight text-amber-50 md:text-6xl">
                    Troll Court
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/70 md:text-base">
                    Official hearings, civil lawsuits, summons, warrants, appeals, and public rulings for Mai Troll.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
              <CourtStat icon={<FileText size={16} />} label="Recent Cases" value={recentCases.length} />
              <CourtStat icon={<Calendar size={16} />} label="Dockets" value={allDockets.length} />
              <CourtStat icon={<AlertTriangle size={16} />} label="Summons" value={pendingSummons.length} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <CourtPanel title="Courtroom Status" icon={<Gavel className="h-5 w-5 text-amber-300" />}>
            {courtSession ? (
              <div className="space-y-4">
                <OfficialNotice
                  tone="green"
                  icon={<CheckCircle className="h-5 w-5" />}
                  title="Court is now in session"
                  text="An authorized court officer has opened proceedings. Official rulings and judgments may be issued."
                />
                <p className="text-xs text-amber-100/60">
                  Session opened: {new Date(courtSession.created_at || courtSession.startedAt).toLocaleString()}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <CourtActionButton icon={<Users size={17} />} label="Enter Courtroom" onClick={() => navigate(`/court/${courtSession.id}`)} />
                  <CourtActionButton icon={<Gavel size={17} />} label="File Civil Lawsuit" onClick={() => setIsFileLawsuitModalOpen(true)} tone="red" />
                  {profile?.has_active_warrant && (
                    <CourtActionButton icon={<ShieldAlert size={17} />} label="Pay Warrant" onClick={() => setShowPayWarrantModal(true)} tone="gold" />
                  )}
                  {canSummonUser && <CourtActionButton icon={<Stamp size={17} />} label="Issue Summons" onClick={openCreateModal} tone="gold" />}
                  {canSummonUser && <CourtActionButton icon={<X size={17} />} label="Adjourn Court" onClick={handleEndCourtSession} tone="danger" />}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingSummons.length > 0 && (
                  <OfficialNotice
                    tone="yellow"
                    icon={<AlertTriangle className="h-5 w-5" />}
                    title="You have a pending court summons"
                    text={pendingSummons[0]?.reason || 'You have been summoned to Troll Court.'}
                    footer={
                      pendingSummons[0]?.court_date
                        ? `Court Date: ${new Date(pendingSummons[0].court_date).toLocaleDateString()}`
                        : undefined
                    }
                  />
                )}

                <OfficialNotice
                  tone="neutral"
                  icon={<Landmark className="h-5 w-5" />}
                  title="Court is adjourned"
                  text="There is no active courtroom session. Troll Court is still accepting civil filings and public case review."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <CourtActionButton icon={<Gavel size={17} />} label="File Civil Lawsuit" onClick={() => setIsFileLawsuitModalOpen(true)} tone="red" />
                  {profile?.has_active_warrant && (
                    <CourtActionButton icon={<ShieldAlert size={17} />} label="Pay Warrant" onClick={() => setShowPayWarrantModal(true)} tone="gold" />
                  )}
                  {canStartCourt && courtSession && ['active', 'live'].includes(courtSession.status) && (
                    <CourtActionButton icon={<Eye size={17} />} label="Watch Live Court" onClick={() => navigate(`/troll-court/watch/${courtSession.id}`)} tone="green" />
                  )}
                  {canSummonUser && (
                    <CourtActionButton
                      icon={<Scale size={17} />}
                      label={isStartingSession ? 'Opening Court...' : 'Open Court Session'}
                      onClick={openCreateModal}
                      disabled={isStartingSession}
                      tone="gold"
                    />
                  )}
                </div>

                {!canSummonUser && (
                  <OfficialNotice
                    tone="red"
                    icon={<Shield className="h-5 w-5" />}
                    title="Court authority required"
                    text="Only authorized Troll Officers, lead officers, secretaries, and administrators may open official court proceedings."
                  />
                )}
              </div>
            )}
          </CourtPanel>

          <CourtPanel title="Court Authority" icon={<Shield className="h-5 w-5 text-amber-300" />}>
            <div className="space-y-3">
              <AuthorityRow title="Chief Justice" badge="Admin" />
              <AuthorityRow title="Senior Judges" badge="Lead Officers" />
              <AuthorityRow title="Court Officers" badge="Troll Officers" />
              <AuthorityRow title="Court Clerk" badge="Secretary / System" />
            </div>
          </CourtPanel>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <CourtPanel title="Rules of Procedure" icon={<Scale className="h-5 w-5 text-amber-300" />}>
            <div className="space-y-3 text-sm text-amber-100/70">
              {[
                'All rulings must be issued by authorized Troll Court officials.',
                'Evidence must be presented before any judgment is made.',
                'Appeals may be filed within 24 hours of ruling.',
                'All court sessions are recorded for transparency.',
              ].map((rule) => (
                <div key={rule} className="flex gap-3 rounded-2xl border border-amber-300/10 bg-black/20 p-3">
                  <Scale className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p>{rule}</p>
                </div>
              ))}
            </div>
          </CourtPanel>

          <CourtPanel title="Court Docket Calendar" icon={<Calendar className="h-5 w-5 text-amber-300" />}>
            <CalendarBlock
              calendarMonth={calendarMonth}
              calendarYear={calendarYear}
              allDockets={allDockets}
              selectedCalendarDate={selectedCalendarDate}
              setCalendarMonth={setCalendarMonth}
              setCalendarYear={setCalendarYear}
              setSelectedCalendarDate={setSelectedCalendarDate}
              setShowCaseDetailsModal={setShowCaseDetailsModal}
            />
          </CourtPanel>
        </section>

        {assignedCases.length > 0 && (
          <CourtPanel title="Judge’s Bench — Assigned Cases" icon={<Gavel className="h-5 w-5 text-red-300" />}>
            <div className="space-y-3">
              {assignedCases.map((c) => (
                <CaseFileCard
                  key={c.id}
                  caseData={c}
                  badge="ACTION REQUIRED"
                  tone="purple"
                  primaryActionLabel="Open Case File"
                  onPrimaryAction={() => setSelectedCaseForRuling(c)}
                />
              ))}
            </div>
          </CourtPanel>
        )}

        {myCivilCases.length > 0 && (
          <CourtPanel title="My Civil Lawsuits" icon={<FileText className="h-5 w-5 text-red-300" />}>
            <div className="space-y-3">
              {myCivilCases.map((c) => (
                <CaseFileCard
                  key={c.id}
                  caseData={c}
                  badge={String(c.status || 'pending').toUpperCase()}
                  tone={c.status === 'ruled' ? 'green' : c.status === 'dismissed' ? 'neutral' : 'yellow'}
                  subtitle={`Claim: ${c.claim_amount || 0} coins`}
                  footer={
                    c.ruling_verdict
                      ? `Verdict: ${c.ruling_verdict}${c.judgment_amount > 0 ? ` — Award: ${c.judgment_amount}` : ''}`
                      : undefined
                  }
                />
              ))}
            </div>
          </CourtPanel>
        )}

        <CourtPanel title="Public Case Docket" icon={<Gavel className="h-5 w-5 text-amber-300" />}>
          <div className="space-y-3">
            {recentCases.length > 0 ? (
              recentCases.map((c) => (
                <CaseFileCard
                  key={c.id}
                  caseData={c}
                  badge={
                    c.status === 'in_session'
                      ? 'IN SESSION'
                      : c.status === 'resolved'
                        ? 'RESOLVED'
                        : 'PENDING'
                  }
                  tone={
                    c.status === 'resolved'
                      ? 'green'
                      : c.status === 'in_session'
                        ? 'purple'
                        : 'yellow'
                  }
                  footer={c.scheduled_for ? `Scheduled: ${new Date(c.scheduled_for).toLocaleDateString()}` : undefined}
                  adminControls={
                    canAddCase ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-amber-300/10 pt-3">
                        <SmallCourtButton label="Edit" onClick={() => handleEditCase(c)} />
                        <SmallCourtButton label="Continue Date" onClick={() => handleExtendCase(c.id)} tone="yellow" />
                        <SmallCourtButton label="Delete" onClick={() => handleDeleteCase(c.id)} tone="red" />
                      </div>
                    ) : null
                  }
                />
              ))
            ) : (
              <div className="rounded-2xl border border-amber-300/10 bg-black/20 p-6 text-center text-amber-100/50">
                No recent cases found.
              </div>
            )}
          </div>
        </CourtPanel>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[#120b08] shadow-[0_0_80px_rgba(245,158,11,0.18)]">
            <div className="border-b border-amber-300/15 bg-gradient-to-r from-amber-950/60 to-red-950/30 p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xl font-black text-amber-50">
                  <Gavel className="h-5 w-5 text-amber-300" />
                  Open Court Session
                </h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-amber-100/60 hover:text-white">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-100/60">
                Filing official court records may create summons, case dockets, and court session history.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-amber-100/70">Case Reason <span className="text-amber-100/40">(optional)</span></label>
                <select
                  value={selectedCaseType}
                  onChange={(e) => setSelectedCaseType(e.target.value)}
                  className="w-full rounded-xl border border-amber-300/15 bg-black/35 px-4 py-3 text-white outline-none focus:border-amber-300/50"
                >
                  <option value="">-- No Case Reason (Open Court) --</option>
                  {CASE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-amber-100/70">Defendant <span className="text-amber-100/40">(optional)</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-5 w-5 text-amber-100/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowDropdown(true)
                      if (selectedUser) setSelectedUser(null)
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    placeholder="Search username..."
                    className="w-full rounded-xl border border-amber-300/15 bg-black/35 py-3 pl-10 pr-4 text-white outline-none focus:border-amber-300/50"
                  />

{showDropdown && (
                     <UserSearchInput
                       query={searchQuery}
                       onSelect={(userId, username) => {
                         setSelectedUser({ id: userId, username })
                         setSearchQuery(username)
                         setShowDropdown(false)
                       }}
                       disableNavigation
                     />
                   )}
                </div>
              </div>

              {selectedUser && (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm">
                  Selected Defendant: <span className="font-black text-amber-100">{selectedUser.username}</span>
                </div>
              )}

              <p className="text-xs text-amber-100/50">
                You can open court without choosing a defendant. Add defendants later from the Docket so the
                judge can issue rulings even when there is no pre-existing case.
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 font-bold text-amber-100/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSummonOrStart}
                  disabled={isStartingSession}
                  className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-red-700 py-3 font-black text-white shadow-[0_0_30px_rgba(245,158,11,0.16)] disabled:opacity-50"
                >
                  {isStartingSession
                    ? 'Processing...'
                    : selectedUser
                      ? courtSession
                        ? 'Issue Summons'
                        : 'Open Court & Summon'
                      : courtSession
                        ? 'Add Defendant'
                        : 'Open Court Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FileLawsuitModal
        isOpen={isFileLawsuitModalOpen}
        onClose={() => setIsFileLawsuitModalOpen(false)}
        onSuccess={() => {}}
      />

      <PayWarrantModal
        isOpen={showPayWarrantModal}
        onClose={() => setShowPayWarrantModal(false)}
      />

      <JudgeRulingModal
        isOpen={!!selectedCaseForRuling}
        caseData={selectedCaseForRuling}
        onClose={() => setSelectedCaseForRuling(null)}
        onSuccess={() => setSelectedCaseForRuling(null)}
      />

      {showCaseDetailsModal && (
        <CaseDetailsModal
          selectedCalendarDate={selectedCalendarDate}
          selectedDateCases={selectedDateCases}
          canStartCourt={canStartCourt}
          onClose={() => setShowCaseDetailsModal(false)}
          onOpenCase={(c) => {
            setSelectedCaseForRuling(c)
            setShowCaseDetailsModal(false)
          }}
        />
      )}
    </div>
  )
}

function CourtBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-100">
      {icon}
      {label}
    </span>
  )
}

function CourtStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-amber-300/15 bg-black/25 p-4">
      <div className="mb-2 flex items-center gap-2 text-amber-200">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wide text-amber-100/50">{label}</span>
      </div>
      <p className="text-2xl font-black text-amber-50">{value}</p>
    </div>
  )
}

function CourtPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-[1.7rem] border border-amber-300/15 bg-[#120b08]/88 p-5 shadow-[0_0_35px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent)]" />
      <div className="relative">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-amber-50">
          {icon}
          {title}
        </h2>
        {children}
      </div>
    </section>
  )
}

function OfficialNotice({
  tone,
  icon,
  title,
  text,
  footer,
}: {
  tone: 'green' | 'yellow' | 'red' | 'neutral'
  icon: React.ReactNode
  title: string
  text: string
  footer?: string
}) {
  const tones = {
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
    yellow: 'border-yellow-400/25 bg-yellow-500/10 text-yellow-200',
    red: 'border-red-400/25 bg-red-500/10 text-red-200',
    neutral: 'border-amber-300/15 bg-black/25 text-amber-100',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="mb-2 flex items-center gap-2 font-black">
        {icon}
        {title}
      </div>
      <p className="text-sm leading-6 opacity-80">{text}</p>
      {footer && <p className="mt-2 text-xs font-bold">{footer}</p>}
    </div>
  )
}

function CourtActionButton({
  icon,
  label,
  onClick,
  disabled,
  tone = 'purple',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'purple' | 'red' | 'gold' | 'green' | 'danger'
}) {
  const tones = {
    purple: 'from-purple-700 to-indigo-900 border-purple-300/20',
    red: 'from-red-800 to-red-950 border-red-300/20',
    gold: 'from-amber-500 to-red-800 border-amber-300/20',
    green: 'from-emerald-600 to-emerald-950 border-emerald-300/20',
    danger: 'from-red-950 to-black border-red-400/25',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-2xl border bg-gradient-to-br px-4 py-3 text-sm font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {icon}
      {label}
    </button>
  )
}

function AuthorityRow({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-amber-300/10 bg-black/25 p-3">
      <span className="text-sm text-amber-100/80">{title}</span>
      <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] font-black uppercase text-amber-200">
        {badge}
      </span>
    </div>
  )
}

function CaseFileCard({
  caseData,
  badge,
  tone,
  subtitle,
  footer,
  primaryActionLabel,
  onPrimaryAction,
  adminControls,
}: {
  caseData: any
  badge: string
  tone: 'green' | 'yellow' | 'purple' | 'neutral'
  subtitle?: string
  footer?: string
  primaryActionLabel?: string
  onPrimaryAction?: () => void
  adminControls?: React.ReactNode
}) {
  const tones = {
    green: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
    yellow: 'border-yellow-400/25 bg-yellow-500/10 text-yellow-200',
    purple: 'border-purple-400/25 bg-purple-500/10 text-purple-200',
    neutral: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/12 bg-black/25 p-4">
      <div className="absolute right-4 top-4 rotate-[-8deg] rounded border border-amber-300/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-100/25">
        FILED
      </div>
      <div className="relative">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-black text-amber-50">
            {caseData.title || caseData.category || `Case #${String(caseData.id).slice(0, 8)}`}
          </span>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${tones[tone]}`}>
            {badge}
          </span>
        </div>

        <p className="text-sm text-amber-100/60">
          Plaintiff: {caseData.plaintiff?.username || 'Unknown'} vs Defendant: {caseData.defendant?.username || 'Unknown'}
        </p>

        {subtitle && <p className="mt-1 text-xs text-amber-100/50">{subtitle}</p>}

        {(caseData.description || caseData.reason) && (
          <p className="mt-3 rounded-xl border border-amber-300/10 bg-black/25 p-3 text-sm italic text-amber-100/70">
            “{caseData.description || caseData.reason}”
          </p>
        )}

        {footer && <p className="mt-2 text-xs font-bold text-amber-200/70">{footer}</p>}

        {primaryActionLabel && onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            className="mt-3 rounded-xl bg-gradient-to-r from-amber-500 to-red-700 px-3 py-2 text-xs font-black text-white"
          >
            {primaryActionLabel}
          </button>
        )}

        {adminControls}
      </div>
    </div>
  )
}

function SmallCourtButton({
  label,
  onClick,
  tone = 'blue',
}: {
  label: string
  onClick: () => void
  tone?: 'blue' | 'yellow' | 'red'
}) {
  const tones = {
    blue: 'border-blue-400/20 bg-blue-500/10 text-blue-200',
    yellow: 'border-yellow-400/20 bg-yellow-500/10 text-yellow-200',
    red: 'border-red-400/20 bg-red-500/10 text-red-200',
  }

  return (
    <button onClick={onClick} className={`rounded-lg border px-3 py-1 text-xs font-bold ${tones[tone]}`}>
      {label}
    </button>
  )
}

function CalendarBlock({
  calendarMonth,
  calendarYear,
  allDockets,
  selectedCalendarDate,
  setCalendarMonth,
  setCalendarYear,
  setSelectedCalendarDate,
  setShowCaseDetailsModal,
}: any) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => {
            if (calendarMonth === 0) {
              setCalendarMonth(11)
              setCalendarYear(calendarYear - 1)
            } else {
              setCalendarMonth(calendarMonth - 1)
            }
          }}
          className="rounded-xl border border-amber-300/10 bg-black/25 p-2 hover:bg-amber-400/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <span className="font-black text-amber-50">
          {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </span>

        <button
          onClick={() => {
            if (calendarMonth === 11) {
              setCalendarMonth(0)
              setCalendarYear(calendarYear + 1)
            } else {
              setCalendarMonth(calendarMonth + 1)
            }
          }}
          className="rounded-xl border border-amber-300/10 bg-black/25 p-2 hover:bg-amber-400/10"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2 text-center text-xs font-black text-amber-100/45">
            {day}
          </div>
        ))}

        {(() => {
          const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
          const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
          const days = []

          const datesWithCases = allDockets
            .filter((d: any) => d.court_cases && d.court_cases.length > 0)
            .map((d: any) => {
              const dateStr = d.court_date
              if (typeof dateStr === 'string' && dateStr.includes('-')) return dateStr
              return new Date(d.court_date).toISOString().split('T')[0]
            })

          for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2" />)
          }

          for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasCases = datesWithCases.includes(dateStr)
            const isToday =
              new Date().getDate() === day &&
              new Date().getMonth() === calendarMonth &&
              new Date().getFullYear() === calendarYear
            const isSelected = selectedCalendarDate === dateStr

            days.push(
              <button
                key={day}
                onClick={() => {
                  setSelectedCalendarDate(dateStr)
                  setShowCaseDetailsModal(true)
                }}
                className={`relative rounded-xl p-2 text-sm font-bold transition ${
                  hasCases
                    ? 'border border-amber-300/30 bg-amber-400/15 text-amber-100'
                    : 'text-amber-100/55 hover:bg-white/5'
                } ${isToday ? 'ring-2 ring-red-400' : ''} ${isSelected ? 'ring-2 ring-white' : ''}`}
              >
                {day}
                {hasCases && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-amber-300" />}
              </button>
            )
          }

          return days
        })()}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-amber-100/50">
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-400" />
          Dates with cases
        </div>
        <div className="flex items-center gap-1">
          <span className="h-3 w-3 rounded ring-2 ring-red-400" />
          Today
        </div>
      </div>
    </>
  )
}

function CaseDetailsModal({ selectedCalendarDate, selectedDateCases, canStartCourt, onClose, onOpenCase }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[#120b08] shadow-[0_0_80px_rgba(245,158,11,0.18)]">
        <div className="flex items-center justify-between border-b border-amber-300/15 bg-gradient-to-r from-amber-950/60 to-red-950/30 p-4">
          <div className="flex items-center gap-2 text-lg font-black text-amber-100">
            <Calendar className="h-5 w-5" />
            Cases for{' '}
            {selectedCalendarDate
              ? (() => {
                  const [y, m, d] = selectedCalendarDate.split('-').map(Number)
                  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })
                })()
              : 'Selected Date'}
          </div>
          <button onClick={onClose} className="text-amber-100/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {selectedDateCases.length > 0 ? (
            <div className="space-y-4">
              {selectedDateCases.map((c: any) => (
                <CaseFileCard
                  key={c.id}
                  caseData={c}
                  badge={c.status === 'resolved' ? 'RESOLVED' : c.status === 'in_session' ? 'IN SESSION' : 'PENDING'}
                  tone={c.status === 'resolved' ? 'green' : c.status === 'in_session' ? 'purple' : 'yellow'}
                  primaryActionLabel={canStartCourt ? 'View Full Case File' : undefined}
                  onPrimaryAction={canStartCourt ? () => onOpenCase(c) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-amber-100/50">
              <Calendar className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>No cases found for this date.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}