import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  Disc3,
  FileText,
  Heart,
  Loader2,
  Mic2,
  Music,
  Play,
  TrendingUp,
  Upload,
  User,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ArtistDashboard, ContractTier } from '@/services/maiRecordLabel'

function formatCoins(value: number): string {
  return value.toLocaleString()
}

function tierLabel(tier: ContractTier): string {
  switch (tier) {
    case 'probation':
      return 'Probation (50/50)'
    case 'standard':
      return 'Standard (80/20)'
    case 'tier_90_10':
      return 'Tier 90/10'
    case 'tier_95_5':
      return 'Tier 95/5'
    default:
      return tier
  }
}

function tierColor(tier: ContractTier): string {
  switch (tier) {
    case 'probation':
      return 'text-amber-300 border-amber-400/30 bg-amber-500/10'
    case 'standard':
      return 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10'
    case 'tier_90_10':
      return 'text-purple-300 border-purple-400/30 bg-purple-500/10'
    case 'tier_95_5':
      return 'text-pink-300 border-pink-400/30 bg-pink-500/10'
    default:
      return 'text-slate-300 border-slate-400/30 bg-slate-500/10'
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
    case 'probation':
      return 'text-amber-300 border-amber-400/30 bg-amber-500/10'
    case 'suspended':
      return 'text-red-300 border-red-400/30 bg-red-500/10'
    case 'terminated':
      return 'text-red-300 border-red-400/30 bg-red-500/10'
    default:
      return 'text-slate-300 border-slate-400/30 bg-slate-500/10'
  }
}

