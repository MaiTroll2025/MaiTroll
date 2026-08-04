import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Gavel,
  Vote,
  Clock,
  AlertTriangle,
  CheckCircle,
  Shield,
  Crown,
  Users,
  ChevronRight,
  Plus,
  Eye,
  Calendar,
} from 'lucide-react'
import { useGovernmentSystem, Law } from '@/hooks/useGovernmentSystem'
import { useAuthStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const glassPanel =
  'rounded-2xl border border-cyan-300/15 bg-slate-950/65 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200'
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20 hover:text-white'

interface FeeItem {
  name: string
  rate: string
  description: string
  icon: React.ReactNode
}

export default function CityLawsFeesTab() {
  const { user, profile } = useAuthStore()
  const {
    laws,
    cityReputation,
    protests,
    loading,
    getUserRoleLevel,
  } = useGovernmentSystem()

  const roleLevel = getUserRoleLevel()
  const canCreateLaw = ['secretary', 'president', 'admin'].includes(roleLevel)
  const canViewEnforcement = ['officer', 'lead', 'secretary', 'president', 'admin'].includes(roleLevel)

  const activeLaws = useMemo(() => laws.filter((l) => l.status === 'active'), [laws])
  const votingLaws = useMemo(() => laws.filter((l) => l.status === 'voting'), [laws])
  const activeProtests = useMemo(() => protests.filter((p) => p.status === 'active' || p.status === 'growing'), [protests])

  const fees: FeeItem[] = useMemo(() => [
    {
      name: 'Platform Fee',
      rate: '3%',
      description: 'Applied to all marketplace transactions',
      icon: <Shield className="h-4 w-4" />,
    },
    {
      name: 'Seller Escrow',
      rate: 'Seller receives 97%',
      description: 'After platform fee deduction',
      icon: <CheckCircle className="h-4 w-4" />,
    },
    {
      name: 'Auction Payout',
      rate: 'Auctioneer receives 97%',
      description: 'Auction sale after platform fee',
      icon: <Gavel className="h-4 w-4" />,
    },
    {
      name: 'Court Fines',
      rate: 'Fine + 3% fee',
      description: 'Fines include platform processing fee',
      icon: <AlertTriangle className="h-4 w-4" />,
    },
  ], [])

  const payoutInfo = {
    day: 'Based on Level Every Hr, Every 24 hrs, or on request',
    system: 'MAI Pay',
  }

  const getTimeRemaining = (endDate: string | null) => {
    if (!endDate) return null
    const end = new Date(endDate)
    const now = new Date()
    const diff = end.getTime() - now.getTime()

    if (diff < 0) return 'Ended'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days}d ${hours}h remaining`
    return `${hours}h remaining`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-green-300/30 bg-green-500/10 text-green-200'
      case 'voting':
        return 'border-cyan-300/30 bg-cyan-500/10 text-cyan-200'
      case 'draft':
        return 'border-slate-400/30 bg-slate-500/10 text-slate-300'
      default:
        return 'border-slate-400/30 bg-slate-500/10 text-slate-300'
    }
  }

  if (loading) {
    return (
      <div className={glassPanel}>
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className={glassPanel}>
        <div className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-black text-white">
                <FileText className="h-6 w-6 text-cyan-300" />
                City Laws & Fees
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Active laws, platform rules, and voting proposals
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link to="/government?tab=laws" className={secondaryButton}>
                View Full Government
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className={glassPanel}>
            <div className="border-b border-cyan-300/15 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <CheckCircle className="h-5 w-5 text-green-400" />
                Active Laws
              </h2>
            </div>
            <div className="p-5">
              {activeLaws.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm">No active laws yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLaws.slice(0, 5).map((law) => (
                    <LawCard key={law.id} law={law} getStatusColor={getStatusColor} />
                  ))}
                  {activeLaws.length > 5 && (
                    <Link
                      to="/government?tab=laws"
                      className="block text-center text-xs font-bold text-cyan-300 hover:text-cyan-200"
                    >
                      View all {activeLaws.length} active laws
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className={glassPanel}>
            <div className="border-b border-cyan-300/15 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Clock className="h-5 w-5 text-cyan-400" />
                Pending Votes
              </h2>
            </div>
            <div className="p-5">
              {votingLaws.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Vote className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm">No pending votes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {votingLaws.slice(0, 5).map((law) => (
                    <VotingLawCard key={law.id} law={law} getTimeRemaining={getTimeRemaining} />
                  ))}
                  {votingLaws.length > 5 && (
                    <Link
                      to="/government?tab=voting"
                      className="block text-center text-xs font-bold text-cyan-300 hover:text-cyan-200"
                    >
                      View all {votingLaws.length} pending votes
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className={glassPanel}>
            <div className="border-b border-cyan-300/15 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Shield className="h-5 w-5 text-purple-400" />
                Platform Fees
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {fees.map((fee) => (
                <div key={fee.name} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-cyan-300">
                    {fee.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-white">{fee.name}</p>
                    <p className="text-xs text-cyan-200">{fee.rate}</p>
                    <p className="text-xs text-slate-400">{fee.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={glassPanel}>
            <div className="border-b border-cyan-300/15 px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Calendar className="h-5 w-5 text-blue-400" />
                Payout System
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Payout Day
                </p>
                <p className="font-black text-white">{payoutInfo.day}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  System
                </p>
                <p className="font-black text-cyan-200">{payoutInfo.system}</p>
              </div>
            </div>
          </section>

          {activeProtests.length > 0 && (
            <section className={glassPanel}>
              <div className="border-b border-cyan-300/15 px-5 py-4">
                <h2 className="flex items-center gap-2 text-lg font-black text-white">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Active Protests
                </h2>
              </div>
              <div className="p-5">
                {activeProtests.slice(0, 3).map((protest) => (
                  <div key={protest.id} className="border-b border-red-300/10 py-2 last:border-0">
                    <p className="font-bold text-red-200">{protest.title}</p>
                    <p className="text-xs text-slate-400">
                      {protest.participant_count} participants � {protest.status}
                    </p>
                  </div>
                ))}
                <Link
                  to="/government?tab=protests"
                  className="mt-2 block text-center text-xs font-bold text-red-300 hover:text-red-200"
                >
                  View all protests
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>

      <section className={glassPanel}>
        <div className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Citizen Actions</h3>
              <p className="text-sm text-slate-400">
                {user
                  ? 'Vote on laws, submit proposals, or view elections'
                  : 'Sign in to participate in city government'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/government?tab=voting"
                className={secondaryButton}
              >
                <Vote className="h-4 w-4" />
                Vote on Laws
              </Link>
              {user && canCreateLaw && (
                <Link
                  to="/government?tab=laws"
                  className={primaryButton}
                >
                  <Plus className="h-4 w-4" />
                  Submit Law Proposal
                </Link>
              )}
              <Link
                to="/government?tab=elections"
                className={secondaryButton}
              >
                <Calendar className="h-4 w-4" />
                View Elections
              </Link>
              <Link
                to="/president"
                className={secondaryButton}
              >
                <Crown className="h-4 w-4" />
                View President Office
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function LawCard({
  law,
  getStatusColor,
}: {
  law: Law
  getStatusColor: (status: string) => string
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-green-300/15 bg-green-500/5 p-4">
      <div className="flex-1">
        <h3 className="font-bold text-white">{law.title}</h3>
        <p className="mt-1 text-sm text-slate-400 line-clamp-2">{law.description}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-200">
            {law.category}
          </span>
          <span className={cn('rounded-full border px-2 py-0.5 text-xs', getStatusColor(law.status))}>
            {law.status.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}

function VotingLawCard({
  law,
  getTimeRemaining,
}: {
  law: Law
  getTimeRemaining: (endDate: string | null) => string | null
}) {
  const totalVotes = (law.yes_votes || 0) + (law.no_votes || 0)
  const yesPercent = totalVotes > 0 ? Math.round(((law.yes_votes || 0) / totalVotes) * 100) : 0

  return (
    <div className="rounded-xl border border-cyan-300/15 bg-cyan-500/5 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-white">{law.title}</h3>
          <p className="mt-1 text-sm text-slate-400 line-clamp-2">{law.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-200">
              {law.category}
            </span>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200">
              VOTING
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-green-400">{law.yes_votes || 0} Yes</span>
          <span className="text-red-400">{law.no_votes || 0} No</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-green-500"
            style={{ width: `${yesPercent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {getTimeRemaining(law.voting_ends_at)} � {law.required_votes} votes needed
        </p>
      </div>
    </div>
  )
}
