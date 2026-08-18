import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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
} from 'lucide-react'

type Album = {
  id: string
  artist_id: string
  title: string
  description?: string | null
  cover_url?: string | null
  status: string
  release_date?: string | null
  published_at?: string | null
  created_at: string
  updated_at: string
  artist?: {
    id: string
    stage_name: string
    user_profiles?: {
      username?: string | null
      display_name?: string | null
      avatar_url?: string | null
    } | null
  } | null
}

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
  track_number?: number | null
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function AlbumPage() {
  const { albumId } = useParams<{ albumId: string }>()
  const navigate = useNavigate()

  const [album, setAlbum] = useState<Album | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null)

  useEffect(() => {
    if (!albumId) return
    let active = true

    const load = async () => {
      try {
        setLoading(true)

        const { data: albumData } = await supabase
          .from('record_label_albums')
          .select(
            '*, artist:record_label_artist_profiles(*, user_profiles:user_id(username, display_name, avatar_url))',
          )
          .eq('id', albumId)
          .eq('status', 'published')
          .maybeSingle()

        const { data: tracksData } = await supabase
          .from('record_label_tracks')
          .select('*')
          .eq('album_id', albumId)
          .eq('status', 'published')
          .order('track_number', { ascending: true })

        if (!active) return
        setAlbum((albumData as Album | null) ?? null)
        setTracks((tracksData as Track[]) ?? [])
      } catch (error) {
        console.error('[AlbumPage] Failed to load:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [albumId])

  const handlePlay = async (track: Track) => {
    setPlayingTrackId(track.id)

    try {
      const { data, error } = await supabase.rpc('play_mai_track', {
        p_track_id: track.id,
      })

      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Failed to play track')

      const listenerPaid = data?.listener_paid || 0
      if (listenerPaid > 0) {
        toast.success(`Now Playing: ${track.title} (${listenerPaid} Troll Coins used)`)
      } else {
        toast.success(`Now Playing: ${track.title}`)
      }
    } catch (err: any) {
      setPlayingTrackId(null)
      toast.error(err?.message || 'Failed to play track')
    }
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

  if (!album) {
    return (
      <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} ${MaiTrollTheme.text.primary}`}>
        <div className="fixed inset-0 pointer-events-none">
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPurple}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialPink}`} />
          <div className={`absolute inset-0 ${MaiTrollTheme.overlays.radialCyan}`} />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 py-16 text-center">
          <Music className="mx-auto mb-4 text-purple-300" size={48} />
          <h1 className="text-2xl font-black text-white">Album Not Found</h1>
          <p className="mt-2 text-slate-400">
            This album may not exist or is not published.
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

  const artistName = album.artist?.stage_name || 'Unknown Artist'
  const artistUsername = album.artist?.user_profiles?.username

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
              {album.cover_url ? (
                <img
                  src={album.cover_url}
                  alt={album.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-700/30 to-cyan-700/20">
                  <Disc3 size={56} className="text-purple-300" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
                Album
              </span>
              <h1 className="mt-2 text-3xl font-black text-white md:text-5xl">
                {album.title}
              </h1>
              <button
                onClick={() =>
                  artistUsername
                    ? navigate(`/profile/${artistUsername}`)
                    : navigate(`/profile/${album.artist_id}`)
                }
                className="mt-3 flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
              >
                <span className="font-bold">{artistName}</span>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock size={13} />
                  {formatDate(album.release_date || album.published_at)}
                </span>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                  {tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-black text-white md:text-2xl">
            Track List
          </h2>

          {tracks.length === 0 ? (
            <Card className={`${MaiTrollTheme.components.card} text-center`}>
              <CardContent className="p-10">
                <Music className="mx-auto mb-4 text-purple-300" size={32} />
                <h3 className="font-black text-white">No tracks yet</h3>
                 <p className="mt-2 text-sm text-slate-400">
                   This album doesn&apos;t have any published tracks.
                 </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 transition hover:border-purple-400/30 hover:bg-white/[0.05] ${MaiTrollTheme.interactive.hover}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-black text-slate-500">
                    {track.track_number ?? index + 1}
                  </div>

                  <button
                    onClick={() => handlePlay(track)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300 transition hover:bg-purple-500/20"
                  >
                    <Play size={16} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-white">{track.title}</p>
                    {track.explicit && (
                      <Badge variant="outline" className="mt-1 border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        E
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Heart size={13} />
                      {track.like_count.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play size={13} />
                      {track.play_count.toLocaleString()}
                    </span>
                    <span className="flex w-12 items-center justify-end gap-1 tabular-nums">
                      <Clock size={13} />
                      {formatDuration(track.duration_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
