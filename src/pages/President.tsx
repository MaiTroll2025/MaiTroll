import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  ChevronRight,
  Crown,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
  Zap,
  FileText,
  Plus,
  Gavel,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/store'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import PresidentBadge from '@/components/president/PresidentBadge'
import SecretaryDashboard from './president/SecretaryDashboard'
import { useGovernmentSystem } from '@/hooks/useGovernmentSystem'

export default function PresidentPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const {
    currentPresident,
    currentVP,
    currentElection,
    voteForCandidate,
    signupCandidate,
    loading,
  } = usePresidentSystem()

  const [slogan, setSlogan] = useState('')

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true
  const isPresident = profile?.role === 'president'
  const isSecretary = profile?.role === 'secretary'
  const isVP = profile?.role === 'vice_president' || profile?.role === 'vp' || profile?.vice_president
  const pollsOpen = currentElection?.status === 'open'

  const alreadyCandidate = useMemo(() => {
    return Boolean(currentElection?.candidates?.some((c) => c.user_id === user?.id))
  }, [currentElection?.candidates, user?.id])

  const handleSignup = async () => {
    if (!currentElection) {
      toast.error('No active election is available.')
      return
    }

    if (!slogan.trim()) {
      toast.error('Please enter a campaign slogan.')
      return
    }

    await signupCandidate(currentElection.id, slogan.trim(), '', '')
    setSlogan('')
  }

  if (user && !profile) {
    return (
      <main className="min-h-screen bg-[#030712] text-white flex items-center justify-center px-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-950/80 p-8 text-center shadow-[0_0_60px_rgba(34,211,238,0.18)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_45%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.12),transparent_40%)]" />

          <div className="relative z-10 space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_35px_rgba(34,211,238,0.25)]">
              <Lock className="h-10 w-10 text-cyan-300" />
            </div>

            <div>
              <h1 className="text-3xl font-black tracking-tight">Citizen Access Required</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                You must be signed in as a Mai Troll citizen to view elections, vote, or run for office.
              </p>
            </div>

            <button
              onClick={() => navigate('/auth')}
              className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-400 px-6 py-3 font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.35)] transition hover:bg-cyan-300 active:scale-95"
            >
              Login to Vote
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_82%_8%,rgba(168,85,247,0.18),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.12),transparent_34%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
      </div>

      <section className="relative z-10 px-4 pb-10 pt-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                <Landmark className="h-4 w-4" />
                Mai Troll Presidential Office
              </div>

              <h1 className="text-4xl font-black tracking-tight text-white md:text-7xl">
                President
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                  Command Center
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Vote, run for office, view the active administration, and manage official Mai Troll election operations.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:w-[360px]">
              <StatusTile icon={Vote} label="Election" value={currentElection?.status || 'Inactive'} active={pollsOpen} />
              <StatusTile icon={ShieldCheck} label="Access" value={isAdmin || isSecretary || isPresident ? 'Staff' : 'Citizen'} active />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <OfficeCard
              title="Current President"
              role="President"
              username={currentPresident?.username || 'Vacant'}
              avatarUrl={currentPresident?.avatar_url}
              fallbackName={currentPresident?.username || 'President'}
              primary
              isPresident={isPresident}
              isAdmin={isAdmin}
              isSecretary={isSecretary}
              onManage={() => navigate('/president/secretary')}
            />

            <OfficeCard
              title="Vice President"
              role="Vice President"
              username={currentVP?.appointee?.username || 'Vacant'}
              avatarUrl={currentVP?.appointee?.avatar_url}
              fallbackName={currentVP?.appointee?.username || 'Vice President'}
              isPresident={false}
              isAdmin={isAdmin}
              isSecretary={isSecretary}
              onManage={() => navigate('/president/secretary')}
            />
          </div>

