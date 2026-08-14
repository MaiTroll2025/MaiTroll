import React, { useState, useEffect, useCallback } from 'react'
import { supabase, UserRole } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import RequireRole from '@/components/RequireRole'
import * as recordLabelService from '@/services/maiRecordLabel'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Users,
  FileText,
  Music,
  FileSignature,
  Disc3,
  ListMusic,
  TrendingUp,
  DollarSign,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Heart,
  Coins,
  Loader2,
  Wallet,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface ArtistWithProfile {
  id: string
  user_id: string
  stage_name: string
  bio?: string | null
  primary_genre?: string | null
  genres: string[]
  artist_image_url?: string | null
  verified: boolean
  status: string
  created_at: string
  user_profiles?: {
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
}

interface ContractWithDetails {
  id: string
  artist_id: string
  contract_number: string
  tier: string
  artist_split_bps: number
  label_split_bps: number
  effective_at: string
  probation_ends_at?: string | null
  expires_at?: string | null
  status: string
  terms_version: string
  artist_signed_at?: string | null
  mai_accepted_at?: string | null
  created_at: string
  artist?: ArtistWithProfile | null
}

interface AlbumWithDetails {
  id: string
  artist_id: string
  title: string
  description?: string | null
  cover_url?: string | null
  status: string
  release_date?: string | null
  published_at?: string | null
  created_at: string
  artist?: ArtistWithProfile | null
}

interface TrackWithDetails {
  id: string
  artist_id: string
  album_id?: string | null
  title: string
  genre?: string | null
  duration_seconds?: number | null
  explicit: boolean
  status: string
  like_count: number
  play_count: number
  tip_coins: number
  published_at?: string | null
  created_at: string
  artist?: ArtistWithProfile | null
  album?: { title: string } | null
}

interface TransactionRow {
  id: string
  artist_id: string
  track_id?: string | null
  album_id?: string | null
  contract_id?: string | null
  transaction_type: string
  gross_coins: number
  artist_split_bps: number
  label_split_bps: number
  artist_coins: number
  label_coins: number
  cashout_eligible: boolean
  status: string
  metadata?: Record<string, any>
  created_at: string
  artist?: { stage_name: string } | null
}

type TabId = 'overview' | 'applications' | 'artists' | 'contracts' | 'releases' | 'tracks' | 'earnings' | 'payouts'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-300 border-green-500/30',
  declined: 'bg-red-500/20 text-red-300 border-red-500/30',
  withdrawn: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  probation: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  suspended: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  terminated: 'bg-red-500/20 text-red-300 border-red-500/30',
  published: 'bg-green-500/20 text-green-300 border-green-500/30',
  draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  processing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  archived: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  pending_signature: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  superseded: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  reversed: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
}

