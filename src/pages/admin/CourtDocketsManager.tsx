import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, FileText, Gavel, Plus, Scale, Search, ShieldAlert, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner'
import { useAuthStore } from '../../lib/store'
import UserNameWithAge from '../../components/UserNameWithAge'

const panel =
  'rounded-[2rem] border border-amber-300/20 bg-[#14100a]/90 shadow-[0_0_35px_rgba(245,158,11,0.10)] backdrop-blur-xl'
const card =
  'rounded-2xl border border-amber-300/15 bg-[#1c160d]/85 shadow-[0_0_22px_rgba(245,158,11,0.07)]'
const input =
  'w-full rounded-xl border border-amber-300/20 bg-[#090705]/70 p-3 text-amber-50 placeholder:text-amber-100/30 outline-none focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/15'
const goldBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300 px-4 py-2 text-sm font-black text-[#120d05] shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:bg-amber-200 disabled:opacity-50'
const darkBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-[#2a1d0c]/80 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-[#3a270f]'

export default function CourtDocketsManager() {
  const { user, profile } = useAuthStore()
  const [dockets, setDockets] = useState<any[]>([])
  const [selectedDocket, setSelectedDocket] = useState<any>(null)
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [warrants, setWarrants] = useState<any[]>([])

  const [showCreateDocket, setShowCreateDocket] = useState(false)
  const [showAddCase, setShowAddCase] = useState(false)
  const [newDocketDate, setNewDocketDate] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedDefendant, setSelectedDefendant] = useState<any>(null)
  const [caseReason, setCaseReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canManageDockets = Boolean(
    profile &&
      (profile.is_admin ||
        ['admin', 'owner', 'troll_officer', 'lead_troll_officer', 'secretary'].includes(String(profile.role)) ||
        profile.is_troll_officer ||
        profile.is_lead_officer)
  )

  const openDocketCount = useMemo(
    () => dockets.filter((docket) => docket.status === 'open').length,
    [dockets]
  )

  useEffect(() => {
    void loadDockets()
    void loadActiveWarrants()
  }, [])

  useEffect(() => {
    if (selectedDocket) void loadCases(selectedDocket.id)
  }, [selectedDocket])

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .limit(5)

      setSearchResults(data || [])
    }

    const timeout = window.setTimeout(searchUsers, 300)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  const loadDockets = async () => {
    const { data } = await supabase
      .from('court_dockets')
      .select('*')
      .order('court_date', { ascending: false })

    setDockets(data || [])
  }

  const loadCases = async (docketId: string) => {
    setLoading(true)

    const { data } = await supabase
      .from('court_cases')
      .select(`
        *,
        defendant:defendant_id(id, username, avatar_url, created_at),
        plaintiff:plaintiff_id(id, username, created_at)
      `)
      .eq('docket_id', docketId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    setCases(data || [])
    setLoading(false)
  }

  const loadActiveWarrants = async () => {
    const { data } = await supabase
      .from('court_cases')
      .select(`
        *,
        defendant:defendant_id(id, username, avatar_url, created_at)
      `)
      .eq('warrant_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    setWarrants(data || [])
  }

  const handleCreateDocket = async () => {
    if (!canManageDockets) return toast.error('Only court staff can create dockets')
    if (!newDocketDate) return toast.error('Please select a date')

    try {
      const { data: existing } = await supabase
        .from('court_dockets')
        .select('*')
        .eq('court_date', newDocketDate)
        .maybeSingle()

      if (existing) {
        setSelectedDocket(existing)
        toast.success('Opened existing docket')
      } else {
        const { data, error } = await supabase
          .from('court_dockets')
          .insert({
            court_date: newDocketDate,
            status: 'open',
            created_by: user?.id,
          })
          .select()
          .single()

        if (error) throw error

        setDockets((prev) => [data, ...prev])
        setSelectedDocket(data)
        toast.success('New docket created')
      }

      setShowCreateDocket(false)
      setNewDocketDate('')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleAddCase = async () => {
    if (!canManageDockets) return toast.error('Only court staff can add cases')
    if (!selectedDefendant) return toast.error('Please select a defendant')
    if (!caseReason.trim()) return toast.error('Please enter a reason')
    if (!selectedDocket) return

    setIsSubmitting(true)

    try {
      const { error } = await supabase.rpc('manage_court_case_safe', {
        p_defendant_id: selectedDefendant.id,
        p_reason: caseReason,
        p_court_date: selectedDocket.court_date,
      })

      if (error) throw error

      toast.success('Case added and summons sent')
      await loadCases(selectedDocket.id)

      setShowAddCase(false)
      setSelectedDefendant(null)
      setCaseReason('')
      setSearchQuery('')
    } catch (error: any) {
      console.error('Error adding case:', error)
      toast.error(error.message || 'Failed to add case')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handleExtendCase = async (caseId: string) => {
    if (!canManageDockets) return toast.error('Only court staff can extend cases')

    const daysStr = window.prompt('Enter number of days to extend:', '7')
    if (!daysStr) return

    const days = Number.parseInt(daysStr, 10)
    if (!Number.isFinite(days) || days < 1) return toast.error('Invalid extension length')

    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + days)
    const newCourtDate = formatLocalDate(nextDate)

    try {
      const { data, error } = await supabase.rpc('extend_court_date', {
        p_case_id: caseId,
        p_new_date: newCourtDate,
      })

      if (error) throw error
      if (data && data.success === false) throw new Error(data.error || 'Failed to extend case')

      toast.success(`Case extended to ${nextDate.toLocaleDateString()}`)
      await loadDockets()
      if (selectedDocket?.id) await loadCases(selectedDocket.id)
    } catch (error: any) {
      toast.error(error.message || 'Failed to extend case')
    }
  }

  const handleHardDeleteCase = async (caseId: string) => {
    if (!canManageDockets) return toast.error('Only court staff can delete cases')
    if (!window.confirm('Permanently delete this court case? This cannot be undone.')) return

    try {
      const { data, error } = await supabase.rpc('hard_delete_court_case', {
        p_case_id: caseId,
      })

      if (error) throw error
      if (data && data.success === false) throw new Error(data.error || 'Failed to delete case')

      setCases((prev) => prev.filter((courtCase) => courtCase.id !== caseId))
      toast.success('Court case permanently deleted')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete case')
    }
  }

  return (
    <div className="relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[radial-gradient(circle_at_top,#f59e0b22,transparent_34%),linear-gradient(135deg,#080604,#15100a_45%,#241607)] px-4 pb-10 pt-24 text-amber-50 md:px-6">
      <div className="pointer-events-none fixed inset-0 opacity-15">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(245,158,11,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className={`${panel} p-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 shadow-[0_0_28px_rgba(245,158,11,0.18)]">
                <Scale className="h-8 w-8 text-amber-200" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300">
                  Court Administration
                </p>
                <h1 className="bg-gradient-to-r from-amber-200 via-stone-50 to-amber-400 bg-clip-text text-4xl font-black text-transparent">
                  Court Dockets
                </h1>
                <p className="mt-1 text-sm text-amber-100/60">
                  Manage dockets, summons, warrants, extensions, and court records.
                </p>
              </div>
            </div>

            {canManageDockets && (
              <button onClick={() => setShowCreateDocket(true)} className={goldBtn}>
                <Plus className="h-4 w-4" />
                New Docket
              </button>
            )}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="Total Dockets" value={dockets.length} />
          <Stat label="Open Dockets" value={openDocketCount} />
          <Stat label="Selected Cases" value={cases.length} />
          <Stat label="Active Warrants" value={warrants.length} danger />
        </section>

        {warrants.length > 0 && (
          <section className="rounded-[2rem] border border-red-300/25 bg-red-950/25 p-5 shadow-[0_0_35px_rgba(239,68,68,0.12)]">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-red-100">
              <ShieldAlert className="h-5 w-5" />
              Active Warrants
            </h2>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {warrants.map((warrant) => (
                <div key={warrant.id} className="rounded-2xl border border-red-300/20 bg-black/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">
                        <UserNameWithAge
                          user={{
                            username: warrant.defendant?.username || 'Unknown',
                            created_at: warrant.defendant?.created_at,
                            id: warrant.defendant?.id,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-red-200/80">{warrant.reason}</p>
                      <p className="mt-2 text-xs text-red-100/40">
                        Issued: {new Date(warrant.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <span className="rounded-full border border-red-300/25 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100">
                      Warrant
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className={`${panel} flex h-[650px] flex-col p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-black text-amber-50">
                <Calendar className="h-5 w-5 text-amber-300" />
                Dockets
              </h2>

              {canManageDockets && (
                <button onClick={() => setShowCreateDocket(true)} className={darkBtn} title="New Docket">
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {dockets.length === 0 ? (
                <EmptyState title="No dockets found" />
              ) : (
                dockets.map((docket) => (
                  <button
                    key={docket.id}
                    onClick={() => setSelectedDocket(docket)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedDocket?.id === docket.id
                        ? 'border-amber-300/45 bg-amber-300 text-[#120d05] shadow-[0_0_24px_rgba(245,158,11,0.18)]'
                        : 'border-amber-300/15 bg-black/25 text-amber-50 hover:border-amber-300/35 hover:bg-[#2a1d0c]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black">{new Date(docket.court_date).toLocaleDateString()}</span>
                      <Status status={docket.status} active={selectedDocket?.id === docket.id} />
                    </div>
                    <p className={`mt-1 text-xs ${selectedDocket?.id === docket.id ? 'text-black/60' : 'text-amber-100/45'}`}>
                      Max Cases: {docket.max_cases || 'N/A'}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className={`${panel} flex h-[650px] flex-col p-5`}>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-amber-50">
                  <Gavel className="h-5 w-5 text-amber-300" />
                  Docket Cases
                </h2>
                <p className="text-sm text-amber-100/50">
                  {selectedDocket
                    ? new Date(selectedDocket.court_date).toLocaleDateString()
                    : 'Select a docket to view cases'}
                </p>
              </div>

              {selectedDocket && canManageDockets && (
                <button onClick={() => setShowAddCase(true)} className={goldBtn}>
                  <Plus className="h-4 w-4" />
                  Add Case
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {!selectedDocket ? (
                <EmptyState title="Select a docket to view cases" icon={<FileText className="h-10 w-10" />} />
              ) : loading ? (
                <EmptyState title="Loading cases..." />
              ) : cases.length === 0 ? (
                <EmptyState title="No cases in this docket" icon={<Gavel className="h-10 w-10" />} />
              ) : (
                <div className="space-y-3">
                  {cases.map((courtCase) => (
                    <CaseCard
                      key={courtCase.id}
                      courtCase={courtCase}
                      canManage={canManageDockets}
                      onExtend={() => handleExtendCase(courtCase.id)}
                      onDelete={() => handleHardDeleteCase(courtCase.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </main>

      {showCreateDocket && (
        <Modal title="Create New Docket" onClose={() => setShowCreateDocket(false)}>
          <Field label="Court Date">
            <input
              type="date"
              value={newDocketDate}
              onChange={(event) => setNewDocketDate(event.target.value)}
              className={input}
            />
          </Field>

          <button onClick={handleCreateDocket} className={`${goldBtn} mt-4 w-full`}>
            Create Docket
          </button>
        </Modal>
      )}

      {showAddCase && (
        <Modal title="Summon User to Court" onClose={() => setShowAddCase(false)}>
          <Field label="Defendant">
            {selectedDefendant ? (
              <div className="flex items-center justify-between rounded-xl border border-amber-300/30 bg-amber-300/10 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      selectedDefendant.avatar_url ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedDefendant.username}`
                    }
                    alt=""
                    className="h-9 w-9 rounded-full bg-[#090705]"
                  />
                  <span className="font-black text-amber-50">{selectedDefendant.username}</span>
                </div>
                <button onClick={() => setSelectedDefendant(null)} className="text-amber-100/60 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-amber-100/35" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search username..."
                  className={`${input} pl-10`}
                />

                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-[100000] mt-2 max-h-56 overflow-y-auto rounded-xl border border-amber-300/20 bg-[#14100a] shadow-2xl">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => {
                          setSelectedDefendant(result)
                          setSearchQuery('')
                          setSearchResults([])
                        }}
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-amber-300/10"
                      >
                        <img
                          src={
                            result.avatar_url ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.username}`
                          }
                          alt=""
                          className="h-9 w-9 rounded-full bg-[#090705]"
                        />
                        <span className="font-bold text-amber-50">{result.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          <Field label="Reason for Summons">
            <textarea
              value={caseReason}
              onChange={(event) => setCaseReason(event.target.value)}
              placeholder="Explain why this user is being summoned..."
              className={`${input} h-32 resize-none`}
            />
          </Field>

          <button onClick={handleAddCase} disabled={isSubmitting} className={`${goldBtn} mt-4 w-full`}>
            {isSubmitting ? 'Summoning...' : 'Summon User'}
          </button>
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className={`${danger ? 'border-red-300/20 bg-red-950/20' : 'border-amber-300/15 bg-[#1c160d]/85'} rounded-2xl border p-5 text-center`}>
      <p className={danger ? 'text-3xl font-black text-red-100' : 'text-3xl font-black text-amber-200'}>
        {value}
      </p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-amber-100/45">{label}</p>
    </div>
  )
}

function Status({ status, active }: { status: string; active?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
        active
          ? 'border-black/20 bg-black/10 text-black'
          : status === 'open'
            ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
            : status === 'full'
              ? 'border-orange-300/25 bg-orange-400/10 text-orange-100'
              : 'border-stone-300/20 bg-stone-400/10 text-stone-200'
      }`}
    >
      {status || 'unknown'}
    </span>
  )
}

function CaseCard({
  courtCase,
  canManage,
  onExtend,
  onDelete,
}: {
  courtCase: any
  canManage: boolean
  onExtend: () => void
  onDelete: () => void
}) {
  return (
    <article className={`${card} p-4`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <img
            src={
              courtCase.defendant?.avatar_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${courtCase.defendant?.username}`
            }
            alt=""
            className="h-11 w-11 rounded-full border border-amber-300/20 bg-[#090705]"
          />

          <div>
            <div className="font-black text-white">
              <UserNameWithAge
                user={{
                  username: courtCase.defendant?.username,
                  created_at: courtCase.defendant?.created_at,
                  id: courtCase.defendant?.id,
                }}
              />
            </div>
            <div className="text-xs text-amber-100/45">
              Summoned by{' '}
              <UserNameWithAge
                user={{
                  username: courtCase.plaintiff?.username,
                  created_at: courtCase.plaintiff?.created_at,
                  id: courtCase.plaintiff?.id,
                }}
              />
            </div>
          </div>
        </div>

        <Status status={courtCase.status?.replace('_', ' ') || 'pending'} />
      </div>

      <div className="mt-4 rounded-xl border border-amber-300/10 bg-black/25 p-3 text-sm text-amber-50/80">
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300/65">
          Reason
        </p>
        {courtCase.reason}
      </div>

      {courtCase.users_involved && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-100/45">
          <Users className="h-3.5 w-3.5" />
          Involved: {courtCase.users_involved}
        </div>
      )}

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-300/10 pt-3">
          <button onClick={onExtend} className={darkBtn}>
            <Calendar className="h-3.5 w-3.5" />
            Extend
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </article>
  )
}

function EmptyState({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center text-center">
      <div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/15 bg-amber-300/10 text-amber-200">
          {icon || <Scale className="h-10 w-10" />}
        </div>
        <p className="font-black text-amber-50">{title}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-black text-amber-200">{label}</span>
      {children}
    </label>
  )
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className={`${panel} w-full max-w-md p-6`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-black text-amber-50">{title}</h3>
          <button onClick={onClose} className="rounded-xl border border-amber-300/15 bg-black/25 p-2 text-amber-100/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}