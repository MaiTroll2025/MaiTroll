import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Crown,
  Gavel,
  MessageCircle,
  FileText,
  HelpCircle,
  Home,
  Mail,
  Music,
  Play,
  Radio,
  Sparkles,
  Trophy,
  Users,
  Shield,
} from 'lucide-react'

import PhoneHeader from '../PhoneHeader'
import { useAuthStore } from '@/lib/store'
import {
  useLiveContent,
  type AuctionShow,
  type LiveItem,
} from '@/contexts/LiveContentContext'
import { usePresenceStore } from '@/lib/presenceStore'
import { supabase } from '@/lib/supabase'
import { useWallNotifications } from '@/hooks/useWallNotifications'

const glass =
  'border border-[#00BFFF]/10 bg-[#070711]/85 backdrop-blur-2xl shadow-[0_15px_50px_rgba(0,0,0,0.40)]'

const neonGradient =
  'bg-gradient-to-br from-[#00BFFF] via-[#1787FF] to-[#BF00FF]'

const neonBorder =
  'border border-[#00BFFF]/30 shadow-[0_0_25px_rgba(0,191,255,0.10),0_0_35px_rgba(191,0,255,0.08)]'

function PhoneSpaceBackground() {
  const stars = Array.from({ length: 48 }, (_, index) => ({
    left: `${(index * 47) % 100}%`,
    top: `${(index * 71) % 100}%`,
    depth: `${(index % 5) * 0.12 + 0.4}s`,
    size: `${index % 13 === 0 ? 2 : 1}px`,
    opacity: `${0.35 + (index % 6) * 0.1}`,
  }))
  const shootingStars = [
    { top: '18%', left: '8%', delay: '0s', duration: '5.5s' },
    { top: '34%', left: '56%', delay: '2.2s', duration: '6.5s' },
    { top: '62%', left: '18%', delay: '4s', duration: '7s' },
  ]

  const planetTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128

    const context = canvas.getContext('2d')
    if (!context) return ''

    const image = context.createImageData(canvas.width, canvas.height)
    const data = image.data

    const hash = (x: number, y: number, seed = 0) => {
      const value = Math.sin(
        x * 127.1 + y * 311.7 + seed * 74.7,
      ) * 43758.5453123

      return value - Math.floor(value)
    }

    const fade = (t: number) => t * t * (3 - 2 * t)

    const noise = (x: number, y: number, scale: number, seed = 0) => {
      const sx = x / scale
      const sy = y / scale
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const fx = fade(sx - x0)
      const fy = fade(sy - y0)

      const n00 = hash(x0, y0, seed)
      const n10 = hash(x0 + 1, y0, seed)
      const n01 = hash(x0, y0 + 1, seed)
      const n11 = hash(x0 + 1, y0 + 1, seed)
      const nx0 = n00 + (n10 - n00) * fx
      const nx1 = n01 + (n11 - n01) * fx

      return nx0 + (nx1 - nx0) * fy
    }

    const fbm = (x: number, y: number) => {
      let value = 0
      let total = 0
      const layers = [
        [180, 1],
        [90, 0.5],
        [45, 0.25],
        [20, 0.12],
        [8, 0.06],
      ]

      for (const [scale, amplitude] of layers) {
        value += noise(x, y, scale, scale) * amplitude
        total += amplitude
      }

      return value / total
    }

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const terrain = fbm(x, y)
        const mariaNoise = noise(x + 400, y + 100, 230, 12)
        const maria = mariaNoise > 0.56
          ? Math.min(1, (mariaNoise - 0.56) * 4)
          : 0

        let brightness = 132 + terrain * 58 - maria * 48
        brightness += (hash(x, y, 99) - 0.5) * 13
        brightness = Math.max(48, Math.min(205, brightness))

        const index = (y * canvas.width + x) * 4
        data[index] = brightness
        data[index + 1] = brightness * 0.99
        data[index + 2] = brightness * 0.96
        data[index + 3] = 255
      }
    }

    context.putImageData(image, 0, 0)

    return canvas.toDataURL('image/jpeg', 0.9)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#01020a] [perspective:900px]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,rgba(38,20,116,0.35),transparent_42%),radial-gradient(ellipse_at_10%_65%,rgba(0,136,214,0.18),transparent_38%),linear-gradient(160deg,#02030d_0%,#07152a_48%,#090219_100%)]" />
      <div className="absolute left-[-20%] top-[18%] h-[34%] w-[140%] rotate-[-18deg] rounded-[50%] bg-[radial-gradient(ellipse,rgba(54,210,255,0.2),rgba(116,31,255,0.1)_28%,transparent_67%)] blur-2xl [transform:translateZ(-80px)]" />
      <div className="absolute -left-[30%] top-[8%] h-[32%] w-[95%] rotate-[28deg] rounded-[50%] bg-[radial-gradient(ellipse,rgba(103,41,255,0.2),rgba(27,143,255,0.08)_38%,transparent_70%)] blur-3xl animate-[nebulaDrift_28s_ease-in-out_infinite]" />
      <div className="absolute -right-[26%] top-[62%] h-[38%] w-[90%] rotate-[-24deg] rounded-[50%] bg-[radial-gradient(ellipse,rgba(32,178,255,0.15),rgba(153,27,255,0.12)_34%,transparent_70%)] blur-3xl animate-[nebulaDrift_34s_ease-in-out_infinite_reverse]" />
      <div className="absolute inset-0 [transform-style:preserve-3d]">
        {stars.map((star, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white shadow-[0_0_7px_rgba(139,225,255,0.9)] animate-[spaceTwinkle_3.8s_ease-in-out_infinite]"
            style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity, animationDelay: star.depth }}
          />
        ))}
        {shootingStars.map((star, index) => (
          <span
            key={index}
            className="absolute h-px w-20 origin-left rotate-[25deg] bg-gradient-to-r from-transparent via-cyan-100 to-white opacity-0 shadow-[0_0_8px_#38d9ff] animate-[shootingStar_6s_linear_infinite]"
            style={{ top: star.top, left: star.left, animationDelay: star.delay, animationDuration: star.duration }}
          />
        ))}
      </div>

      <div className="absolute left-[8%] top-[23%] h-10 w-10 overflow-hidden rounded-full bg-[#168ed0] shadow-[-7px_-5px_12px_rgba(187,219,255,0.5),inset_-7px_-5px_12px_rgba(20,38,90,0.85)] [background-image:radial-gradient(ellipse_at_28%_28%,rgba(104,220,255,0.65),transparent_24%),radial-gradient(ellipse_at_68%_42%,#4f9d38 0%,#27782f 38%,transparent 40%),radial-gradient(ellipse_at_32%_76%,#69a844 0%,#287735 34%,transparent 36%),radial-gradient(ellipse_at_78%_78%,#367f35 0%,transparent_26%)] [transform:translateZ(18px)] sm:left-[14%] sm:top-[20%] sm:h-14 sm:w-14">
        <span className="absolute left-[62%] top-[34%] h-1.5 w-1.5 rounded-full bg-[#174f2a] shadow-[3px_1px_0_#2f7c37,-2px_2px_0_#2f7c37] sm:h-2 sm:w-2" />
        <span className="absolute left-[29%] top-[65%] h-1 w-1 rounded-full bg-[#174f2a] shadow-[3px_0_0_#3d8536] sm:h-1.5 sm:w-1.5" />
        <div className="absolute left-1/2 top-1/2 h-[170%] w-[42%] -translate-x-1/2 -translate-y-1/2 rotate-[28deg] rounded-[50%] border border-white/30 opacity-40 [transform:rotateX(70deg)]" />
      </div>

      <div className="absolute right-[3%] top-[38%] h-[230px] w-[230px] [transform:translateZ(30px)_rotateX(12deg)_rotateY(-18deg)] sm:right-[12%] sm:h-[280px] sm:w-[280px]">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-[#777] shadow-[-18px_-12px_30px_rgba(190,190,190,0.22),18px_25px_42px_rgba(0,0,0,0.9),inset_-25px_-8px_35px_#080808] [transform:rotateY(-14deg)]">
          <div className="absolute inset-[-4%] bg-cover bg-[position:0%_50%] opacity-95 mix-blend-normal animate-[planetSurfaceDrift_24s_linear_infinite]" style={{ backgroundImage: `url(${planetTexture})` }} />
          <div className="absolute inset-[-8%] rounded-full bg-[radial-gradient(ellipse_at_24%_18%,rgba(255,255,255,0.38),transparent_18%),radial-gradient(circle_at_18%_50%,transparent_35%,rgba(0,0,0,0.86)_84%)]" />
          <div className="absolute inset-0 rounded-full border border-white/20 opacity-60 [box-shadow:inset_12px_8px_22px_rgba(255,255,255,0.24),inset_-18px_-10px_30px_rgba(0,0,0,0.92)]" />
          <div className="absolute inset-0 flex items-center justify-center px-4 [transform:translateZ(20px)_rotateY(14deg)]">
            <span className="whitespace-nowrap text-[clamp(1.1rem,6vw,2rem)] font-black uppercase tracking-[0.18em] text-white/80 [text-shadow:1px_1px_2px_rgba(0,0,0,0.85),-1px_-1px_1px_rgba(255,255,255,0.3)]">Mai Troll</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes spaceTwinkle { 0%, 100% { opacity: .28; transform: translateZ(0) scale(.8); } 50% { opacity: 1; transform: translateZ(28px) scale(1.5); } } @keyframes shootingStar { 0%, 12% { opacity: 0; transform: translate3d(-30px, -20px, 0) rotate(25deg) scaleX(.4); } 18% { opacity: 1; } 42% { opacity: .8; transform: translate3d(170px, 120px, 45px) rotate(25deg) scaleX(1); } 58%, 100% { opacity: 0; transform: translate3d(280px, 195px, 70px) rotate(25deg) scaleX(.2); } } @keyframes planetSurfaceDrift { from { background-position: 0% 50%; transform: scale(1.12); } to { background-position: 100% 50%; transform: scale(1.12); } } @keyframes nebulaDrift { 0%, 100% { transform: translate3d(-2%, 0, -80px) rotate(28deg) scale(1); opacity: .65; } 50% { transform: translate3d(5%, 4%, -60px) rotate(34deg) scale(1.08); opacity: .9; } }`}</style>
    </div>
  )
}

interface PhoneHomepageProps {
  onNavigate?: (path: string) => void
}

/* -------------------------------------------------------------------------- */
/* Live Stream Tile                                                           */
/* -------------------------------------------------------------------------- */

const PhoneLiveTile = React.memo(function PhoneLiveTile({
  item,
  onClick,
}: {
  item: LiveItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-[190px] w-[145px] shrink-0 overflow-hidden rounded-2xl border border-[#00BFFF]/15 bg-[#090914] text-left shadow-[0_8px_30px_rgba(0,0,0,0.40)] transition-all duration-200 active:scale-[0.97] hover:border-[#00BFFF]/40 hover:shadow-[0_0_25px_rgba(0,191,255,0.15)]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#BF00FF]/25 via-[#070711] to-[#00BFFF]/25" />

      {item.streamerAvatar ? (
        <img
          src={item.streamerAvatar}
          alt={item.streamerName || 'Live streamer'}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <Play className="h-7 w-7 text-[#00BFFF]/50" />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-[#03030a]/10 via-transparent to-[#03030a]" />

      {/* Neon LIVE badge */}
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-[#00BFFF]/30 bg-[#05050c]/75 px-2 py-1 text-[8px] font-black tracking-wider text-white backdrop-blur-md">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />
        LIVE
      </div>

      <div className="absolute right-2 top-2 rounded-lg border border-white/10 bg-black/55 px-1.5 py-1 text-[8px] font-black text-white backdrop-blur-md">
        👁 {item.viewerCount || 0}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className="truncate text-[11px] font-black text-white">
          {item.title || 'Live Broadcast'}
        </p>

        <p className="mt-0.5 truncate text-[9px] font-bold text-[#00BFFF]/70">
          {item.streamerName || 'Unknown'}
        </p>
      </div>
    </button>
  )
})

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

function PhoneSection({
  title,
  icon: Icon,
  count,
  children,
  onViewAll,
}: {
  title: string
  icon: React.ElementType
  count?: number
  children: React.ReactNode
  onViewAll?: () => void
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/20 to-[#BF00FF]/20" />
            <Icon size={15} className="relative text-[#00BFFF]" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-sm font-black tracking-tight text-white">
              {title}
            </h2>

            {count !== undefined && (
              <p className="text-[9px] font-bold text-[#00BFFF]/55">
                {count} {count === 1 ? 'active stream' : 'active streams'}
              </p>
            )}
          </div>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="group flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#00BFFF] transition hover:bg-[#00BFFF]/10"
          >
            Explore
            <ChevronRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        )}
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {children}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Live Now                                                                    */
/* -------------------------------------------------------------------------- */

function PhoneLiveNow({
  items,
  loading,
  onItemClick,
  onViewAll,
}: {
  items: LiveItem[]
  loading: boolean
  onItemClick: (item: LiveItem) => void
  onViewAll?: () => void
}) {
  if (loading) {
    return (
      <PhoneSection title="Live Now" icon={Radio}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[190px] w-[145px] shrink-0 animate-pulse rounded-2xl border border-[#00BFFF]/10 bg-gradient-to-br from-[#00BFFF]/5 to-[#BF00FF]/5"
          />
        ))}
      </PhoneSection>
    )
  }

  return (
    <PhoneSection
      title="Live Now"
      icon={Radio}
      count={items.length}
      onViewAll={onViewAll}
    >
      {items.length === 0 ? (
        <button
          type="button"
          onClick={onViewAll}
          className={`flex h-[150px] w-full min-w-[280px] flex-col items-center justify-center rounded-2xl ${neonBorder} bg-gradient-to-br from-[#00BFFF]/5 via-[#070711] to-[#BF00FF]/5 px-5 text-center transition active:scale-[0.98]`}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <Radio className="h-6 w-6 text-[#00BFFF]/60" />
          </div>

          <p className="mt-3 text-xs font-black text-zinc-300">
            The network is quiet
          </p>

          <p className="mt-1 text-[9px] font-bold text-zinc-600">
            Explore MaiTroll or be the first to go live.
          </p>
        </button>
      ) : (
        items.slice(0, 12).map((item) => (
          <PhoneLiveTile
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
          />
        ))
      )}
    </PhoneSection>
  )
}

