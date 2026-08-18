import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Coins,
  Disc3,
  FileSignature,
  FileText,
  Heart,
  Loader2,
  Mic2,
  Music,
  Play,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'

import { usePresenceStore } from '@/lib/presenceStore'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import * as recordLabelService from '@/services/maiRecordLabel'

type ArtistProfile = {
  id: string
  user_id: string
  stage_name: string
  bio?: string | null
  artist_image_url?: string | null
  verified?: boolean
  created_at: string
  user_profiles?: {
    username?: string | null
    display_name?: string | null
    avatar_url?: string | null
  } | null
  track_count?: number
  total_plays?: number
}

type Track = {
  id: string
  artist_id: string
  title: string
  cover_url?: string | null
  audio_url?: string | null
  like_count?: number
  play_count?: number
  tip_count?: number
  created_at: string
  artist?: ArtistProfile | null
}

type ApplicationStatus = {
  id: string
  status: 'pending' | 'approved' | 'declined' | 'withdrawn'
  created_at: string
  reviewed_at?: string | null
  decline_reason?: string | null
}

export default function MaiRecordLabelPage() {
  const navigate = useNavigate()
  const onlineCount = usePresenceStore((state) => state.onlineCount)
  const { user, profile, isAdmin } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [newArtists, setNewArtists] = useState<ArtistProfile[]>([])
  const [topTracks, setTopTracks] = useState<Track[]>([])
  const [application, setApplication] = useState<ApplicationStatus | null>(null)
  const [isArtist, setIsArtist] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setLoading(true)

        const [artistsResult, tracksResult] = await Promise.all([
          recordLabelService.getNewArtists(8),
          recordLabelService.getTopLikedTracks(8),
        ])

        if (!active) return

        setNewArtists(artistsResult.data ?? [])
        setTopTracks(tracksResult.data ?? [])

        if (user?.id) {
          const [applicationResult, artistResult] = await Promise.all([
            recordLabelService.getMyApplication(user.id),
            recordLabelService.getArtistProfileByUserId(user.id),
          ])

          if (!active) return

          setApplication(applicationResult.data ?? null)
          setIsArtist(Boolean(artistResult.data))
        }
      } catch (error) {
        console.error('[MAI Record Label] Failed to load page:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('mai-record-label-my-application')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'record_label_applications' },
        async () => {
          const [{ data: appData }, { data: artistData }] = await Promise.all([
            recordLabelService.getMyApplication(user.id),
            recordLabelService.getArtistProfileByUserId(user.id),
          ])
          setApplication(appData ?? null)
          setIsArtist(Boolean(artistData))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const applyButton = useMemo(() => {
    if (!user) {
      return {
        label: 'Sign In to Apply',
        disabled: false,
        action: () =>
          navigate('/login', {
            state: { from: '/mai-record-label' },
          }),
      }
    }

    if (isArtist) {
      return {
        label: 'Open Artist Dashboard',
        disabled: false,
        action: () => navigate('/artist/dashboard'),
      }
    }

    if (application?.status === 'pending') {
      return {
        label: 'Application Pending',
        disabled: true,
        action: () => {},
      }
    }

    if (application?.status === 'approved') {
      return {
        label: 'Open Artist Dashboard',
        disabled: false,
        action: () => navigate('/artist/dashboard'),
      }
    }

    return {
      label:
        application?.status === 'declined'
          ? 'Apply Again'
          : 'Apply to Get Signed',
      disabled: false,
      action: () => navigate('/mai-record-label/apply'),
    }
  }, [application, isArtist, navigate, user])

  return (
    <div className="relative min-h-full w-full overflow-y-auto overflow-x-hidden text-white">
      <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-8 px-4 py-6 md:px-6 lg:px-8">
        {/* BACK */}
        <button
          onClick={() => navigate(-1)}
          className="flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[32px] border border-purple-500/20 bg-gradient-to-br from-purple-950/90 via-slate-950 to-cyan-950/80 p-6 shadow-2xl md:p-10 lg:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(34,211,238,0.15),transparent_40%)]" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/15">
                  <Music size={29} className="text-purple-300" />
                </div>

                <div>
                  <span className="text-xs font-black uppercase tracking-[0.25em] text-purple-300">
                    MAI Entertainment
                  </span>

                  <h1 className="text-3xl font-black md:text-5xl">
                    MAI Record Label
                  </h1>
                </div>
              </div>

              <h2 className="max-w-3xl text-2xl font-black leading-tight md:text-4xl">
                Release your music.
                <br />
                Build your fanbase.
                <br />
                <span className="bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent">
                  Get paid.
                </span>
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
                MAI Record Label gives MaiTroll artists a place to release
                original music, build albums, receive listener tips, grow an
                audience, track earnings, and earn better contract terms as
                they grow.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={applyButton.action}
                  disabled={applyButton.disabled}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {application?.status === 'pending' ? (
                    <Clock3 size={18} />
                  ) : isArtist ? (
                    <Mic2 size={18} />
                  ) : (
                    <UserPlus size={18} />
                  )}

                  {applyButton.label}
                </button>

                <button
                  onClick={() =>
                    document
                      .getElementById('top-tracks')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <Play size={18} />
                  Discover Music
                </button>

                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin/mai-record-label')}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-500/20"
                  >
                    <FileText size={18} />
                    Review Applications
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <HeroStat
                icon={<Users size={20} />}
                value={onlineCount.toLocaleString()}
                label="Online Now"
              />

              <HeroStat
                icon={<Coins size={20} />}
                value="80%"
                label="Approved Artist Split"
              />

              <HeroStat
                icon={<Music size={20} />}
                value="10"
                label="Tracks / Week"
              />

              <HeroStat
                icon={<TrendingUp size={20} />}
                value="30 Days"
                label="Probation"
              />
            </div>
          </div>
        </section>

        {/* APPLICATION STATUS */}
        {application?.status === 'pending' && (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 text-amber-300" size={22} />

              <div>
                <h3 className="font-black text-amber-200">
                  Your application is under review
                </h3>

                <p className="mt-1 text-sm text-amber-100/70">
                  MAI Record Label staff will review your artist application.
                  Your status will update here when a decision is made.
                </p>
              </div>
            </div>
          </section>
        )}

        {application?.status === 'declined' && (
          <section className="rounded-2xl border border-red-400/20 bg-red-500/5 p-5">
            <h3 className="font-black text-red-200">
              Your previous application was not approved
            </h3>

            {application.decline_reason && (
              <p className="mt-2 text-sm text-red-100/70">
                {application.decline_reason}
              </p>
            )}

            <button
              onClick={() => navigate('/mai-record-label/apply')}
              className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/15"
            >
              Submit New Application
            </button>
          </section>
        )}

        {/* NEW ARTISTS */}
        <section>
          <SectionHeading
            eyebrow="Fresh Faces"
            title="New MAI Artists"
            description="Discover recently signed artists joining MAI Record Label."
          />

          {loading ? (
            <LoadingBlock />
          ) : newArtists.length === 0 ? (
            <EmptyBlock
              icon={<Mic2 size={28} />}
              title="The stage is waiting"
              text="New artists will appear here as applications are approved."
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
              {newArtists.map((artist) => {
                const avatar =
                  artist.artist_image_url ||
                  artist.user_profiles?.avatar_url ||
                  undefined

                const username = artist.user_profiles?.username

                return (
                  <button
                    key={artist.id}
                    onClick={() =>
                      navigate(
                        username
                          ? `/profile/${username}`
                          : `/profile/${artist.user_id}`,
                      )
                    }
                    className="group text-left"
                  >
                    <div className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={artist.stage_name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-700/30 to-cyan-700/20">
                          <Mic2 size={34} className="text-purple-300" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-sm font-black text-white">
                          {artist.stage_name}
                        </p>

                        {artist.verified && (
                          <BadgeCheck
                            size={14}
                            className="shrink-0 text-cyan-400"
                          />
                        )}
                      </div>

                      {username && (
                        <p className="truncate text-xs text-slate-300">
                          @{username}
                        </p>
                      )}

                      <div className="mt-1 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span className="flex items-center gap-1">
                          <Disc3 size={10} />
                          {(artist.track_count ?? 0)} tracks
                        </span>

                        <span className="flex items-center gap-1">
                          <Play size={10} />
                          {(artist.total_plays ?? 0).toLocaleString()} plays
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* TOP TRACKS */}
        <section id="top-tracks">
          <SectionHeading
            eyebrow="Community Favorites"
            title="Top Liked Tracks"
            description="Music listeners are showing the most love to right now."
          />

          {loading ? (
            <LoadingBlock />
          ) : topTracks.length === 0 ? (
            <EmptyBlock
              icon={<Disc3 size={28} />}
              title="No tracks ranked yet"
              text="Published MAI Record Label tracks will begin appearing here."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {topTracks.map((track, index) => (
                <button
                  key={track.id}
                  onClick={() => navigate(`/music/track/${track.id}`)}
                  className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-purple-400/30 hover:bg-white/[0.05]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-black text-slate-500">
                    #{index + 1}
                  </div>

                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                    {track.cover_url ? (
                      <img
                        src={track.cover_url}
                        alt={track.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Music size={23} className="text-purple-300" />
                      </div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                      <Play
                        size={20}
                        className="opacity-0 transition group-hover:opacity-100"
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-white">
                      {track.title}
                    </p>

                    <p className="truncate text-xs text-slate-400">
                      {track.artist?.stage_name ?? 'MAI Artist'}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Heart size={12} />
                        {(track.like_count ?? 0).toLocaleString()}
                      </span>

                      <span className="flex items-center gap-1">
                        <Play size={12} />
                        {(track.play_count ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}
        <section>
          <SectionHeading
            eyebrow="Get Signed"
            title="Your Path to MAI Record Label"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ProcessCard
              number="01"
              icon={<FileSignature size={23} />}
              title="Apply"
              description="Tell MAI about yourself, your music, experience, goals, genres, and submit examples of your work."
            />

            <ProcessCard
              number="02"
              icon={<CheckCircle2 size={23} />}
              title="Get Reviewed"
              description="MAI Record Label administrators review applications and approve or decline each submission."
            />

            <ProcessCard
              number="03"
              icon={<Mic2 size={23} />}
              title="Sign Your Contract"
              description="Approved applicants receive their MAI Record Label agreement and begin the 30-day probation contract."
            />

            <ProcessCard
              number="04"
              icon={<Sparkles size={23} />}
              title="Become an Artist"
              description="Your regular MaiTroll profile becomes an artist profile with albums, tracks, music tools, tips, and artist status."
            />
          </div>
        </section>

        {/* PAY */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 to-black/30 p-6 md:p-8">
            <Coins size={28} className="text-purple-300" />

            <h2 className="mt-4 text-2xl font-black">
              30-Day Artist Probation
            </h2>

            <div className="mt-6 flex items-end gap-2">
              <span className="text-5xl font-black">50%</span>
              <span className="pb-1 text-sm font-bold text-slate-400">
                artist share
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              New artists begin on a 50/50 agreement while MAI reviews
              consistency, music performance, activity, and qualification
              requirements.
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-black/30 p-6 md:p-8">
            <TrendingUp size={28} className="text-cyan-300" />

            <h2 className="mt-4 text-2xl font-black">
              Approved MAI Artist
            </h2>

            <div className="mt-6 flex items-end gap-2">
              <span className="text-5xl font-black">80%</span>
              <span className="pb-1 text-sm font-bold text-slate-400">
                artist share
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Artists who successfully complete probation can move to the
              standard 80/20 MAI Record Label agreement.
            </p>
          </div>
        </section>

        {/* RULES */}
        <section className="rounded-3xl border border-white/10 bg-black/20 p-6 md:p-8">
          <SectionHeading
            eyebrow="Artist Program"
            title="Current Label Rules"
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <RuleItem
              number="01"
              title="30-Day Probation"
              description="Every newly approved artist starts with a 30-day probationary contract."
            />

            <RuleItem
              number="02"
              title="50/50 Probation Split"
              description="During probation, qualifying music revenue is split 50% to the artist and 50% to MAI."
            />

            <RuleItem
              number="03"
              title="10 Songs Per Week"
              description="Probationary artists may release up to 10 songs each week."
            />

            <RuleItem
              number="04"
              title="500 Coin Qualification"
              description="Each qualifying song is expected to reach at least 500 Troll Coins per week toward probation performance."
            />

            <RuleItem
              number="05"
              title="Performance Review"
              description="MAI reviews the artist after the 30-day probation before advancing their contract."
            />

            <RuleItem
              number="06"
              title="80/20 Approved Split"
              description="Approved MAI artists receive 80% of eligible music revenue while MAI receives 20%."
            />

            <RuleItem
              number="07"
              title="Future Contract Levels"
              description="Higher 90/10 and potential 95/5 tiers can be introduced later for qualifying artists."
            />

            <RuleItem
              number="08"
              title="Listener Support"
              description="Listeners can like tracks and tip MAI artists directly through their music and artist profile."
            />
          </div>
        </section>

        {/* FINAL CTA */}
        {!isArtist && (
          <section className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-purple-600/10 p-8 text-center md:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,.18),transparent_60%)]" />

            <div className="relative">
              <Mic2 size={38} className="mx-auto text-purple-300" />

              <h2 className="mt-4 text-2xl font-black md:text-3xl">
                Think you belong on MAI?
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
                Apply to MAI Record Label and start building your music career
                directly inside the MaiTroll community.
              </p>

              <button
                onClick={applyButton.action}
                disabled={applyButton.disabled}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus size={18} />
                {applyButton.label}
              </button>
            </div>
          </section>
        )}
      </div>
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
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
      <div className="text-purple-300">{icon}</div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
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

      <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      )}
    </div>
  )
}

function ProcessCard({
  number,
  icon,
  title,
  description,
}: {
  number: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-center justify-between">
        <div className="text-purple-300">{icon}</div>

        <span className="text-xs font-black text-slate-600">{number}</span>
      </div>

      <h3 className="mt-5 font-black text-white">{title}</h3>

      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        {description}
      </p>
    </div>
  )
}

function RuleItem({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-xs font-black text-purple-300">
        {number}
      </span>

      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>

        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {description}
        </p>
      </div>
    </div>
  )
}

function EmptyBlock({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-purple-300">
        {icon}
      </div>

      <h3 className="mt-4 font-black">{title}</h3>

      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </div>
  )
}

function LoadingBlock() {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02]">
      <Loader2 size={26} className="animate-spin text-purple-300" />
    </div>
  )
}