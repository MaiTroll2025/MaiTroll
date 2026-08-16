import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import { isProtectedPlatformRole } from '@/lib/protectedRoles'

export interface DefendantChip {
  userId: string
  username: string
  avatar_url?: string | null
}

export interface SummonsForm {
  defendantIds: string[]
  caseType: string
  reason: string
  summary: string
  evidenceReferences: string
  requestedAction: string
  courtDate?: string
}

export interface RTCAdminMonitorState {
  isOpen: boolean
  activeTab: string
  arrestSearchUsername: string
  arrestSearchResults: any[]
  arrestLoading: boolean
  arrestTabLoading: boolean
  arrestTabReason: string
  arrestTabSeverity: string
  summonsForm: SummonsForm
  defendantChips: DefendantChip[]
  defendantSearch: string
  defendantSearchResults: any[]
  defendantLoading: boolean
}

const DEFAULT_SUMMONS_FORM: SummonsForm = {
  defendantIds: [],
  caseType: 'criminal',
  reason: '',
  summary: '',
  evidenceReferences: '',
  requestedAction: 'summons',
  courtDate: '',
}

export function useRTCAdminMonitor() {
  const { profile } = useAuthStore()
  const [state, setState] = useState<RTCAdminMonitorState>({
    isOpen: false,
    activeTab: 'rtc',
    arrestSearchUsername: '',
    arrestSearchResults: [],
    arrestLoading: false,
    arrestTabLoading: false,
    arrestTabReason: '',
    arrestTabSeverity: 'moderate',
    summonsForm: { ...DEFAULT_SUMMONS_FORM },
    defendantChips: [],
    defendantSearch: '',
    defendantSearchResults: [],
    defendantLoading: false,
  })

  const isStaff = profile?.is_admin === true || ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'secretary', 'officer', 'ceo', 'superadmin'].includes(profile?.role || '')

  const setActiveTab = useCallback((tab: string) => {
    setState((prev) => ({ ...prev, activeTab: tab }))
  }, [])

  const setIsOpen = useCallback((open: boolean) => {
    setState((prev) => ({ ...prev, isOpen: open }))
  }, [])

  const setArrestField = useCallback(<K extends keyof Pick<RTCAdminMonitorState, 'arrestSearchUsername' | 'arrestTabReason' | 'arrestTabSeverity'>>(field: K, value: RTCAdminMonitorState[K]) => {
    setState((prev) => ({ ...prev, [field]: value }))
  }, [])

  const setSummonsField = useCallback(<K extends keyof SummonsForm>(field: K, value: SummonsForm[K]) => {
    setState((prev) => ({
      ...prev,
      summonsForm: { ...prev.summonsForm, [field]: value },
    }))
  }, [])

  const addDefendant = useCallback((user: { id: string; username: string; avatar_url?: string | null }) => {
    setState((prev) => {
      if (prev.defendantChips.some((c) => c.userId === user.id)) return prev
      return {
        ...prev,
        defendantChips: [...prev.defendantChips, { userId: user.id, username: user.username, avatar_url: user.avatar_url }],
        defendantSearch: '',
        defendantSearchResults: [],
      }
    })
  }, [])

  const removeDefendant = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      defendantChips: prev.defendantChips.filter((c) => c.userId !== userId),
    }))
  }, [])

  const searchDefendants = useCallback(async (query: string) => {
    if (!query.trim()) {
      setState((prev) => ({ ...prev, defendantSearchResults: [], defendantLoading: false }))
      return
    }
    setState((prev) => ({ ...prev, defendantLoading: true, defendantSearch: query }))
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, is_admin')
        .ilike('username', `%${query}%`)
        .limit(10)
      if (error) throw error
      setState((prev) => ({ ...prev, defendantSearchResults: (data || []) }))
    } catch (err) {
      console.warn('[RTCAdminMonitor] defendant search error:', err)
    } finally {
      setState((prev) => ({ ...prev, defendantLoading: false }))
    }
  }, [])

  const submitSummons = useCallback(async () => {
    const { summonsForm, defendantChips } = state
    if (!profile?.id) {
      toast.error('Missing auth')
      return
    }
    if (defendantChips.length === 0) {
      toast.error('Add at least one defendant')
      return
    }
    if (!summonsForm.reason.trim()) {
      toast.error('Enter a reason')
      return
    }
    setState((prev) => ({ ...prev, arrestTabLoading: true }))
    try {
      const courtDate = summonsForm.courtDate || (() => {
        const today = new Date()
        const dow = today.getDay()
        let next: Date
        if (dow === 0 || dow === 1) next = new Date(today.setDate(today.getDate() + (2 - dow)))
        else if (dow === 2 || dow === 3) next = new Date(today.setDate(today.getDate() + (4 - dow)))
        else if (dow === 4) next = today
        else next = new Date(today.setDate(today.getDate() + (2 + 7 - dow) % 7))
        return next.toISOString().split('T')[0]
      })()

      const { data: docket, error: docketError } = await supabase
        .from('court_dockets')
        .select('id, cases_count')
        .eq('court_date', courtDate)
        .maybeSingle()
      if (docketError) throw docketError

      let docketId: string
      if (docket && docket.cases_count < 20) {
        docketId = docket.id
        await supabase.from('court_dockets').update({ cases_count: (docket.cases_count || 0) + 1 }).eq('id', docketId)
      } else {
        const { data: newDocket, error: insertError } = await supabase
          .from('court_dockets')
          .insert({ court_date: courtDate, max_cases: 20, cases_count: defendantChips.length, status: 'open' })
          .select()
          .single()
        if (insertError) throw insertError
        docketId = newDocket!.id
      }

      const caseInserts = defendantChips.map((def) =>
        supabase.from('court_cases').insert({
          docket_id: docketId,
          plaintiff_id: profile.id,
          defendant_id: def.userId,
          reason: summonsForm.reason,
          status: 'pending',
          case_type: summonsForm.caseType,
        })
      )
      const results = await Promise.all(caseInserts)
      const caseErrors = results.filter((r) => r.error)
      if (caseErrors.length > 0) throw caseErrors[0].error

      const caseIds = results.map((r) => r.data?.[0]?.id).filter(Boolean)

      const summonsInserts = caseIds.map((caseId) =>
        supabase.from('court_summons').insert({
          case_id: caseId,
          served_to: defendantChips[caseIds.indexOf(caseId)]?.userId || defendantChips[0].userId,
          served_by: profile.id,
          status: 'pending',
          notes: JSON.stringify({
            summary: summonsForm.summary,
            evidence: summonsForm.evidenceReferences,
            requestedAction: summonsForm.requestedAction,
          }),
        })
      )
      const summonsResults = await Promise.all(summonsInserts)

      for (const defendant of defendantChips) {
        await supabase.from('moderation_actions').insert({
          actor_id: profile.id,
          officer_id: profile.id,
          target_user_id: defendant.userId,
          action: 'court_summons',
          action_type: 'court_summons',
          reason: summonsForm.reason,
          details: `court_date:${courtDate}; case_type:${summonsForm.caseType}; requested:${summonsForm.requestedAction}`,
          status: 'active',
        }).then(() => undefined, () => undefined)
      }

      toast.success(`Court summons filed for ${defendantChips.length} defendant(s)`)
      setState((prev) => ({
        ...prev,
        summonsForm: { ...DEFAULT_SUMMONS_FORM },
        defendantChips: [],
        defendantSearch: '',
        defendantSearchResults: [],
        arrestTabLoading: false,
      }))
    } catch (err: any) {
      console.error('[RTCAdminMonitor] submitSummons error:', err)
      toast.error(err?.message || 'Failed to submit summons')
      setState((prev) => ({ ...prev, arrestTabLoading: false }))
    }
  }, [state, profile?.id])

  return {
    isStaff,
    state,
    setActiveTab,
    setIsOpen,
    setArrestField,
    setSummonsField,
    addDefendant,
    removeDefendant,
    searchDefendants,
    submitSummons,
  }
}
