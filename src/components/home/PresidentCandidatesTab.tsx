import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import { supabase } from '@/lib/supabase'
import {
  BadgeCheck,
  ChevronRight,
  Crown,
  Flame,
  Landmark,
  Radio,
  Sparkles,
  TrendingUp,
  Trophy,
  User,
  Users,
  Vote,
} from 'lucide-react'

export default function PresidentCandidatesTab() {
  const navigate = useNavigate()
  const { currentElection, loading, refresh } = usePresidentSystem()

  useEffect(() => {
    console.log('[HomePresidentCandidates] loading election')
    console.log('[HomePresidentCandidates] loading candidates')
  }, [])

  useEffect(() => {
    if (currentElection) {
      console.log('[HomePresidentCandidates] vote counts loaded')
    }
  }, [currentElection])

  useEffect(() => {
    if (!currentElection?.id) return

    console.log('[HomePresidentCandidates] setting up realtime vote update')

    const channel = supabase
      .channel(`home_president_votes_${currentElection.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'president_votes',
          filter: `election_id=eq.${currentElection.id}`,
        },
        () => {
          console.log('[HomePresidentCandidates] realtime vote update')
          refresh()
        }
      )
      .subscribe()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [currentElection?.id, refresh])

  if (loading && !currentElection) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-purple-400/20 bg-slate-950/80 p-8 shadow-[0_0_40px_rgba(168,85,247,0.16)]">
        <ElectionBackgroundFX />

        <div className="relative z-10 flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-lime-300 border-t-transparent shadow-[0_0_20px_rgba(190,242,100,0.35)]" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-lime-200/80">
              Loading Election Race
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!currentElection) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-purple-400/20 bg-slate-950/80 p-6 text-center shadow-[0_0_45px_rgba(168,85,247,0.16)]">
        <ElectionBackgroundFX />

        <div className="relative z-10 py-10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-lime-300/25 bg-lime-400/10 shadow-[0_0_28px_rgba(190,242,100,0.18)]">
            <Landmark className="h-8 w-8 text-lime-300" />
          </div>

          <h3 className="text-xl font-black text-white">No Active Election Yet</h3>

          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            The Trublicans and Trollmacrats are waiting for the next presidential race to open.
          </p>

          <button
            onClick={() => navigate('/president')}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-purple-300/30 bg-purple-500/15 px-5 py-3 text-sm font-black text-purple-100 transition hover:bg-purple-500/25 hover:text-white"
            type="button"
          >
            View President Office
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  const approvedCandidates =
    currentElection.candidates?.filter((candidate) => candidate.status === 'approved') || []

  if (approvedCandidates.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-purple-400/20 bg-slate-950/80 p-5 shadow-[0_0_45px_rgba(168,85,247,0.16)]">
        <ElectionBackgroundFX />

        <div className="relative z-10 space-y-4">
          <ElectionHeader
            title={currentElection.title || 'Presidential Election'}
            subtitle={currentElection.description || 'Candidates are being vetted for the race.'}
            candidateCount={0}
          />

          <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-300/25 bg-purple-500/10">
              <User className="h-7 w-7 text-purple-300" />
            </div>

            <h4 className="font-black text-white">No Approved Candidates Running Yet</h4>

            <p className="mt-2 text-sm text-slate-400">
              Once candidates are approved, this card will show the live Trublican vs Trollmacrat race.
            </p>
          </div>

          <button
            onClick={() => navigate('/president')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-lime-300/25 bg-lime-400/10 px-4 py-3 text-sm font-black text-lime-100 transition hover:bg-lime-400/20 hover:text-white"
            type="button"
          >
            View Election
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  const totalVotes = approvedCandidates.reduce(
    (sum, candidate) => sum + Number(candidate.vote_count || candidate.score || 0),
    0
  )

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-purple-400/25 bg-slate-950/85 p-4 shadow-[0_0_55px_rgba(168,85,247,0.18)]">
      <ElectionBackgroundFX />

      <div className="relative z-10 space-y-5">
        <ElectionHeader
          title={currentElection.title || 'Presidential Election'}
          subtitle="Live presidential candidate race"
          candidateCount={approvedCandidates.length}
          totalVotes={totalVotes}
        />

        <div className="grid grid-cols-2 gap-2 rounded-[1.35rem] border border-white/10 bg-black/35 p-2">
          <PartyMeter
            party="Trublicans"
            color="green"
            label="Neon Green Party"
          />

          <PartyMeter
            party="Trollmacrats"
            color="purple"
            label="Neon Purple Party"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {approvedCandidates.map((candidate, index) => {
            const votes = Number(candidate.vote_count ?? candidate.score ?? 0)
            const party = getCandidateParty(candidate, index)
            const votePercent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0

            return (
              <article
                key={candidate.id}
                className={[
                  'group relative overflow-hidden rounded-[1.6rem] border p-4 transition duration-300 hover:-translate-y-1',
                  party === 'trublican'
                    ? 'border-lime-300/25 bg-lime-400/[0.07] shadow-[0_0_28px_rgba(190,242,100,0.12)] hover:border-lime-300/50 hover:shadow-[0_0_40px_rgba(190,242,100,0.20)]'
                    : 'border-purple-300/25 bg-purple-500/[0.08] shadow-[0_0_28px_rgba(168,85,247,0.12)] hover:border-purple-300/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.22)]',
                ].join(' ')}
              >
                <div
                  className={[
                    'pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl',
                    party === 'trublican' ? 'bg-lime-300/20' : 'bg-purple-400/24',
                  ].join(' ')}
                />

                <div className="relative z-10">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <PartyBadge party={party} />

                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">
                      <Radio className="h-3 w-3" />
                      Live
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        'relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border bg-slate-900',
                        party === 'trublican'
                          ? 'border-lime-300/35 shadow-[0_0_24px_rgba(190,242,100,0.18)]'
                          : 'border-purple-300/35 shadow-[0_0_24px_rgba(168,85,247,0.20)]',
                      ].join(' ')}
                    >
                      {candidate.avatar_url ? (
                        <img
                          src={candidate.avatar_url}
                          alt={candidate.username || 'Candidate'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User
                            className={[
                              'h-8 w-8',
                              party === 'trublican' ? 'text-lime-300' : 'text-purple-300',
                            ].join(' ')}
                          />
                        </div>
                      )}

                      <span
                        className={[
                          'absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border bg-slate-950',
                          party === 'trublican'
                            ? 'border-lime-300/40 text-lime-300'
                            : 'border-purple-300/40 text-purple-300',
                        ].join(' ')}
                      >
                        <Crown className="h-3 w-3" />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-lg font-black text-white">
                        {candidate.display_name || candidate.username}
                      </h4>

                      <p className="mt-1 line-clamp-2 text-xs italic leading-5 text-slate-300">
                        “{candidate.slogan || 'No slogan provided'}”
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Vote
                          className={[
                            'h-4 w-4',
                            party === 'trublican' ? 'text-lime-300' : 'text-purple-300',
                          ].join(' ')}
                        />

                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                          Live Votes
                        </span>
                      </div>

                      <span className="text-xl font-black text-white">
                        {votes.toLocaleString()}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={[
                          'h-full rounded-full transition-all duration-500',
                          party === 'trublican'
                            ? 'bg-lime-300 shadow-[0_0_16px_rgba(190,242,100,0.45)]'
                            : 'bg-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.55)]',
                        ].join(' ')}
                        style={{ width: `${votePercent}%` }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      <span>{votePercent}% of votes</span>
                      <span>{candidate.status}</span>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <button
          onClick={() => navigate('/president')}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-r from-lime-400 via-purple-500 to-fuchsia-500 px-4 py-3 text-sm font-black text-white shadow-[0_0_35px_rgba(168,85,247,0.24)] transition hover:brightness-110 active:scale-[0.98]"
          type="button"
        >
          <Trophy className="h-4 w-4 transition group-hover:rotate-[-8deg]" />
          View Full Election Details
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  )
}

function ElectionHeader({
  title,
  subtitle,
  candidateCount,
  totalVotes,
}: {
  title: string
  subtitle: string
  candidateCount: number
  totalVotes?: number
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/35 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-lime-200">
            <Sparkles className="h-3.5 w-3.5" />
            Mai Troll Election Live
          </div>

          <h3 className="truncate text-xl font-black text-white">{title}</h3>

          <p className="mt-1 text-xs font-medium text-slate-400">{subtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-purple-200">{candidateCount}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-purple-200/60">
              Running
            </p>
          </div>

          <div className="rounded-2xl border border-lime-300/20 bg-lime-400/10 px-3 py-2 text-center">
            <p className="text-lg font-black text-lime-200">{(totalVotes || 0).toLocaleString()}</p>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-lime-200/60">
              Votes
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PartyMeter({
  party,
  color,
  label,
}: {
  party: string
  color: 'green' | 'purple'
  label: string
}) {
  const isGreen = color === 'green'

  return (
    <div
      className={[
        'rounded-2xl border p-3',
        isGreen
          ? 'border-lime-300/20 bg-lime-400/10'
          : 'border-purple-300/20 bg-purple-500/10',
      ].join(' ')}
    >
      <div className="mb-1 flex items-center gap-2">
        <Flame className={isGreen ? 'h-4 w-4 text-lime-300' : 'h-4 w-4 text-purple-300'} />
        <p className={isGreen ? 'text-sm font-black text-lime-200' : 'text-sm font-black text-purple-200'}>
          {party}
        </p>
      </div>

      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
    </div>
  )
}

function PartyBadge({ party }: { party: 'trublican' | 'trollmacrat' }) {
  const isTrublican = party === 'trublican'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
        isTrublican
          ? 'border-lime-300/25 bg-lime-400/10 text-lime-200'
          : 'border-purple-300/25 bg-purple-500/10 text-purple-200',
      ].join(' ')}
    >
      <BadgeCheck className="h-3.5 w-3.5" />
      {isTrublican ? 'Trublican' : 'Trollmacrat'}
    </span>
  )
}

function ElectionBackgroundFX() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(190,242,100,0.18),transparent_32%),radial-gradient(circle_at_90%_15%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:36px_36px] opacity-10" />
    </>
  )
}

function getCandidateParty(candidate: any, index: number): 'trublican' | 'trollmacrat' {
  const rawParty =
    candidate.party ||
    candidate.party_name ||
    candidate.political_party ||
    candidate.affiliation ||
    ''

  const party = String(rawParty).toLowerCase()

  if (party.includes('trublican') || party.includes('green')) {
    return 'trublican'
  }

  if (party.includes('trollmacrat') || party.includes('purple')) {
    return 'trollmacrat'
  }

  return index % 2 === 0 ? 'trublican' : 'trollmacrat'
}