/* -------------------------------------------------------------------------- */
/* Auctions                                                                    */
/* -------------------------------------------------------------------------- */

function PhoneAuctions({
  auctions,
  onClick,
}: {
  auctions: AuctionShow[]
  onClick: (id?: string) => void
}) {
  return (
    <PhoneSection
      title="Live Auctions"
      icon={Gavel}
      count={auctions.length}
      onViewAll={() => onClick()}
    >
      {auctions.length === 0 ? (
        <div className="flex h-[145px] w-full min-w-[280px] flex-col items-center justify-center rounded-2xl border border-[#BF00FF]/15 bg-gradient-to-br from-[#BF00FF]/5 to-[#00BFFF]/5 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#BF00FF]/10">
            <Gavel className="h-6 w-6 text-[#BF00FF]/50" />
          </div>

          <p className="mt-2 text-xs font-black text-zinc-400">
            No live auctions
          </p>

          <p className="mt-1 text-[9px] font-bold text-zinc-600">
            Check back when the bidding starts.
          </p>
        </div>
      ) : (
        auctions.slice(0, 10).map((auction) => (
          <button
            key={auction.id}
            type="button"
            onClick={() => onClick(auction.id)}
            className="group relative h-[145px] w-[150px] shrink-0 overflow-hidden rounded-2xl border border-[#BF00FF]/15 bg-[#0b0b18] text-left transition-all active:scale-[0.97]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/25 via-[#070711] to-[#BF00FF]/30" />

            {auction.thumbnail_url ? (
              <img
                src={auction.thumbnail_url}
                alt={auction.title || 'Auction'}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <Gavel className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-[#BF00FF]/30" />
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/95" />

            <span className="absolute right-2 top-2 rounded-lg border border-[#BF00FF]/30 bg-black/60 px-1.5 py-1 text-[8px] font-black text-white backdrop-blur-md">
              LIVE
            </span>

            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <p className="truncate text-[10px] font-black text-white">
                {auction.title || 'Live Auction'}
              </p>
            </div>
          </button>
        ))
      )}
    </PhoneSection>
  )
}

/* -------------------------------------------------------------------------- */
/* Online Users                                                                */
/* -------------------------------------------------------------------------- */

function PhoneOnlineUsers({
  onlineUsers,
  currentUserId,
}: {
  onlineUsers: number
  currentUserId?: string
}) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const fetchUsers = async () => {
      setLoading(true)

      try {
        const ids = Array.from(onlineUserIds).slice(0, 100)

        if (!ids.length) {
          if (!cancelled) setUsers([])
          return
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .select(
            'id, username, display_name, avatar_url, role, is_admin',
          )
          .in('id', ids)

        if (error) throw error

        if (!cancelled) {
          setUsers(data || [])
        }
      } catch {
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchUsers()

    return () => {
      cancelled = true
    }
  }, [open, onlineUserIds])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex w-full items-center justify-between rounded-2xl ${neonBorder} bg-gradient-to-r from-[#00BFFF]/5 via-[#070711] to-[#BF00FF]/5 px-4 py-3 transition active:scale-[0.99]`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
            <Users size={17} className="text-[#00BFFF]" />
          </div>

          <div className="text-left">
            <p className="text-xs font-black text-white">
              Online Community
            </p>

            <p className="text-[9px] font-bold text-[#00BFFF]/60">
              {onlineUsers.toLocaleString()} people are online
            </p>
          </div>
        </div>

        <ChevronRight
          size={16}
          className="text-[#00BFFF]/50 transition-transform group-hover:translate-x-0.5"
        />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md">
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-hidden rounded-t-3xl border-t border-[#00BFFF]/25 bg-[#070711] shadow-[0_-10px_60px_rgba(0,191,255,0.10)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div>
                <h3 className="text-sm font-black text-white">
                  Online Community
                </h3>

                <p className="text-[9px] text-[#00BFFF]/55">
                  {onlineUsers.toLocaleString()} people online
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-3">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-xl bg-gradient-to-r from-[#00BFFF]/5 to-[#BF00FF]/5"
                    />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-500">
                  No users online.
                </div>
              ) : (
                <div className="space-y-1">
                  {users.map((u) => {
                    const admin =
                      u.is_admin ||
                      ['admin', 'ceo', 'superadmin'].includes(
                        u.role || '',
                      )

                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          window.location.href = `/profile/id/${u.id}`
                        }}
                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#00BFFF]/5 active:bg-white/5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] text-xs font-black text-white shadow-[0_0_15px_rgba(0,191,255,0.15)]">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (
                              u.display_name ||
                              u.username ||
                              '?'
                            )[0]?.toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-white">
                            {u.display_name || u.username}

                            {u.id === currentUserId && (
                              <span className="ml-1 text-[8px] text-[#00BFFF]">
                                YOU
                              </span>
                            )}

                            {admin && (
                              <Crown className="ml-1 inline h-3 w-3 text-[#BF00FF]" />
                            )}
                          </p>

                          <p className="truncate text-[9px] text-zinc-500">
                            @{u.username}
                          </p>
                        </div>

                        <span className="h-2 w-2 rounded-full bg-[#00BFFF] shadow-[0_0_8px_#00BFFF]" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Quick Links                                                                 */
/* -------------------------------------------------------------------------- */

function PhoneQuickLinks() {
  const navigate = useNavigate()

  const links = [
    {
      label: 'Battles',
      icon: Sparkles,
      path: '/battles',
    },
    {
      label: 'Leagues',
      icon: Trophy,
      path: '/leagues',
    },
    {
      label: 'Academy',
      icon: BookOpen,
      path: '/academy',
    },
    {
      label: 'Record Label',
      icon: Music,
      path: '/mai-record-label',
    },
  ]

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-black tracking-tight text-white">
            Explore MaiTroll
          </h2>

          <p className="text-[9px] font-bold text-[#00BFFF]/45">
            More ways to connect, compete and create
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {links.map((link, index) => {
          const Icon = link.icon

          return (
            <button
              key={link.label}
              type="button"
              onClick={() => navigate(link.path)}
              className="group relative flex min-h-[78px] flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#00BFFF]/10 bg-[#080812] px-1 text-center transition-all active:scale-95 hover:border-[#00BFFF]/25"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/5 to-[#BF00FF]/5 opacity-0 transition-opacity group-hover:opacity-100" />

              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#00BFFF]/15 bg-gradient-to-br ${
                  index % 2 === 0
                    ? 'from-[#00BFFF]/15 to-[#BF00FF]/10'
                    : 'from-[#BF00FF]/15 to-[#00BFFF]/10'
                }`}
              >
                <Icon
                  size={16}
                  className={
                    index % 2 === 0
                      ? 'text-[#00BFFF]'
                      : 'text-[#BF00FF]'
                  }
                />
              </div>

              <span className="relative text-[8px] font-black leading-tight text-zinc-400">
                {link.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Homepage                                                                    */
/* -------------------------------------------------------------------------- */

export default function PhoneHomepage({
  onNavigate,
}: PhoneHomepageProps) {
  const navigate = useNavigate()

  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)

  const {
    liveItems,
    liveAuctions,
    onlineUsers,
    loadingLive,
    refresh,
  } = useLiveContent()

  const { newPostCount } = useWallNotifications(false)

  const [refreshing, setRefreshing] = useState(false)

  const battleItems = useMemo(
    () => liveItems.filter((item) => item.isBattle),
    [liveItems],
  )

  const courtItems = useMemo(
    () => liveItems.filter((item) => item.category === 'court'),
    [liveItems],
  )

  const tcnnItems = useMemo(
    () => liveItems.filter((item) => item.category === 'tcnn'),
    [liveItems],
  )

  const totalLive = liveItems.length + liveAuctions.length

  const go = useCallback(
    (path: string) => {
      if (onNavigate) {
        onNavigate(path)
      } else {
        navigate(path)
      }
    },
    [navigate, onNavigate],
  )

  const handleStreamClick = useCallback(
    (item: LiveItem) => {
      go(`/watch/${item.id}`)
    },
    [go],
  )

  const handleAuctionClick = useCallback(
    (id?: string) => {
      go(id ? `/auctions/${id}` : '/auctions')
    },
    [go],
  )

  const refreshLiveContent = useCallback(async () => {
    setRefreshing(true)

    try {
      await refresh()
      await new Promise((resolve) => setTimeout(resolve, 300))
    } finally {
      setRefreshing(false)
    }
  }, [refresh])

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    })
  }, [])

  useEffect(() => {
    const handleOpenLive = () => {
      go('/live')
    }

    window.addEventListener('phone-open-live', handleOpenLive)

    return () => {
      window.removeEventListener('phone-open-live', handleOpenLive)
    }
  }, [go])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )
    }
  }, [refresh])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#03030a]">
        <PhoneHeader showTickerLinks={false} />

        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto h-12 w-12">
              <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] opacity-30 blur-xl" />

              <div className="relative h-12 w-12 animate-spin rounded-full border-2 border-[#BF00FF]/20 border-t-[#00BFFF]" />
            </div>

            <p className="mt-4 text-xs font-black text-[#00BFFF]/50">
              Loading MaiTroll...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#03030a] text-white">
      <PhoneSpaceBackground />
      <PhoneHeader showTickerLinks={false} />

      <main className="relative z-10 px-3 pb-24 pt-3">
        {/* ---------------------------------------------------------------- */}
        {/* Welcome                                                           */}
        {/* ---------------------------------------------------------------- */}

        {!user && (
          <section className="relative mb-4 overflow-hidden rounded-3xl border border-[#00BFFF]/15 bg-gradient-to-br from-[#BF00FF]/15 via-[#070711] to-[#00BFFF]/15 p-4 shadow-[0_0_40px_rgba(0,191,255,0.06)]">
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#00BFFF]/15 blur-3xl" />

            <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-[#BF00FF]/10 blur-3xl" />

            <div className="relative flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_25px_rgba(0,191,255,0.25)]">
                <Sparkles size={20} className="text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white">
                  Welcome to MaiTroll
                </h2>

                <p className="mt-0.5 text-[9px] font-bold text-zinc-400">
                  Watch. Battle. Troll. Gift. Cashout.
                </p>
              </div>

              <button
                type="button"
                onClick={() => go('/auth?mode=signup')}
                className="shrink-0 rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-3 py-2 text-[9px] font-black text-white shadow-[0_0_18px_rgba(0,191,255,0.20)] transition active:scale-95"
              >
                Join
              </button>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Stats + Go Live                                                   */}
        {/* ---------------------------------------------------------------- */}

        <section className="mb-5 grid grid-cols-3 gap-2">
          <div className={`${glass} rounded-2xl p-3`}>
            <Radio size={14} className="text-[#00BFFF]" />

            <p className="mt-2 text-base font-black text-white">
              {totalLive}
            </p>

            <p className="text-[8px] font-black uppercase tracking-wider text-[#00BFFF]/45">
              Live Now
            </p>
          </div>

          {/* MAIN CTA */}
          <button
            type="button"
            onClick={() => go('/go-live')}
            className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#00BFFF]/50 bg-gradient-to-br from-[#00BFFF] via-[#1787FF] to-[#BF00FF] p-3 text-white shadow-[0_0_25px_rgba(0,191,255,0.30),0_0_35px_rgba(191,0,255,0.20)] transition-all duration-200 active:scale-[0.97] hover:scale-[1.02]"
          >
            <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-white/20 blur-2xl transition-transform duration-500 group-hover:scale-150" />

            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />

            <div className="relative flex flex-col items-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/10 shadow-[0_0_15px_rgba(255,255,255,0.15)]">
                <Radio
                  size={18}
                  className="text-white transition-transform duration-200 group-hover:scale-110"
                />
              </div>

              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                GO LIVE
              </p>

              <p className="mt-0.5 text-[7px] font-black uppercase tracking-wider text-white/80">
                Start Your Broadcast
              </p>
            </div>
          </button>

          <div className={`${glass} rounded-2xl p-3`}>
            <Users size={14} className="text-[#BF00FF]" />

            <p className="mt-2 text-base font-black text-white">
              {onlineUsers.toLocaleString()}
            </p>

            <p className="text-[8px] font-black uppercase tracking-wider text-[#BF00FF]/45">
              Online
            </p>
          </div>
        </section>

        <div className="mb-5 flex justify-start">
          <button
            type="button"
            disabled={refreshing}
            onClick={refreshLiveContent}
            className="rounded-xl border border-[#00BFFF]/15 bg-[#00BFFF]/5 px-3 py-2 text-[9px] font-black text-[#00BFFF] transition active:scale-95 disabled:opacity-50"
          >
            {refreshing ? 'Updating...' : 'Refresh'}
          </button>
        </div>

        <div className="space-y-6">
          {/* Live */}
          <PhoneLiveNow
            items={liveItems}
            loading={loadingLive}
            onItemClick={handleStreamClick}
            onViewAll={() => go('/live')}
          />

          {/* Auctions */}
          <PhoneAuctions
            auctions={liveAuctions}
            onClick={handleAuctionClick}
          />

          {/* -------------------------------------------------------------- */}
          {/* Battles                                                          */}
          {/* -------------------------------------------------------------- */}

          <PhoneSection
            title="Universal Battles"
            icon={Sparkles}
            count={battleItems.length}
            onViewAll={() => go('/battles')}
          >
            {battleItems.length === 0 ? (
              <div className="flex h-[125px] w-full min-w-[280px] flex-col items-center justify-center rounded-2xl border border-[#BF00FF]/15 bg-gradient-to-br from-[#BF00FF]/5 to-[#00BFFF]/5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#BF00FF]/10">
                  <Sparkles className="h-5 w-5 text-[#BF00FF]/40" />
                </div>

                <p className="mt-2 text-[10px] font-black text-zinc-500">
                  No battles are active
                </p>

                <p className="mt-0.5 text-[8px] font-bold text-zinc-700">
                  Check back for the next matchup.
                </p>
              </div>
            ) : (
              battleItems.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleStreamClick(item)}
                  className="group relative h-[140px] w-[165px] shrink-0 overflow-hidden rounded-2xl border border-[#BF00FF]/25 bg-gradient-to-br from-[#BF00FF]/20 via-[#080812] to-[#00BFFF]/15 p-3 text-left transition active:scale-[0.97]"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#BF00FF]/10 to-[#00BFFF]/10 opacity-0 transition-opacity group-hover:opacity-100" />

                  <span className="relative rounded-full border border-[#BF00FF]/30 bg-[#BF00FF]/15 px-2 py-1 text-[7px] font-black text-[#BF00FF]">
                    {item.battleFormat?.toUpperCase() || 'BATTLE'}
                  </span>

                  <span className="absolute right-2 top-2 rounded-lg border border-[#00BFFF]/30 bg-black/60 px-1.5 py-1 text-[7px] font-black text-white">
                    LIVE
                  </span>

                  <div className="absolute inset-x-3 bottom-3">
                    <p className="truncate text-xs font-black text-white">
                      {item.title}
                    </p>

                    <p className="mt-1 truncate text-[9px] font-bold text-[#00BFFF]/60">
                      {item.streamerName}
                    </p>
                  </div>
                </button>
              ))
            )}
          </PhoneSection>

          {/* -------------------------------------------------------------- */}
          {/* Troll Court                                                     */}
          {/* -------------------------------------------------------------- */}

          <PhoneSection
            title="Troll Court"
            icon={Gavel}
            count={courtItems.length}
            onViewAll={() => go('/court')}
          >
            {courtItems.length === 0 ? (
              <div className="flex h-[120px] w-full min-w-[280px] items-center justify-center rounded-2xl border border-[#00BFFF]/10 bg-[#00BFFF]/[0.02] text-center">
                <div>
                  <Gavel className="mx-auto h-7 w-7 text-[#00BFFF]/20" />

                  <p className="mt-2 text-[9px] font-black text-zinc-600">
                    No court broadcasts live
                  </p>
                </div>
              </div>
            ) : (
              courtItems.slice(0, 10).map((item) => (
                <PhoneLiveTile
                  key={item.id}
                  item={item}
                  onClick={() => {
                    const sessionId = item.id.startsWith('court-')
                      ? item.id.slice(6)
                      : item.id

                    go(`/court/${sessionId}`)
                  }}
                />
              ))
            )}
          </PhoneSection>

          {/* -------------------------------------------------------------- */}
          {/* TCNN                                                             */}
          {/* -------------------------------------------------------------- */}

          <PhoneSection
            title="TCNN News"
            icon={MessageCircle}
            count={tcnnItems.length}
            onViewAll={() => go('/tcnn')}
          >
            {tcnnItems.length === 0 ? (
              <div className="flex h-[120px] w-full min-w-[280px] items-center justify-center rounded-2xl border border-[#BF00FF]/10 bg-[#BF00FF]/[0.02] text-center">
                <div>
                  <MessageCircle className="mx-auto h-7 w-7 text-[#BF00FF]/20" />

                  <p className="mt-2 text-[9px] font-black text-zinc-600">
                    No TCNN broadcasts live
                  </p>
                </div>
              </div>
            ) : (
              tcnnItems.slice(0, 10).map((item) => (
                <PhoneLiveTile
                  key={item.id}
                  item={item}
                  onClick={() => go(`/tcnn/viewer/${item.id}`)}
                />
              ))
            )}
          </PhoneSection>

          {/* Online */}
          <PhoneOnlineUsers
            onlineUsers={onlineUsers}
            currentUserId={user?.id}
          />

          {/* -------------------------------------------------------------- */}
          {/* Community Wall                                                   */}
          {/* -------------------------------------------------------------- */}

          <button
            type="button"
            onClick={() => go('/community-wall')}
            className={`group flex w-full items-center gap-3 rounded-2xl ${neonBorder} bg-gradient-to-r from-[#BF00FF]/10 via-[#070711] to-[#00BFFF]/10 p-4 text-left transition active:scale-[0.99]`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/10">
              <MessageCircle size={18} className="text-[#BF00FF]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white">
                Community Wall
              </p>

              <p className="text-[9px] font-bold text-zinc-500">
                See what the MaiTroll community is talking about
              </p>
            </div>

            {newPostCount > 0 && (
              <span className="rounded-full bg-gradient-to-r from-[#BF00FF] to-[#00BFFF] px-2 py-1 text-[8px] font-black text-white shadow-[0_0_12px_rgba(191,0,255,0.25)]">
                {newPostCount}
              </span>
            )}

            <ArrowRight
              size={15}
              className="text-[#00BFFF]/50 transition-transform group-hover:translate-x-0.5"
            />
          </button>

          {/* -------------------------------------------------------------- */}
          {/* Creator CTA                                                     */}
          {/* -------------------------------------------------------------- */}

          {user && (
            <button
              type="button"
              onClick={() => go('/broadcast/setup')}
              className="group relative w-full overflow-hidden rounded-2xl border border-[#00BFFF]/20 bg-gradient-to-r from-[#BF00FF]/15 via-[#0d0d19] to-[#00BFFF]/15 p-4 text-left shadow-[0_0_35px_rgba(0,191,255,0.08)] transition active:scale-[0.99]"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#00BFFF]/15 blur-2xl transition-transform duration-500 group-hover:scale-125" />

              <div className="absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-[#BF00FF]/10 blur-2xl" />

              <div className="relative flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_18px_rgba(0,191,255,0.18)]">
                  <Radio size={20} className="text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">
                    Ready to Go Live?
                  </p>

                  <p className="mt-0.5 text-[9px] font-bold text-zinc-500">
                    Start your broadcast and join the Troll City network.
                  </p>
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
                  <ChevronRight
                    size={17}
                    className="text-[#00BFFF] transition-transform group-hover:translate-x-0.5"
                  />
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Quick Links */}
        <div className="mt-7">
          <PhoneQuickLinks />
        </div>

        <footer className="mt-7 border-t border-[#00BFFF]/10 py-5 text-center">
          <p className="text-[9px] font-bold text-zinc-700">
            MaiTroll • Troll City
          </p>

          <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2" aria-label="Homepage links">
            {[
              { label: 'About', path: '/about', icon: Home },
              { label: 'Contact', path: '/contact', icon: Mail },
              { label: 'Support', path: '/support', icon: HelpCircle },
              { label: 'FAQ', path: '/faq', icon: MessageCircle },
              { label: 'Privacy', path: '/privacy', icon: Shield },
              { label: 'Terms', path: '/terms', icon: FileText },
            ].map(({ label, path, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wide text-[#00BFFF]/70 transition hover:text-[#BF00FF]"
              >
                <Icon size={10} />
                {label}
              </Link>
            ))}
          </nav>

          <p className="mt-1 text-[8px] font-bold text-zinc-800">
            All rights reserved © 2025 Troll City
          </p>
        </footer>
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
