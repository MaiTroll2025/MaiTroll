import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import * as recordLabelService from '@/services/maiRecordLabel'
import { toast } from 'sonner'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Play,
  Heart,
  Music,
  Disc3,
  Loader2,
  Clock,
  Gift,
  Coins,
} from 'lucide-react'
import AudioPlayer from '@/components/media/AudioPlayer'
import { useAuthStore } from '@/lib/store'
import { Song, TIP_AMOUNTS } from '@/types/media'

type Track = {
  id: string
  artist_id: string
  album_id?: string | null
  title: string
  description?: string | null
  audio_url?: string | null
  cover_url?: string | null
  genre?: string | null
  duration_seconds?: number | null
  explicit: boolean
  status: string
  like_count: number
  play_count: number
  tip_coins: number
  published_at?: string | null
  created_at: string
  updated_at: string
  artist?: {
    id: string
    stage_name: string
    bio?: string | null
    primary_genre?: string | null
    genres: string[]
    artist_image_url?: string | null
    verified: boolean
    status: string
    user_profiles?: {
      username?: string | null
      display_name?: string | null
      avatar_url?: string | null
    } | null
  } | null
  album?: {
    id: string
    title: string
    cover_url?: string | null
    status: string
  } | null
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const [track, setTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [queue, setQueue] = useState<Track[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [tipAmount, setTipAmount] = useState<number | null>(null)
  const [isTipping, setIsTipping] = useState(false)

  const getPurchasedKey = useCallback(() => {
    if (!profile?.id) return ''
    return `purchased_tracks_${profile.id}`
  }, [profile?.id])

  const hasPurchased = useCallback((id: string) => {
    try {
      const key = getPurchasedKey()
      if (!key) return false
      const raw = localStorage.getItem(key)
      const list: string[] = raw ? JSON.parse(raw) : []
      return list.includes(id)
    } catch {
      return false
    }
  }, [getPurchasedKey])

  const markPurchased = useCallback((id: string) => {
    try {
      const key = getPurchasedKey()
      if (!key) return
      const raw = localStorage.getItem(key)
      const list: string[] = raw ? JSON.parse(raw) : []
      if (!list.includes(id)) {
        list.push(id)
        localStorage.setItem(key, JSON.stringify(list))
      }
    } catch {
      // ignore storage errors
    }
  }, [getPurchasedKey])

  useEffect(() => {
    if (!trackId) return
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        const { data } = await recordLabelService.getTrack(trackId)

        if (!active) return
        setTrack((data as Track | null) ?? null)
        if (data) {
          setQueue([data as Track])
          setCurrentIndex(0)
        }
      } catch (error) {
        console.error('[TrackPage] Failed to load:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [trackId])

  const handlePlay = async () => {
    if (!track || !trackId) return

    try {
      if (!hasPurchased(trackId)) {
        const { data, error } = await supabase.rpc('play_mai_track', {
          p_track_id: trackId,
        })

        if (error) throw error
        if (!data?.success) throw new Error(data?.error || 'Failed to play track')

        const listenerPaid = data?.listener_paid || 0
        if (listenerPaid > 0) {
          markPurchased(trackId)
          toast.success(`Now Playing: ${track.title} (${listenerPaid} Troll Coins used)`)
        } else {
          toast.success(`Now Playing: ${track.title}`)
        }
      } else {
        toast.success(`Now Playing: ${track.title}`)
      }

      setIsPlaying(true)
      setShowPlayer(true)
    } catch (err: any) {
      setIsPlaying(false)
      toast.error(err?.message || 'Failed to play track')
    }
  }

  const handleLike = async () => {
    if (!trackId) return

    if (isLiked) {
      toast.error("You can't like twice silly")
      return
    }

    try {
      await recordLabelService.likeTrack(trackId)
      setIsLiked(true)
      setTrack((prev) => (prev ? { ...prev, like_count: prev.like_count + 1 } : null))
    } catch (error) {
      console.error('[TrackPage] Like error:', error)
      toast.error('You cant like twice silly lol')
    }
  }

  const handleTip = () => {
    setShowTipModal(true)
  }

  const handleSendTip = async () => {
    if (!tipAmount || !track?.artist_id || !profile?.id) return

    setIsTipping(true)
    try {
      const { error } = await recordLabelService.tipArtist({
        artistId: track.artist_id,
        grossCoins: tipAmount,
        payerUserId: profile.id,
        trackId: track.id,
      })

      if (error) throw error
      toast.success(`Sent ${tipAmount} Troll Coins!`)
      setTrack((prev) => (prev ? { ...prev, tip_coins: prev.tip_coins + tipAmount } : null))
      if (profile?.id) {
        const { refreshProfile } = useAuthStore.getState()
        refreshProfile?.()
      }
      setShowTipModal(false)
      setTipAmount(null)
    } catch (err: any) {
      toast.error(err.message || 'Failed to send tip')
    } finally {
      setIsTipping(false)
    }
  }

  const handleChangeSong = (index: number) => {
    if (queue[index]) {
      setCurrentIndex(index)
      const newTrack = queue[index]
      setTrack(newTrack)
      const song = toSong(newTrack)
      if (song.audio_url) {
        setIsPlaying(true)
      }
    }
  }

  const handleIsPlayingChange = (playing: boolean) => {
    setIsPlaying(playing)
  }

  const handleClosePlayer = () => {
    setIsPlaying(false)
  }

  const toSong = (t: Track): Song =>
    ({
      id: t.id,
      artist_id: t.artist_id,
      user_id: t.artist_id,
      album_id: t.album_id || undefined,
      label_id: undefined,
      title: t.title,
      description: t.description || undefined,
      audio_url: t.audio_url || '',
      cover_url: t.cover_url || undefined,
      duration: t.duration_seconds || undefined,
      genre: t.genre || undefined,
      bpm: undefined,
      key_signature: undefined,
      isrc_code: undefined,
      track_number: undefined,
      plays: t.play_count,
      unique_plays: 0,
      tips_total: t.tip_coins,
      likes_count: t.like_count,
      comments_count: 0,
      shares_count: 0,
      is_published: t.status === 'published',
      is_explicit: t.explicit,
      featured: false,
      allow_tips: true,
      allow_downloads: false,
      metadata: {},
      created_at: t.created_at,
      updated_at: t.updated_at,
      published_at: t.published_at || undefined,
      is_liked: false,
      artist: t.artist
        ? {
            id: t.artist.id,
            user_id: t.artist_id,
            artist_name: t.artist.stage_name,
            bio: t.artist.bio || undefined,
            profile_banner_url: undefined,
            avatar_url: t.artist.user_profiles?.avatar_url || t.artist.artist_image_url || undefined,
            verified: t.artist.verified,
            followers_count: 0,
            total_plays: 0,
            total_tips: 0,
            coins_earned: 0,
            label_id: undefined,
            genre: t.artist.primary_genre || undefined,
            location: undefined,
            website_url: undefined,
            social_links: {},
            is_active: true,
            created_at: t.created_at,
            updated_at: t.updated_at,
          }
        : undefined,
      album: t.album
        ? {
            id: t.album.id,
            artist_id: t.artist_id,
            user_id: t.artist_id,
            title: t.album.title,
            description: undefined,
            cover_url: t.album.cover_url || undefined,
            release_type: 'single',
            genre: undefined,
            release_date: undefined,
            total_tracks: 1,
            total_plays: 0,
            total_tips: 0,
            is_published: t.album.status === 'published',
            label_id: undefined,
            featured: false,
            created_at: t.created_at,
            updated_at: t.updated_at,
          }
        : undefined,
      label: undefined,
    }) as Song

  const songForPlayer: Song = track ? toSong(track) : {
    id: '',
    artist_id: '',
    user_id: '',
    album_id: undefined,
    label_id: undefined,
    title: '',
    description: undefined,
    audio_url: '',
    cover_url: undefined,
    duration: undefined,
    genre: undefined,
    bpm: undefined,
    key_signature: undefined,
    isrc_code: undefined,
    track_number: undefined,
    plays: 0,
    unique_plays: 0,
    tips_total: 0,
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    is_published: false,
    is_explicit: false,
    featured: false,
    allow_tips: false,
    allow_downloads: false,
    metadata: {},
    created_at: '',
    updated_at: '',
    published_at: undefined,
    is_liked: false,
    artist: undefined,
    album: undefined,
    label: undefined,
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
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-300" />
          </div>
        </div>
      </div>
    )
  }

  if (!track) {
    return (
      <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 py-16 text-center">
          <Music className="mx-auto mb-4 text-purple-300" size={48} />
          <h1 className="text-2xl font-black text-white">Track Not Found</h1>
          <p className="mt-2 text-slate-400">
            This track may not exist or is not published.
          </p>
          <Button
            onClick={() => navigate('/mai-record-label')}
            className={`mt-6 ${MaiTrollTheme.components.buttonPrimary}`}
          >
            Back to MAI Record Label
          </Button>
        </div>
      </div>
    )
  }

  const artistName = track.artist?.stage_name || 'Unknown Artist'
  const albumName = track.album?.title || 'Single'
  const artistUsername = track.artist?.user_profiles?.username

  return (
    <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
        <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 md:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className={`mb-6 flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-white ${MaiTrollTheme.interactive.hover}`}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <section
          className={`relative overflow-hidden rounded-[32px] border border-purple-500/20 bg-gradient-to-br from-purple-950/90 via-slate-950 to-cyan-950/80 p-6 shadow-2xl md:p-10 lg:p-12`}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.15),transparent_40%)]"
          />

          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end">
            <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl md:h-56 md:w-56">
              {track.cover_url ? (
                <img
                  src={track.cover_url}
                  alt={track.title}
                  className="h-full w-full object-cover"
                />
              ) : track.album?.cover_url ? (
                <img
                  src={track.album.cover_url}
                  alt={track.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-700/30 to-cyan-700/20">
                  <Music size={56} className="text-purple-300" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
                Track
              </span>
              <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">
                {track.title}
              </h1>
              <button
                onClick={() =>
                  artistUsername
                    ? navigate(`/profile/${artistUsername}`)
                    : navigate(`/profile/${track.artist_id}`)
                }
                className="mt-3 flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
              >
                <span className="font-bold">{artistName}</span>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Disc3 size={13} />
                  {albumName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={13} />
                  {formatDate(track.published_at)}
                </span>
                {track.genre && (
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                    {track.genre}
                  </Badge>
                )}
                {track.explicit && (
                  <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Explicit
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handlePlay}
              className={`${MaiTrollTheme.components.buttonPrimary}`}
            >
              <Play size={18} />
              {isPlaying ? 'Now Playing' : 'Play'}
            </Button>
            <Button
              onClick={handleLike}
              variant="outline"
              className={`${MaiTrollTheme.components.buttonSecondary} bg-transparent`}
            >
              <Heart size={18} className={isLiked ? 'fill-pink-400 text-pink-400' : ''} />
              {track.like_count.toLocaleString()}
            </Button>
            <Button
              variant="outline"
              className={`${MaiTrollTheme.components.buttonSecondary} bg-transparent`}
            >
              <Play size={18} />
              {track.play_count.toLocaleString()}
            </Button>
            <Button
              onClick={handleTip}
              variant="outline"
              className={`${MaiTrollTheme.components.buttonSecondary} bg-transparent flex flex-col items-center gap-1 py-3 px-4 h-auto`}
            >
              <div className="flex items-center gap-1">
                <Coins size={18} />
                <span className="font-bold">{track.tip_coins.toLocaleString()}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider opacity-70">Tip Artist</span>
            </Button>
          </div>
        </section>

        {track.description && (
          <section className="mt-8">
            <Card className={`${MaiTrollTheme.components.card}`}>
              <CardContent className="p-6">
                <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-purple-300">
                  About this track
                </h3>
                <p className="text-sm leading-relaxed text-slate-300">
                  {track.description}
                </p>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      {showTipModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className={`${MaiTrollTheme.backgrounds.card} border ${MaiTrollTheme.borders.glass} rounded-2xl p-6 max-w-md w-full`}>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-400" />
              Tip the Artist
            </h3>

            <div className="flex items-center gap-3 mb-6 p-3 bg-white/5 rounded-xl">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                {track?.artist?.stage_name?.[0] || '?'}
              </div>
              <div>
                <p className="font-medium text-white">{track?.title}</p>
                <p className="text-sm text-gray-400">{track?.artist?.stage_name}</p>
              </div>
            </div>

            <p className="text-sm text-gray-400 mb-3">Select amount:</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {TIP_AMOUNTS.map((tip) => (
                <button
                  key={tip.amount}
                  onClick={() => setTipAmount(tip.amount)}
                  className={`p-3 rounded-xl border transition-all ${
                    tipAmount === tip.amount
                      ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300'
                      : 'border-white/10 bg-white/5 text-gray-300 hover:border-white/20'
                  }`}
                >
                  {tip.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowTipModal(false); setTipAmount(null) }}
                className="flex-1"
                disabled={isTipping}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendTip}
                disabled={!tipAmount || isTipping}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400"
              >
                {isTipping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Tip ${tipAmount || 0} Coins`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPlayer && (
        <AudioPlayer
          song={songForPlayer}
          queue={queue.map(toSong)}
          currentIndex={currentIndex}
          isPlaying={isPlaying}
          onIsPlayingChange={handleIsPlayingChange}
          isMinimized={true}
          onMinimizeToggle={() => setShowPlayer(false)}
          onClose={() => { setShowPlayer(false); handleClosePlayer() }}
          onChangeSong={handleChangeSong}
        />
      )}
    </div>
  )
}
