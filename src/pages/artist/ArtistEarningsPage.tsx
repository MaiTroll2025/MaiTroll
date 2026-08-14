import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import * as recordLabelService from '@/services/maiRecordLabel'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Clock,
  Coins,
  DollarSign,
  Loader2,
  Music,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type TransactionType = 'artist_tip' | 'track_tip' | 'track_revenue' | 'album_revenue' | 'adjustment' | 'bonus'

function formatCoins(value: number): string {
  return value.toLocaleString()
}

function transactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'artist_tip':
      return 'Artist Tip'
    case 'track_tip':
      return 'Track Tip'
    case 'track_revenue':
      return 'Track Revenue'
    case 'album_revenue':
      return 'Album Revenue'
    case 'adjustment':
      return 'Adjustment'
    case 'bonus':
      return 'Bonus'
    default:
      return type
  }
}

function transactionTypeBadgeClass(type: TransactionType): string {
  switch (type) {
    case 'artist_tip':
      return 'bg-purple-500/10 text-purple-300 border-purple-500/15'
    case 'track_tip':
      return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/15'
    case 'track_revenue':
      return 'bg-green-500/10 text-green-300 border-green-500/15'
    case 'album_revenue':
      return 'bg-pink-500/10 text-pink-300 border-pink-500/15'
    case 'adjustment':
      return 'bg-amber-500/10 text-amber-300 border-amber-500/15'
    case 'bonus':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/15'
    default:
      return 'bg-slate-500/10 text-slate-300 border-slate-500/15'
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function ArtistEarningsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<{
    available_coins: number
    pending_coins: number
    lifetime_artist_coins: number
    lifetime_gross_coins: number
  } | null>(null)
  const [transactions, setTransactions] = useState<
    Array<{
      id: string
      transaction_type: TransactionType
      gross_coins: number
      artist_coins: number
      label_coins: number
      track_title?: string | null
      created_at: string
    }>
  >([])
  const [artistProfile, setArtistProfile] = useState<recordLabelService.RecordLabelArtistProfile | null>(null)

  const isArtist = (profile as any)?.is_record_label_artist === true

  const load = async () => {
    if (!user?.id) {
      navigate('/auth', { replace: true })
      return
    }

    try {
      setLoading(true)
      setError(null)

      const artistResult = await recordLabelService.getArtistProfileByUserId(user.id)

      const artist = artistResult.data
      if (!artist) {
        toast.error('You must be an approved MAI artist to view this page.')
        navigate('/mai-record-label', { replace: true })
        return
      }

      const [dashboardResult, txResult] = await Promise.all([
        recordLabelService.getArtistDashboard(user.id),
        supabase
          .from('record_label_transactions')
          .select('id, transaction_type, gross_coins, artist_coins, label_coins, track_id, album_id, created_at')
          .eq('artist_id', artist.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      if (dashboardResult.error) {
        throw dashboardResult.error
      }

      setBalance(dashboardResult.data?.balance || null)

      if (txResult.error) {
        throw txResult.error
      }

      const rawTransactions = txResult.data || []

      const trackIds = [...new Set(rawTransactions.filter((t) => t.track_id).map((t) => t.track_id as string))]
      const albumIds = [...new Set(rawTransactions.filter((t) => t.album_id).map((t) => t.album_id as string))]

      const [trackRes, albumRes] = await Promise.all([
        trackIds.length > 0
          ? supabase.from('record_label_tracks').select('id, title').in('id', trackIds)
          : Promise.resolve({ data: [] as any[] }),
        albumIds.length > 0
          ? supabase.from('record_label_albums').select('id, title').in('id', albumIds)
          : Promise.resolve({ data: [] as any[] }),
      ])

      const trackMap = new Map((trackRes.data || []).map((t) => [t.id, t.title]))
      const albumMap = new Map((albumRes.data || []).map((a) => [a.id, a.title]))

      const enriched = rawTransactions.map((tx) => ({
        id: tx.id,
        transaction_type: tx.transaction_type as TransactionType,
        gross_coins: tx.gross_coins || 0,
        artist_coins: tx.artist_coins || 0,
        label_coins: tx.label_coins || 0,
        track_title: tx.track_id ? trackMap.get(tx.track_id) || null : tx.album_id ? albumMap.get(tx.album_id) || null : null,
        created_at: tx.created_at,
      }))

      setTransactions(enriched)
      setArtistProfile(artist)
    } catch (err: any) {
      console.error('[ArtistEarningsPage] Failed to load:', err)
      setError(err?.message || 'Failed to load earnings data')
      toast.error(err?.message || 'Failed to load earnings data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    load()
    return () => {
      active = false
    }
  }, [user?.id])

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
                <Music className="h-8 w-8 text-purple-300" />
              </div>
              <CardTitle className="mb-3 text-white">
                Artist Access Required
              </CardTitle>
              <p className={MaiTrollTheme.text.muted}>
                This page is only available to approved MAI Record Label artists.
                Apply to join the label to access your earnings.
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
              <span className="ml-3 text-slate-300">Loading your earnings...</span>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !balance) {
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
                <AlertCircle className="h-7 w-7 text-red-300" />
              </div>
              <CardTitle className="mb-2 text-white">
                Unable to Load Earnings
              </CardTitle>
              <p className={MaiTrollTheme.text.muted}>
                {error || 'Something went wrong while loading your earnings. Please try again later.'}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={() => load()}
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
        <button
          onClick={() => navigate(-1)}
          className={`mb-6 flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-white ${MaiTrollTheme.interactive.hover}`}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <section className={`relative overflow-hidden rounded-[32px] border border-purple-500/20 bg-gradient-to-br from-purple-950/90 via-slate-950 to-cyan-950/80 p-6 shadow-2xl md:p-10 lg:p-12`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.15),transparent_40%)]" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
                  <DollarSign size={29} className="text-purple-300" />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
                    MAI Record Label
                  </span>
                  <h1 className="text-3xl font-black md:text-5xl text-white">
                    Artist Earnings
                  </h1>
                </div>
              </div>

              <h2 className="text-2xl font-black leading-tight md:text-4xl text-white">
                Your Earnings,
                <span className={MaiTrollTheme.text.gradient}> At a Glance.</span>
              </h2>

              <p className={`mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base`}>
                Track your available, pending, lifetime, and gross earnings as a MAI Record Label artist.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <HeroStat
                icon={<DollarSign size={20} />}
                value={formatCoins(balance.available_coins)}
                label="Available"
              />
              <HeroStat
                icon={<Clock size={20} />}
                value={formatCoins(balance.pending_coins)}
                label="Pending"
              />
              <HeroStat
                icon={<TrendingUp size={20} />}
                value={formatCoins(balance.lifetime_artist_coins)}
                label="Lifetime"
              />
              <HeroStat
                icon={<Coins size={20} />}
                value={formatCoins(balance.lifetime_gross_coins)}
                label="Lifetime Gross"
              />
            </div>
          </div>
        </section>

        <section className="mt-8">
          <SectionHeading
            eyebrow="Activity"
            title="Recent Transactions"
            description="Your latest earnings activity on MAI Record Label."
          />

          <Card className={`${MaiTrollTheme.components.card}`}>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className={MaiTrollTheme.text.muted}>No transactions yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Track</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Artist</TableHead>
                      <TableHead className="text-right">Label</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge variant="outline" className={transactionTypeBadgeClass(tx.transaction_type)}>
                            {transactionTypeLabel(tx.transaction_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-white">
                          {tx.track_title || '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-300">
                          {formatCoins(tx.gross_coins)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-300">
                          {formatCoins(tx.artist_coins)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-pink-300">
                          {formatCoins(tx.label_coins)}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatDate(tx.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
    <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-4 transition-all duration-300 hover:border-white/[0.14]`}>
      <div className="text-purple-300">{icon}</div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className={`mt-1 text-xs font-bold uppercase tracking-wider ${MaiTrollTheme.text.muted}`}>
        {label}
      </p>
    </div>
  )
}
