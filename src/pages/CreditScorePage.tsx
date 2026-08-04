import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  LucideIcon,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { supabase } from '../lib/supabase'

interface CreditUser {
  user_id: string
  score: number
  tier: string
  trend_7d: number
  updated_at: string
  username?: string
}

interface CreditEvent {
  id: string
  user_id: string
  event_type: string
  delta: number
  created_at: string
  metadata: any
  source_table?: string
}

const TIERS = ['Untrusted', 'Shaky', 'Building', 'Reliable', 'Trusted', 'Elite']

export default function CreditScorePage() {
  const [creditUsers, setCreditUsers] = useState<CreditUser[]>([])
  const [selectedUser, setSelectedUser] = useState<CreditUser | null>(null)
  const [creditEvents, setCreditEvents] = useState<CreditEvent[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTier, setFilterTier] = useState('all')
  const [loading, setLoading] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(false)

  const filteredUsers = useMemo(() => {
    return creditUsers.filter((user) => {
      const query = searchQuery.trim().toLowerCase()

      const matchesSearch =
        !query ||
        user.username?.toLowerCase().includes(query) ||
        user.user_id.toLowerCase().includes(query)

      const matchesTier = filterTier === 'all' || user.tier === filterTier

      return matchesSearch && matchesTier
    })
  }, [creditUsers, searchQuery, filterTier])

  const stats = useMemo(() => {
    return {
      residents: creditUsers.length,
      elite: creditUsers.filter((u) => u.tier === 'Elite').length,
      trusted: creditUsers.filter((u) => u.tier === 'Trusted').length,
      atRisk: creditUsers.filter((u) => ['Untrusted', 'Shaky'].includes(u.tier)).length,
    }
  }, [creditUsers])

  useEffect(() => {
    fetchAllCreditScores()
  }, [])

  const fetchAllCreditScores = async () => {
    setLoading(true)

    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, created_at')

      if (profilesError) throw profilesError

      const { data: creditData, error: creditError } = await supabase
        .from('user_credit')
        .select('user_id, score, tier, trend_7d, updated_at')

      if (creditError) throw creditError

      const creditMap = new Map((creditData || []).map((row) => [row.user_id, row]))

      const combinedData: CreditUser[] = (profiles || []).map((profile) => {
        const credit = creditMap.get(profile.id)

        return {
          user_id: profile.id,
          username: profile.username || 'Unknown',
          score: credit?.score ?? 400,
          tier: credit?.tier ?? 'Building',
          trend_7d: credit?.trend_7d ?? 0,
          updated_at: credit?.updated_at ?? profile.created_at ?? new Date().toISOString(),
        }
      })

      combinedData.sort((a, b) => b.score - a.score)

      setCreditUsers(combinedData)
    } catch (error) {
      console.error('Failed to fetch credit scores:', error)
      toast.error('Failed to load credit scores')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserCreditEvents = async (userId: string) => {
    setEventsLoading(true)

    try {
      const { data, error } = await supabase
        .from('credit_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setCreditEvents(data || [])
    } catch (error) {
      console.error('Failed to fetch credit events:', error)
      toast.error('Failed to load credit history')
    } finally {
      setEventsLoading(false)
    }
  }

  const handleSelectUser = async (user: CreditUser) => {
    setSelectedUser(user)
    await fetchUserCreditEvents(user.user_id)
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white overflow-y-auto">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.13),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <section className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <header className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <BadgeCheck className="h-4 w-4" />
                Mai Troll Public Credit Bureau
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Credit
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                  Scores
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                Public trust scores for Mai Troll residents based on payments, loans, defaults, repossessions, and credit events.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={Users} label="Residents" value={stats.residents} />
              <StatCard icon={BadgeCheck} label="Elite" value={stats.elite} gold />
              <StatCard icon={TrendingUp} label="Trusted" value={stats.trusted} green />
              <StatCard icon={ShieldAlert} label="At Risk" value={stats.atRisk} danger />
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by username or resident ID..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-cyan-400/20 bg-black/40 py-3 pl-12 pr-4 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <select
              value={filterTier}
              onChange={(event) => setFilterTier(event.target.value)}
              className="rounded-2xl border border-cyan-400/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-cyan-300/60"
            >
              <option value="all">All Tiers</option>
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <section className="overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <div className="border-b border-cyan-400/10 bg-white/[0.03] p-5">
              <h2 className="text-xl font-black text-white">Residents ({filteredUsers.length})</h2>
            </div>

            {loading ? (
              <LoadingState />
            ) : filteredUsers.length === 0 ? (
              <EmptyState text="No residents found matching your search." />
            ) : (
              <div className="divide-y divide-cyan-400/10">
                {filteredUsers.map((user) => (
                  <CreditUserRow
                    key={user.user_id}
                    user={user}
                    selected={selectedUser?.user_id === user.user_id}
                    onClick={() => handleSelectUser(user)}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-6">
            {selectedUser ? (
              <>
                <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
                  <h3 className="mb-5 text-xl font-black text-white">Credit Report</h3>

                  <div className="space-y-4">
                    <InfoRow label="Resident" value={selectedUser.username || 'Unknown'} />
                    <InfoRow label="Score" value={String(selectedUser.score)} large />
                    <div>
                      <p className="mb-2 text-sm text-slate-400">Credit Tier</p>
                      <TierBadge tier={selectedUser.tier} />
                    </div>
                    <div>
                      <p className="mb-2 text-sm text-slate-400">7-Day Trend</p>
                      <TrendValue value={selectedUser.trend_7d} />
                    </div>
                    <InfoRow label="Last Updated" value={new Date(selectedUser.updated_at).toLocaleDateString()} />
                  </div>
                </section>

                <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
                  <h4 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
                    Score Scale
                  </h4>

                  <div className="space-y-2">
                    <ScaleRow range="800+" label="Elite" color="text-yellow-300" />
                    <ScaleRow range="700-799" label="Trusted" color="text-emerald-300" />
                    <ScaleRow range="600-699" label="Reliable" color="text-cyan-300" />
                    <ScaleRow range="450-599" label="Building" color="text-fuchsia-300" />
                    <ScaleRow range="300-449" label="Shaky" color="text-orange-300" />
                    <ScaleRow range="Below 300" label="Untrusted" color="text-red-300" />
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-8 text-center shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="text-sm text-slate-400">
                  Select a resident to view their credit report.
                </p>
              </section>
            )}
          </aside>
        </div>

        {selectedUser && (
          <section className="overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <div className="border-b border-cyan-400/10 bg-white/[0.03] p-5">
              <h3 className="text-xl font-black text-white">Credit History</h3>
            </div>

            {eventsLoading ? (
              <LoadingState />
            ) : creditEvents.length === 0 ? (
              <EmptyState text="No credit events recorded." />
            ) : (
              <div className="divide-y divide-cyan-400/10">
                {creditEvents.map((event) => (
                  <CreditEventRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

function CreditUserRow({
  user,
  selected,
  onClick,
}: {
  user: CreditUser
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-5 py-4 text-left transition hover:bg-cyan-400/5 ${
        selected ? 'border-l-4 border-cyan-300 bg-cyan-400/10' : ''
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-black text-white">{user.username}</p>
          <p className="mt-1 text-xs text-slate-500">{user.user_id}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-2xl font-black text-white">{user.score}</p>
          <TierBadge tier={user.tier} />
          {user.trend_7d !== 0 && <TrendValue value={user.trend_7d} />}
        </div>
      </div>
    </button>
  )
}

function CreditEventRow({ event }: { event: CreditEvent }) {
  const positive = event.delta >= 0

  return (
    <div className="px-5 py-4 transition hover:bg-cyan-400/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`font-black ${getEventColor(event.event_type)}`}>
            {event.event_type.replace(/_/g, ' ').toUpperCase()}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {new Date(event.created_at).toLocaleDateString()} at{' '}
            {new Date(event.created_at).toLocaleTimeString()}
          </p>

          {event.metadata?.reason && (
            <p className="mt-2 text-sm text-slate-300">{event.metadata.reason}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
          <p className={`text-lg font-black ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
            {event.delta > 0 ? '+' : ''}
            {event.delta}
          </p>
          <p className="text-xs text-slate-500">points</p>
        </div>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-black ${getTierColor(tier)}`}>
      {tier}
    </span>
  )
}

function TrendValue({ value }: { value: number }) {
  const positive = value > 0
  const negative = value < 0

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-black ${
        positive
          ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
          : negative
            ? 'border-red-400/20 bg-red-500/10 text-red-300'
            : 'border-slate-400/20 bg-slate-500/10 text-slate-300'
      }`}
    >
      {positive && <TrendingUp className="h-4 w-4" />}
      {negative && <TrendingDown className="h-4 w-4" />}
      {value > 0 ? '+' : ''}
      {value}
    </span>
  )
}

function InfoRow({
  label,
  value,
  large,
}: {
  label: string
  value: string
  large?: boolean
}) {
  return (
    <div className="border-b border-white/10 pb-3 last:border-b-0">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-1 font-black text-white ${large ? 'text-4xl' : 'text-base'}`}>
        {value}
      </p>
    </div>
  )
}

function ScaleRow({
  range,
  label,
  color,
}: {
  range: string
  label: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm">
      <span className={`font-black ${color}`}>{range}</span>
      <span className="font-bold text-slate-300">{label}</span>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-slate-400">
      {text}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  gold,
  green,
  danger,
}: {
  icon: LucideIcon
  label: string
  value: number
  gold?: boolean
  green?: boolean
  danger?: boolean
}) {
  const tone = gold
    ? 'border-yellow-400/20 bg-yellow-500/10 text-yellow-300'
    : green
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
      : danger
        ? 'border-red-400/20 bg-red-500/10 text-red-300'
        : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300'

  return (
    <div className={`min-w-[112px] rounded-2xl border p-4 ${tone}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] opacity-90">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="text-3xl font-black text-white">{value.toLocaleString()}</p>
    </div>
  )
}

function getTierColor(tier: string) {
  switch (tier) {
    case 'Elite':
      return 'border-yellow-400/20 bg-yellow-500/10 text-yellow-300'
    case 'Trusted':
      return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
    case 'Reliable':
      return 'border-cyan-400/20 bg-cyan-500/10 text-cyan-300'
    case 'Building':
      return 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300'
    case 'Shaky':
      return 'border-orange-400/20 bg-orange-500/10 text-orange-300'
    case 'Untrusted':
      return 'border-red-400/20 bg-red-500/10 text-red-300'
    default:
      return 'border-slate-400/20 bg-slate-500/10 text-slate-300'
  }
}

function getEventColor(eventType: string) {
  if (eventType.includes('repossess')) return 'text-red-300'
  if (eventType.includes('default')) return 'text-red-300'
  if (eventType.includes('late')) return 'text-orange-300'
  if (eventType.includes('payment')) return 'text-emerald-300'
  if (eventType.includes('loan_approval')) return 'text-emerald-300'
  return 'text-cyan-300'
}