{isPresident ? (
            <>
              <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-4 shadow-[0_0_60px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-6">
                <SecretaryDashboard />
              </section>
              
              {(isPresident || isVP || isAdmin) && <LawOfficeSection />}
            </>
          ) : (
            <section className="mt-8 overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-950/80 shadow-[0_0_70px_rgba(34,211,238,0.13)] backdrop-blur-xl">
              <div className="border-b border-cyan-400/10 bg-white/[0.03] p-5 md:p-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="flex items-center gap-3 text-2xl font-black md:text-3xl">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
                        <Vote className="h-5 w-5" />
                      </span>
                      Election Center
                    </h2>
                    <p className="mt-2 text-sm text-slate-400">
                      Status:{' '}
                      <span className="font-bold capitalize text-white">
                        {currentElection?.status || 'No Active Election'}
                      </span>
                    </p>
                  </div>

                  {pollsOpen ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                      Polls Open
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-600/50 bg-slate-900/70 px-4 py-2 text-sm font-black text-slate-300">
                      <Calendar className="h-4 w-4" />
                      Waiting Cycle
                    </div>
                  )}
                </div>
              </div>

              {pollsOpen ? (
                <div className="space-y-8 p-5 md:p-7">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {currentElection?.candidates?.map((candidate) => (
                      <article
                        key={candidate.id}
                        className="group rounded-3xl border border-cyan-400/15 bg-slate-900/70 p-5 shadow-[0_0_35px_rgba(34,211,238,0.08)] transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-slate-900"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={
                              candidate.avatar_url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.username || 'Candidate')}`
                            }
                            alt={candidate.username}
                            className="h-14 w-14 rounded-2xl border border-cyan-300/20 bg-slate-800 object-cover"
                          />

                          <div className="min-w-0">
                            <h4 className="truncate text-lg font-black text-white">{candidate.username}</h4>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                              {candidate.status === 'approved' ? 'Candidate' : candidate.status === 'pending' ? 'Pending Approval' : 'Rejected'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm italic leading-6 text-slate-300">
                          “{candidate.slogan || 'No slogan provided'}”
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
<div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Votes</p>
                          <p className="text-xl font-black text-cyan-200">{candidate.vote_count ?? candidate.score ?? 0}</p>
                        </div>

{candidate.is_approved || candidate.status === 'approved' ? (
                          <button
                            onClick={() => voteForCandidate(candidate.id)}
                            disabled={loading}
                            className="rounded-2xl border border-cyan-300/25 bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Vote
                          </button>
                        ) : candidate.status === 'rejected' ? (
                          <span className="rounded-2xl border border-red-600/30 bg-red-700/50 px-5 py-2.5 text-sm font-bold text-red-300">
                            Rejected
                          </span>
                        ) : (
                          <span className="rounded-2xl border border-slate-600/30 bg-slate-700 px-5 py-2.5 text-sm font-bold text-slate-400">
                            Pending Approval
                          </span>
                        )}
                        </div>
                      </article>
                    ))}
                  </div>

                  {!alreadyCandidate && (
                    <div className="rounded-[2rem] border border-fuchsia-400/20 bg-fuchsia-400/5 p-5 md:p-6">
                      <div className="mb-5 flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300">
                          <Sparkles className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="text-xl font-black text-white">Run for President</h3>
                          <p className="text-sm text-slate-400">Submit your campaign slogan and join the election.</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row">
                        <input
                          type="text"
                          value={slogan}
                          onChange={(e) => setSlogan(e.target.value)}
                          placeholder="Enter your campaign slogan..."
                          className="min-h-[52px] flex-1 rounded-2xl border border-cyan-400/20 bg-black/40 px-4 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                        />

                        <button
                          onClick={handleSignup}
                          disabled={loading}
                          className="min-h-[52px] rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500 px-6 font-black text-white shadow-[0_0_26px_rgba(217,70,239,0.22)] transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Register
                        </button>
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        Requirements: Level 0, , and valid citizen profile.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_40px_rgba(34,211,238,0.16)]">
                    <Calendar className="h-10 w-10" />
                  </div>

                  <h3 className="text-2xl font-black text-white">No Active Election</h3>
                  <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
                    The next election cycle has not started yet. When polls open, candidates and voting controls will appear here.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

function StatusTile({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: React.ElementType
  label: string
  value: string
  active?: boolean
}) {
  return (
    <div className="rounded-3xl border border-cyan-400/15 bg-slate-950/70 p-4 shadow-[0_0_32px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <Icon className={active ? 'h-5 w-5 text-cyan-300' : 'h-5 w-5 text-slate-500'} />
        <span className={active ? 'h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.8)]' : 'h-2 w-2 rounded-full bg-slate-600'} />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black capitalize text-white">{value}</p>
    </div>
  )
}

function OfficeCard({
  title,
  role,
  username,
  avatarUrl,
  fallbackName,
  primary,
  isPresident,
  isAdmin,
  isSecretary,
  onManage,
}: {
  title: string
  role: string
  username: string
  avatarUrl?: string | null
  fallbackName: string
  primary?: boolean
  isPresident: boolean
  isAdmin: boolean
  isSecretary: boolean
  onManage: () => void
}) {
  const canManage = primary ? isPresident || isAdmin || isSecretary : isAdmin || isSecretary

  return (
    <article className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-8">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative z-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{title}</p>
            <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">{username}</h2>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200">
            {primary ? <PresidentBadge size="sm" /> : <Users className="h-6 w-6" />}
          </div>
        </div>

        <div className="flex flex-col items-center rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-cyan-300 blur-2xl opacity-20" />
            <img
              src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}`}
              alt={role}
              className="relative h-32 w-32 rounded-full border-4 border-cyan-300/30 bg-slate-800 object-cover shadow-[0_0_35px_rgba(34,211,238,0.2)]"
            />
            {primary && (
              <span className="absolute -right-1 bottom-2 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-950 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.35)]">
                <Crown className="h-5 w-5" />
              </span>
            )}
          </div>

          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{role}</p>
          <p className="mt-2 text-sm text-slate-400">
            {username === 'Vacant' ? 'This office is currently vacant.' : 'Currently serving Mai Troll citizens.'}
          </p>

          {canManage && (
            <button
              onClick={onManage}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.25)] transition hover:bg-cyan-300 active:scale-95"
            >
              {isPresident ? 'Manage Office' : 'Election Commission'}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-cyan-400/10 bg-black/25 p-4">
            <Zap className="mb-2 h-5 w-5 text-cyan-300" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Authority</p>
            <p className="mt-1 text-sm font-black text-white">Official</p>
          </div>

          <div className="rounded-2xl border border-fuchsia-400/10 bg-black/25 p-4">
            <ShieldCheck className="mb-2 h-5 w-5 text-fuchsia-300" />
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Status</p>
<p className="mt-1 text-sm font-black text-white">{username === 'Vacant' ? 'Open' : 'Active'}</p>
            </div>
          </div>
        </div>
      </article>
  )
}

// Law Office Section for President/Admin
function LawOfficeSection() {
  const { user } = useAuthStore()
  const { laws, createLaw, loading } = useGovernmentSystem()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newLaw, setNewLaw] = useState({
    title: '',
    description: '',
    category: 'general',
    effect_type: 'none',
    effect_value: {},
    required_votes: 10,
  })

  const votingLaws = laws.filter((l) => l.status === 'voting')
  const activeLaws = laws.filter((l) => l.status === 'active')

  const handleCreateLaw = async () => {
    if (!newLaw.title.trim()) {
      toast.error('Please enter a law title')
      return
    }
    try {
      await createLaw(newLaw)
      toast.success('Law created successfully!')
      setShowCreateForm(false)
      setNewLaw({
        title: '',
        description: '',
        category: 'general',
        effect_type: 'none',
        effect_value: {},
        required_votes: 10,
      })
    } catch (error) {
      toast.error('Failed to create law')
    }
  }

  const CATEGORIES = [
    { value: 'general', label: 'General' },
    { value: 'tax', label: 'Tax & Economy' },
    { value: 'safety', label: 'Public Safety' },
    { value: 'social', label: 'Social' },
    { value: 'marketplace', label: 'Marketplace' },
    { value: 'family', label: 'Family' },
    { value: 'emergency', label: 'Emergency' },
  ]

  return (
    <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-4 shadow-[0_0_60px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Law Office</h2>
            <p className="text-sm text-slate-400">Propose and manage city legislation</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-2xl border border-cyan-300/25 bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-300"
        >
          <Plus className="mr-2 inline h-4 w-4" />
          New Proposal
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-6 rounded-2xl border border-cyan-300/20 bg-black/40 p-5">
          <h3 className="mb-4 text-lg font-black text-white">Draft New Law</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Title</label>
              <input
                type="text"
                value={newLaw.title}
                onChange={(e) => setNewLaw({ ...newLaw, title: e.target.value })}
                className="w-full rounded-xl border border-cyan-300/20 bg-slate-900 px-4 py-2 text-white outline-none"
                placeholder="Enter law title..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Description</label>
              <textarea
                value={newLaw.description}
                onChange={(e) => setNewLaw({ ...newLaw, description: e.target.value })}
                className="w-full rounded-xl border border-cyan-300/20 bg-slate-900 px-4 py-2 text-white outline-none"
                rows={3}
                placeholder="Describe what this law does..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Category</label>
              <select
                value={newLaw.category}
                onChange={(e) => setNewLaw({ ...newLaw, category: e.target.value })}
                className="w-full rounded-xl border border-cyan-300/20 bg-slate-900 px-4 py-2 text-white outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateLaw}
                disabled={loading}
                className="flex-1 rounded-xl border border-green-300/30 bg-green-600 px-4 py-2 font-black text-white shadow-[0_0_20px_rgba(34,197,94,0.2)] transition hover:bg-green-500 disabled:opacity-50"
              >
                Submit Proposal
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="rounded-xl border border-slate-600/30 bg-slate-700 px-4 py-2 font-bold text-white transition hover:bg-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-green-300/20 bg-green-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-green-300">Active Laws</p>
          <p className="text-3xl font-black text-white">{activeLaws.length}</p>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">In Voting</p>
          <p className="text-3xl font-black text-white">{votingLaws.length}</p>
        </div>
      </div>
    </section>
  )
}