const TIER_COLORS: Record<string, string> = {
  probation: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  standard: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  tier_90_10: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  tier_95_5: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  color: string
}) {
  return (
    <Card className="bg-[#141414] border-[#2C2C2C]">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminMaiRecordLabel() {
  const { profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [applications, setApplications] = useState<any[]>([])
  const [artists, setArtists] = useState<ArtistWithProfile[]>([])
  const [contracts, setContracts] = useState<ContractWithDetails[]>([])
  const [albums, setAlbums] = useState<AlbumWithDetails[]>([])
  const [tracks, setTracks] = useState<TrackWithDetails[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [earnings, setEarnings] = useState({ artist: 0, label: 0 })

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, appsRes, artistsRes, contractsRes, albumsRes, tracksRes, txsRes] = await Promise.all([
        recordLabelService.getAdminMaiStats(),
        recordLabelService.getApplications(),
        supabase
          .from('record_label_artist_profiles')
          .select('*, user_profiles:user_id(username, display_name, avatar_url)')
          .order('created_at', { ascending: false }),
        supabase
          .from('record_label_contracts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('record_label_albums')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('record_label_tracks')
          .select(
            '*, artist:record_label_artist_profiles!inner(id, stage_name), album:record_label_albums(title)',
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('record_label_transactions')
          .select('*, artist:record_label_artist_profiles!inner(stage_name)')
          .order('created_at', { ascending: false }),
      ])

      if (statsRes.error) throw statsRes.error
      setStats(statsRes.data)

      if (appsRes.error) throw appsRes.error
      const appsData = appsRes.data || []
      setApplications(appsData)
      setPendingCount(appsData.filter((a: any) => a.status === 'pending').length)

      if (artistsRes.error) throw artistsRes.error
      setArtists(artistsRes.data || [])

      if (contractsRes.error) throw contractsRes.error
      setContracts(contractsRes.data || [])

      if (albumsRes.error) throw albumsRes.error
      setAlbums(albumsRes.data || [])

      if (tracksRes.error) throw tracksRes.error
      setTracks(tracksRes.data || [])

      if (txsRes.error) throw txsRes.error
      const txData = txsRes.data || []
      setTransactions(txData)
      setEarnings({
        artist: txData.reduce((sum, t) => sum + (t.artist_coins || 0), 0),
        label: txData.reduce((sum, t) => sum + (t.label_coins || 0), 0),
      })
    } catch (err: unknown) {
      console.error('Failed to load MAI Record Label admin data:', err)
      const message = err instanceof Error ? err.message : 'Failed to load data'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const channel = supabase
      .channel('mai-record-label-pending-apps')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'record_label_applications' },
        () => {
          loadAll()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadAll])

  const handleApprove = async (applicationId: string) => {
    if (!profile?.id) return
    const { error } = await recordLabelService.approveApplication(applicationId, profile.id)
    if (error) {
      toast.error(error.message || 'Failed to approve application')
      return
    }
    toast.success('Application approved')
    loadAll()
  }

  const handleDecline = async (applicationId: string) => {
    if (!profile?.id) return
    const reason = prompt('Decline reason:')
    if (reason === null) return
    const { error } = await recordLabelService.declineApplication(applicationId, profile.id, reason || undefined)
    if (error) {
      toast.error(error.message || 'Failed to decline application')
      return
    }
    toast.success('Application declined')
    loadAll()
  }

  const approvedArtistsCount = applications.filter((a: any) => a.status === 'approved').length

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <RequireRole roles={[UserRole.ADMIN]}>
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white px-4 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <header>
            <p className="text-sm text-gray-400 uppercase tracking-[0.4em]">Admin Dashboard</p>
            <h1 className="text-3xl font-bold">MAI Record Label</h1>
            <p className="text-sm text-gray-400">
              Manage artists, applications, contracts, releases, and earnings.
            </p>
          </header>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
            <TabsList className="bg-black/30 border border-gray-800">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
              <TabsTrigger value="artists">Artists</TabsTrigger>
              <TabsTrigger value="contracts">Contracts</TabsTrigger>
              <TabsTrigger value="releases">Releases</TabsTrigger>
              <TabsTrigger value="tracks">Tracks</TabsTrigger>
              <TabsTrigger value="earnings">Earnings</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <StatCard
                  title="Pending Applications"
                  value={pendingCount}
                  icon={FileText}
                  color="bg-yellow-500/20 text-yellow-300"
                />
                <StatCard
                  title="Active Artists"
                  value={stats?.active_artists || 0}
                  icon={Users}
                  color="bg-green-500/20 text-green-300"
                />
                <StatCard
                  title="Probation Artists"
                  value={stats?.probation_artists || 0}
                  icon={Clock}
                  color="bg-blue-500/20 text-blue-300"
                />
                <StatCard
                  title="Approved Artists"
                  value={approvedArtistsCount}
                  icon={CheckCircle2}
                  color="bg-emerald-500/20 text-emerald-300"
                />
                <StatCard
                  title="Total Albums"
                  value={stats?.total_albums || 0}
                  icon={Disc3}
                  color="bg-purple-500/20 text-purple-300"
                />
                <StatCard
                  title="Total Tracks"
                  value={stats?.total_tracks || 0}
                  icon={Music}
                  color="bg-pink-500/20 text-pink-300"
                />
                <StatCard
                  title="Total Track Plays"
                  value={stats?.total_plays || 0}
                  icon={Play}
                  color="bg-cyan-500/20 text-cyan-300"
                />
                <StatCard
                  title="Total Track Likes"
                  value={stats?.total_likes || 0}
                  icon={Heart}
                  color="bg-red-500/20 text-red-300"
                />
                <StatCard
                  title="Total Listener Tips"
                  value={stats?.total_tips || 0}
                  icon={Coins}
                  color="bg-amber-500/20 text-amber-300"
                />
                <StatCard
                  title="Artist Earnings"
                  value={earnings.artist.toLocaleString()}
                  icon={Wallet}
                  color="bg-green-500/20 text-green-300"
                />
                <StatCard
                  title="MAI Label Earnings"
                  value={earnings.label.toLocaleString()}
                  icon={TrendingUp}
                  color="bg-indigo-500/20 text-indigo-300"
                />
              </div>
            </TabsContent>

            <TabsContent value="applications">
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle>Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Avatar</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Legal Name</TableHead>
                        <TableHead>Stage Name</TableHead>
                        <TableHead>Genre</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                            No applications found
                          </TableCell>
                        </TableRow>
                      ) : (
                        applications.map((app: any) => (
                          <TableRow key={app.id}>
                            <TableCell>
                              {app.user_profiles?.avatar_url ? (
                                <img
                                  src={app.user_profiles.avatar_url}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300">
                                  {app.user_profiles?.username?.[0]?.toUpperCase() || '?'}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{app.user_profiles?.username || '—'}</TableCell>
                            <TableCell>{app.legal_name}</TableCell>
                            <TableCell>{app.stage_name}</TableCell>
                            <TableCell>{app.primary_genre}</TableCell>
                            <TableCell>{format(new Date(app.created_at), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_COLORS[app.status] || 'border-gray-500 text-gray-300'}
                              >
                                {app.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toast.info(`Application ${app.id}`)}
                                  className="text-gray-300 hover:text-white"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {app.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => handleApprove(app.id)}
                                      className="bg-green-600 hover:bg-green-500 text-white"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDecline(app.id)}
                                      className="bg-red-600 hover:bg-red-500 text-white"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="artists">
              {artists.length === 0 ? (
                <Card className="bg-[#141414] border-[#2C2C2C]">
                  <CardContent className="py-12 text-center text-gray-400">
                    No artists found
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {artists.map((artist) => (
                    <Card key={artist.id} className="bg-[#141414] border-[#2C2C2C]">
                      <CardContent className="p-4 flex items-center gap-4">
                        {artist.artist_image_url || artist.user_profiles?.avatar_url ? (
                          <img
                            src={artist.artist_image_url || artist.user_profiles?.avatar_url}
                            alt={artist.stage_name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-lg text-gray-300">
                            {artist.stage_name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{artist.stage_name}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {artist.user_profiles?.username || '—'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={STATUS_COLORS[artist.status] || 'border-gray-500 text-gray-300'}
                            >
                              {artist.status}
                            </Badge>
                            {artist.verified && (
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                                Verified
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="contracts">
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle>Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract #</TableHead>
                        <TableHead>Artist</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Split</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Effective</TableHead>
                        <TableHead>Probation Ends</TableHead>
                        <TableHead>Expires</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                            No contracts found
                          </TableCell>
                        </TableRow>
                      ) : (
                        contracts.map((contract) => (
                          <TableRow key={contract.id}>
                            <TableCell className="font-mono text-xs">
                              {contract.contract_number}
                            </TableCell>
                            <TableCell>
                              {contract.artist?.stage_name || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={TIER_COLORS[contract.tier] || 'border-gray-500 text-gray-300'}
                              >
                                {contract.tier.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {(contract.artist_split_bps / 100).toFixed(0)}% /{' '}
                              {(contract.label_split_bps / 100).toFixed(0)}%
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_COLORS[contract.status] || 'border-gray-500 text-gray-300'}
                              >
                                {contract.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(contract.effective_at), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              {contract.probation_ends_at
                                ? format(new Date(contract.probation_ends_at), 'MMM d, yyyy')
                                : '—'}
                            </TableCell>
                            <TableCell>
                              {contract.expires_at
                                ? format(new Date(contract.expires_at), 'MMM d, yyyy')
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="releases">
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle>Releases</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Artist</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Release Date</TableHead>
                        <TableHead>Published</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {albums.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                            No releases found
                          </TableCell>
                        </TableRow>
                      ) : (
                        albums.map((album) => (
                          <TableRow key={album.id}>
                            <TableCell className="font-medium text-white">
                              {album.title}
                            </TableCell>
                            <TableCell>{album.artist?.stage_name || '—'}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_COLORS[album.status] || 'border-gray-500 text-gray-300'}
                              >
                                {album.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {album.release_date
                                ? format(new Date(album.release_date), 'MMM d, yyyy')
                                : '—'}
                            </TableCell>
                            <TableCell>
                              {album.published_at
                                ? format(new Date(album.published_at), 'MMM d, yyyy')
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tracks">
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle>Tracks</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Artist</TableHead>
                        <TableHead>Album</TableHead>
                        <TableHead>Genre</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Plays</TableHead>
                        <TableHead>Likes</TableHead>
                        <TableHead>Tips</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tracks.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                            No tracks found
                          </TableCell>
                        </TableRow>
                      ) : (
                        tracks.map((track) => (
                          <TableRow key={track.id}>
                            <TableCell className="font-medium text-white">{track.title}</TableCell>
                            <TableCell>{track.artist?.stage_name || '—'}</TableCell>
                            <TableCell>{track.album?.title || '—'}</TableCell>
                            <TableCell>{track.genre || '—'}</TableCell>
                            <TableCell>
                              {track.duration_seconds
                                ? `${Math.floor(track.duration_seconds / 60)}:${String(track.duration_seconds % 60).padStart(2, '0')}`
                                : '—'}
                            </TableCell>
                            <TableCell>{track.play_count.toLocaleString()}</TableCell>
                            <TableCell>{track.like_count.toLocaleString()}</TableCell>
                            <TableCell>{track.tip_coins.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_COLORS[track.status] || 'border-gray-500 text-gray-300'}
                              >
                                {track.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="earnings">
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle>Transaction Ledger</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Artist</TableHead>
                        <TableHead>Track / Album</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Artist Split</TableHead>
                        <TableHead>Label Split</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                            </TableCell>
                            <TableCell className="capitalize">
                              {tx.transaction_type.replace('_', ' ')}
                            </TableCell>
                            <TableCell>{tx.artist?.stage_name || '—'}</TableCell>
                            <TableCell>
                              {tx.track_id || tx.album_id || '—'}
                            </TableCell>
                            <TableCell>{tx.gross_coins.toLocaleString()}</TableCell>
                            <TableCell>
                              {(tx.artist_split_bps / 100).toFixed(0)}% (
                              {tx.artist_coins.toLocaleString()})
                            </TableCell>
                            <TableCell>
                              {(tx.label_split_bps / 100).toFixed(0)}% (
                              {tx.label_coins.toLocaleString()})
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_COLORS[tx.status] || 'border-gray-500 text-gray-300'}
                              >
                                {tx.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payouts">
              <Card className="bg-[#141414] border-[#2C2C2C]">
                <CardHeader>
                  <CardTitle>Payouts</CardTitle>
                </CardHeader>
                <CardContent className="py-12 text-center text-gray-400">
                  <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p>Payout management is coming soon.</p>
                  <p className="text-sm mt-2">
                    Use the earnings ledger above to review transactions and balances.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </RequireRole>
  )
}