function daysRemaining(probationEndsAt: string | null | undefined): number | null {
  if (!probationEndsAt) return null
  const now = new Date()
  const end = new Date(probationEndsAt)
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

export default function ArtistDashboardPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<ArtistDashboard | null>(null)

  const isArtist = (profile as any)?.is_record_label_artist === true

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const { data, error: err } = await recordLabelService.getArtistDashboard(user.id)

        if (!active) return

        if (err) {
          console.error('[ArtistDashboard] Failed to load:', err)
          setError(err.message || 'Failed to load dashboard')
          setDashboard(null)
          return
        }

        setDashboard(data)
      } catch (err: any) {
        if (!active) return
        console.error('[ArtistDashboard] Unexpected error:', err)
        setError(err?.message || 'Unexpected error loading dashboard')
        setDashboard(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [user?.id])

  const remainingDays = useMemo(() => {
    if (!dashboard?.contract) return null
    return daysRemaining(dashboard.contract.probation_ends_at)
  }, [dashboard?.contract])

  const artistSplitPct = useMemo(() => {
    if (!dashboard?.contract) return null
    return (dashboard.contract.artist_split_bps / 100).toFixed(0)
  }, [dashboard?.contract])

  const labelSplitPct = useMemo(() => {
    if (!dashboard?.contract) return null
    return (dashboard.contract.label_split_bps / 100).toFixed(0)
  }, [dashboard?.contract])

  if (!isArtist) {
    return (
      <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
        </div>

        <div className="relative mx-auto max-w-2xl px-4 py-16">
          <div className="flex justify-center mb-6">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded-full transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <Card className={`${MaiTrollTheme.components.card} text-center`}>
            <CardContent className="p-10">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20">
                <Mic2 className="h-8 w-8 text-purple-300" />
              </div>
              <CardTitle className="mb-3 text-white">
                Artist Access Required
              </CardTitle>
              <p className={MaiTrollTheme.text.muted}>
                This dashboard is only available to approved MAI Record Label artists.
                Apply to join the label to access your artist dashboard.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => navigate('/mai-record-label')}
                  className={MaiTrollTheme.components.buttonPrimary}
                >
                  <Music className="w-4 h-4 mr-2" />
                  MAI Record Label
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className={`${MaiTrollTheme.components.buttonSecondary} bg-transparent`}
                >
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-16">
          <div className="flex justify-center mb-8">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded-full transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <Card className={`${MaiTrollTheme.components.card}`}>
            <CardContent className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-300" />
              <span className="ml-3 text-slate-300">Loading your artist dashboard...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
        </div>

        <div className="relative mx-auto max-w-2xl px-4 py-16">
          <div className="flex justify-center mb-6">
            <button
              onClick={() => navigate(-1)}
              className={`p-2 rounded-full transition ${MaiTrollTheme.interactive.hover} hover:bg-white/10`}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <Card className={`${MaiTrollTheme.components.card} border-red-500/30 bg-red-500/5`}>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
                <Clock className="h-7 w-7 text-red-300" />
              </div>
              <CardTitle className="mb-2 text-white">
                Unable to Load Dashboard
              </CardTitle>
              <p className={MaiTrollTheme.text.muted}>
                {error || 'Something went wrong while loading your artist dashboard. Please try again later.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => {
                    setError(null)
                    setLoading(true)
                    if (user?.id) {
                      recordLabelService.getArtistDashboard(user.id).then(({ data, error: err }) => {
                        setLoading(false)
                        if (err) {
                          setError(err.message)
                        } else {
                          setDashboard(data)
                        }
                      })
                    }
                  }}
                  className={MaiTrollTheme.components.buttonPrimary}
                >
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/mai-record-label')}
                  className={`${MaiTrollTheme.components.buttonSecondary} bg-transparent`}
                >
                  <Music className="w-4 h-4 mr-2" />
                  MAI Record Label
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className={`mb-6 flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-white ${MaiTrollTheme.interactive.hover}`}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* Hero / Profile Header */}
        <section className={`relative overflow-hidden rounded-[32px] border border-purple-500/20 bg-gradient-to-br from-purple-950/90 via-slate-950 to-cyan-950/80 p-6 shadow-2xl md:p-10 lg:p-12`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.15),transparent_40%)]" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
                  <Mic2 size={29} className="text-purple-300" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
                    MAI Record Label
                  </span>
                  <h1 className="text-3xl font-black md:text-5xl text-white">
                    {dashboard.artist_id ? 'Artist Dashboard' : 'Dashboard'}
                  </h1>
                </div>
              </div>

              <h2 className="text-2xl font-black leading-tight md:text-4xl text-white">
                Welcome back,
                <span className={MaiTrollTheme.text.gradient}> Artist</span>.
              </h2>

              <p className={`mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base`}>
                Here&apos;s a snapshot of your music career, earnings, and catalog on MAI Record Label.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <HeroStat
                icon={<BadgeCheck size={20} />}
                value={dashboard.contract ? tierLabel(dashboard.contract.tier) : 'N/A'}
                label="Contract Tier"
              />
              <HeroStat
                icon={<Music size={20} />}
                value={dashboard.stats.total_tracks.toString()}
                label="Total Tracks"
              />
              <HeroStat
                icon={<Disc3 size={20} />}
                value={dashboard.stats.total_albums.toString()}
                label="Total Albums"
              />
              <HeroStat
                icon={<Play size={20} />}
                value={dashboard.stats.total_plays.toLocaleString()}
                label="Total Plays"
              />
            </div>
          </div>
        </section>

        {/* Artist Status + Probation Banner */}
        {dashboard.contract && (
          <section className="mt-6">
            <div className="flex flex-wrap gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${statusColor(dashboard.contract.status === 'active' ? 'active' : 'probation')}`}>
                <CheckCircle2 size={13} />
                {dashboard.contract.status === 'active' ? 'Active' : 'Pending Signature'}
              </span>
              {dashboard.contract.tier === 'probation' && remainingDays !== null && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300 border-amber-400/30 bg-amber-500/10`}>
                  <CalendarDays size={13} />
                  {remainingDays} day{remainingDays !== 1 ? 's' : ''} probation left
                </span>
              )}
              {dashboard.contract.tier !== 'probation' && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${tierColor(dashboard.contract.tier)}`}>
                  <BadgeCheck size={13} />
                  {tierLabel(dashboard.contract.tier)}
                </span>
              )}
            </div>
          </section>
        )}

        {/* Earnings Section */}
        <section className="mt-8">
          <SectionHeading
            eyebrow="Financials"
            title="Your Earnings"
            description="Track your available, pending, and lifetime earnings as a MAI artist."
          />

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              icon={<Coins size={22} />}
              label="Available Earnings"
              value={formatCoins(dashboard.balance.available_coins)}
              accent="text-emerald-300"
            />
            <StatCard
              icon={<Clock size={22} />}
              label="Pending Earnings"
              value={formatCoins(dashboard.balance.pending_coins)}
              accent="text-amber-300"
            />
            <StatCard
              icon={<TrendingUp size={22} />}
              label="Lifetime Earnings"
              value={formatCoins(dashboard.balance.lifetime_artist_coins)}
              accent="text-purple-300"
            />
          </div>
        </section>

        {/* Stats Section */}
        <section className="mt-8">
          <SectionHeading
            eyebrow="Catalog Performance"
            title="Your Stats"
            description="Track engagement across your entire catalog."
          />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Music size={20} />}
              label="Total Tracks"
              value={dashboard.stats.total_tracks.toString()}
              accent="text-purple-300"
            />
            <StatCard
              icon={<Disc3 size={20} />}
              label="Total Albums"
              value={dashboard.stats.total_albums.toString()}
              accent="text-cyan-300"
            />
            <StatCard
              icon={<Play size={20} />}
              label="Total Plays"
              value={dashboard.stats.total_plays.toLocaleString()}
              accent="text-blue-300"
            />
            <StatCard
              icon={<Heart size={20} />}
              label="Total Likes"
              value={dashboard.stats.total_likes.toLocaleString()}
              accent="text-pink-300"
            />
            <StatCard
              icon={<Heart size={20} />}
              label="Total Tips"
              value={dashboard.stats.total_tips.toLocaleString()}
              accent="text-yellow-300"
            />
          </div>
        </section>

        {/* Contract / Split Section */}
        {dashboard.contract && (
          <section className="mt-8">
            <SectionHeading
              eyebrow="Agreement"
              title="Your Contract"
              description="Current split percentages and contract terms."
            />

            <Card className={`${MaiTrollTheme.components.card}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-white">Contract Details</CardTitle>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${tierColor(dashboard.contract.tier)}`}>
                    {tierLabel(dashboard.contract.tier)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={`${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass} rounded-xl p-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted} mb-1`}>Contract Number</p>
                    <p className="font-mono text-sm text-white">{dashboard.contract.contract_number}</p>
                  </div>
                  <div className={`${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass} rounded-xl p-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted} mb-1`}>Effective Date</p>
                    <p className="text-sm text-white">
                      {new Date(dashboard.contract.effective_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass} rounded-xl p-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted} mb-1`}>Artist Split</p>
                    <p className="text-2xl font-black text-white">
                      {artistSplitPct}%
                    </p>
                  </div>
                  <div className={`${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass} rounded-xl p-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted} mb-1`}>Label Split</p>
                    <p className="text-2xl font-black text-white">
                      {labelSplitPct}%
                    </p>
                  </div>
                </div>

                {dashboard.contract.probation_ends_at && (
                  <div className={`mt-4 ${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass} rounded-xl p-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted} mb-1`}>
                      Probation Ends
                    </p>
                    <p className="text-sm text-white">
                      {new Date(dashboard.contract.probation_ends_at).toLocaleDateString()}
                      {remainingDays !== null && (
                        <span className="ml-2 text-amber-300">
                          ({remainingDays} day{remainingDays !== 1 ? 's' : ''} remaining)
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Actions */}
        <section className="mt-8">
          <SectionHeading
            eyebrow="Quick Actions"
            title="Manage Your Music"
            description="Upload tracks, create albums, check earnings, and more."
          />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <ActionButton
              icon={<Upload size={20} />}
              label="Upload Track"
              onClick={() => navigate('/artist/upload-track')}
            />
            <ActionButton
              icon={<Disc3 size={20} />}
              label="Create Album"
              onClick={() => navigate('/artist/create-album')}
            />
            <ActionButton
              icon={<User size={20} />}
              label="View Profile"
              onClick={() => navigate(`/profile/${profile?.username || dashboard.artist_id}`)}
            />
            <ActionButton
              icon={<Coins size={20} />}
              label="Earnings"
              onClick={() => navigate('/artist/earnings')}
            />
            <ActionButton
              icon={<FileText size={20} />}
              label="Contract"
              onClick={() => navigate('/artist/contract')}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-300">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">{title}</h2>
      {description && <p className={`mt-2 text-sm ${MaiTrollTheme.text.muted}`}>{description}</p>}
    </div>
  )
}

function HeroStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur`}>
      <div className="text-purple-300">{icon}</div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className={`mt-1 text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted}`}>
        {label}
      </p>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-5 transition-all duration-300 hover:border-white/[0.14]`}>
      <div className={`mb-3 ${accent}`}>{icon}</div>
      <p className={`text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted} mb-1`}>
        {label}
      </p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center transition-all duration-300 hover:border-purple-400/30 hover:bg-white/[0.08] hover:-translate-y-px ${MaiTrollTheme.interactive.hover}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
        {icon}
      </div>
      <span className="text-xs font-black uppercase tracking-wider text-slate-200">{label}</span>
    </button>
  )
}
