import { useCallback, useEffect, useState } from 'react'
import {
  BadgeCheck,
  Check,
  Gavel,
  Mic2,
  Plus,
  ShieldOff,
  UserX,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { useSingOffActions } from '../hooks/useSingOffActions'
import type { ActiveRolesList, SingOffRoleApplication } from '../types'

interface Props {
  staffView?: boolean
}

export function RolesLobby({ staffView = false }: Props) {
  const { user, profile } = useAuthStore()
  const actions = useSingOffActions()

  const isStaff = !!profile && (profile.is_ceo || profile.is_admin || profile.role === 'ceo' || profile.role === 'admin')

  const [apps, setApps] = useState<SingOffRoleApplication[]>([])
  const [mine, setMine] = useState<SingOffRoleApplication[]>([])
  const [activeRoles, setActiveRoles] = useState<ActiveRolesList>({ judges: [], hosts: [] })
  const [loading, setLoading] = useState(true)
  const [activeRoleTab, setActiveRoleTab] = useState<'applications' | 'active'>('applications')
  const [activeType, setActiveType] = useState<'judge' | 'host'>('judge')

  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<'judge' | 'host'>('judge')
  const [statement, setStatement] = useState('')
  const [experience, setExperience] = useState('')
  const [broadcastExp, setBroadcastExp] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [allApps, active] = await Promise.all([
      actions.listRoleApplications(),
      isStaff ? actions.listActiveRoles() : Promise.resolve({ judges: [], hosts: [] }),
    ])
    const myList = allApps.filter((a) => a.user_id === user?.id)
    setMine(myList)
    setApps(allApps)
    setActiveRoles(active)
    setLoading(false)
  }, [actions, isStaff, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const handleApply = async () => {
    if (!user?.id) return
    setSubmitting(true)
    const res = await actions.applyRole(formType, statement, experience, broadcastExp, agree)
    setSubmitting(false)
    if (res.success) {
      toast.success(`${formType === 'judge' ? 'Judge' : 'Host'} application submitted!`)
      setFormOpen(false)
      setStatement('')
      setExperience('')
      setBroadcastExp('')
      setAgree(false)
      void load()
    } else {
      toast.error(res.error || 'Could not submit application.')
    }
  }

  const handleReview = async (id: string, action: 'approve' | 'reject' | 'suspend') => {
    const res = await actions.reviewApplication(id, action)
    if (res.success) {
      toast.success(`Application ${action}d`)
      void load()
    } else {
      toast.error(res.error || 'Could not update application.')
    }
  }

  const handleRelease = async (targetUserId: string, role: 'judge' | 'host') => {
    if (!window.confirm(`Release this ${role}? Their stage access will be revoked immediately.`)) return
    const res = await actions.releaseRole(targetUserId, role)
    if (res.success) {
      void load()
    } else {
      toast.error(res.error || 'Could not release role.')
    }
  }

  const statusPill = (status: string) => {
    switch (status) {
      case 'approved':
        return 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400'
      case 'pending':
        return 'rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-amber-400'
      case 'rejected':
        return 'rounded-full bg-red-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-red-400'
      default:
        return 'rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-purple-400'
    }
  }

  const displayedApps = isStaff ? apps : mine

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-r from-purple-950/50 via-black to-fuchsia-950/30 p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(192,132,252,.4), transparent 35%), radial-gradient(circle at 80% 40%, rgba(236,72,153,.35), transparent 35%)',
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15">
              <Gavel className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black">
                JUDGES <span className="text-purple-400">AND</span> HOSTS
              </h2>
              <p className="text-sm text-white/50">Apply for a role, or manage the panel from the control center.</p>
            </div>
          </div>

          {!isStaff && (
            <button
              type="button"
              onClick={() => {
                setFormType('judge')
                setFormOpen(true)
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-purple-600/30 transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Apply for a Role
            </button>
          )}
        </div>
      </div>

      {/* Staff role switcher */}
      {isStaff && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveRoleTab('applications')}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeRoleTab === 'applications'
                ? 'bg-purple-600 text-white'
                : 'border border-white/10 text-white/50 hover:bg-white/5'
            }`}
          >
            Applications ({apps.filter((a) => a.status === 'pending').length} pending)
          </button>
          <button
            type="button"
            onClick={() => setActiveRoleTab('active')}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeRoleTab === 'active'
                ? 'bg-emerald-600 text-white'
                : 'border border-white/10 text-white/50 hover:bg-white/5'
            }`}
          >
            Active Roles ({activeRoles.judges.length + activeRoles.hosts.length})
          </button>
        </div>
      )}

      {/* My applications status */}
      {!isStaff && mine.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50">Your Applications</h3>
          {mine.map((app) => (
            <div key={app.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-white/70">
                {app.application_type === 'judge' ? <Gavel className="h-4 w-4 text-purple-400" /> : <Mic2 className="h-4 w-4 text-cyan-400" />}
                <span className="font-bold">{app.application_type === 'judge' ? 'Judge' : 'Host'}</span>
              </div>
              <span className={statusPill(app.status)}>{app.status}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Loading...</p>
      ) : activeRoleTab === 'applications' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['judge', 'host'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveType(t)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                  activeType === t ? 'bg-purple-600 text-white' : 'border border-white/10 text-white/50 hover:bg-white/5'
                }`}
              >
                {t} applications
              </button>
            ))}
          </div>

          {displayedApps.filter((a) => a.application_type === activeType).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/35">
              No {activeType} applications.
            </div>
          ) : (
            displayedApps
              .filter((a) => a.application_type === activeType)
              .map((app) => (
                <div key={app.id} className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {app.avatar_url ? (
                        <img src={app.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/60">
                          {(app.display_name || app.user_id)[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-black text-white">{app.display_name || `@${app.user_id.slice(0, 8)}`}</div>
                        <div className="text-[10px] text-white/40">
                          {app.application_type} application · {new Date(app.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className={statusPill(app.status)}>{app.status}</span>
                  </div>

                  {app.statement && <p className="mt-3 text-xs leading-5 text-white/60">{app.statement}</p>}
                  {app.experience && (
                    <p className="mt-1 text-[10px] text-white/40">
                      <span className="font-bold text-white/50">Experience:</span> {app.experience}
                    </p>
                  )}
                  {app.broadcasting_experience && (
                    <p className="mt-1 text-[10px] text-white/40">
                      <span className="font-bold text-white/50">Broadcasting:</span> {app.broadcasting_experience}
                    </p>
                  )}

                  {isStaff && app.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReview(app.id, 'approve')}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500"
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReview(app.id, 'reject')}
                        className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-red-500"
                      >
                        <X className="h-3 w-3" />
                        Reject
                      </button>
                    </div>
                  )}

                  {isStaff && app.status === 'approved' && (
                    <button
                      type="button"
                      onClick={() => handleReview(app.id, 'suspend')}
                      className="mt-3 flex items-center gap-1 rounded-lg bg-purple-700 px-3 py-1.5 text-[10px] font-black text-white hover:bg-purple-600"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      Suspend
                    </button>
                  )}
                </div>
              ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/50">
              <Gavel className="h-3.5 w-3.5 text-purple-400" /> Active Judges
            </h3>
            {activeRoles.judges.length === 0 ? (
              <p className="text-xs text-white/30">No active judges.</p>
            ) : (
              activeRoles.judges.map((j) => (
                <div key={j.user_id} className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2">
                    {j.avatar_url ? (
                      <img src={j.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-black">?</div>
                    )}
                    <div>
                      <div className="text-sm font-black text-white">{j.display_name || `@${j.user_id.slice(0, 8)}`}</div>
                      <div className="text-[10px] text-white/40">
                        {j.seat_index ? `Seat ${j.seat_index}` : 'Unassigned'} · active
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRelease(j.user_id, 'judge')}
                    className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/10"
                  >
                    <ShieldOff className="h-3 w-3" />
                    Release
                  </button>
                </div>
              ))
            )}
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/50">
              <Mic2 className="h-3.5 w-3.5 text-cyan-400" /> Active Hosts
            </h3>
            {activeRoles.hosts.length === 0 ? (
              <p className="text-xs text-white/30">No active hosts.</p>
            ) : (
              activeRoles.hosts.map((h) => (
                <div key={h.user_id} className="mb-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2">
                    {h.avatar_url ? (
                      <img src={h.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-black">?</div>
                    )}
                    <div>
                      <div className="text-sm font-black text-white">{h.display_name || `@${h.user_id.slice(0, 8)}`}</div>
                      <div className="text-[10px] text-white/40">
                        {h.session_id ? `Assigned to show · ${h.session_id.slice(0, 8)}` : 'Platform host'} · active
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRelease(h.user_id, 'host')}
                    className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[10px] font-black text-red-400 transition hover:bg-red-500/10"
                  >
                    <UserX className="h-3 w-3" />
                    Release
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-purple-400/20 bg-zinc-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {formType === 'judge' ? <Gavel className="h-5 w-5 text-purple-400" /> : <Mic2 className="h-5 w-5 text-cyan-400" />}
                <h3 className="text-lg font-black text-white">Apply to be a {formType === 'judge' ? 'Judge' : 'Host'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/50 hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormType('judge')}
                className={`flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-black transition ${
                  formType === 'judge' ? 'bg-purple-600 text-white' : 'border border-white/10 text-white/50 hover:bg-white/5'
                }`}
              >
                <Gavel className="h-3.5 w-3.5" /> Judge
              </button>
              <button
                type="button"
                onClick={() => setFormType('host')}
                className={`flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-black transition ${
                  formType === 'host' ? 'bg-cyan-600 text-white' : 'border border-white/10 text-white/50 hover:bg-white/5'
                }`}
              >
                <Mic2 className="h-3.5 w-3.5" /> Host
              </button>
            </div>

            <label className="mt-4 block text-xs font-bold text-white/60">Why do you want this role?</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-purple-400/40"
            />

            <label className="mt-3 block text-xs font-bold text-white/60">Experience</label>
            <textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="Talent, judging, hosting..."
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-purple-400/40"
            />

            <label className="mt-3 block text-xs font-bold text-white/60">Broadcasting Experience</label>
            <textarea
              value={broadcastExp}
              onChange={(e) => setBroadcastExp(e.target.value)}
              placeholder="Live streams, broadcasts..."
              rows={2}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-purple-400/40"
            />

            <label className="mt-3 flex items-center gap-2 text-xs text-white/50">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="accent-purple-500" />
              I agree to the {formType === 'judge' ? 'judge' : 'host'} code of conduct.
            </label>

            <button
              type="button"
              onClick={handleApply}
              disabled={submitting || !agree}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

