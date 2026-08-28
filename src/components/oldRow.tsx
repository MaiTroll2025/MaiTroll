import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { lazyWithRetry } from '@/utils/lazyImport'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bell,
  BookOpen,
  Crown,
  FileText,
  Gamepad2,
  Gavel,
  Gift,
  Heart,
  MessageCircle,
  Play,
  Radio,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { isPrideMonth } from '@/lib/prideMonth'
import TrollWallFeed from '@/components/home/TrollWallFeed'
import CityLawsFeesTab from '@/components/home/CityLawsFeesTab'
import LeaguesTab from '@/components/home/LeaguesTab'
import PresidentCandidatesTab from '@/components/home/PresidentCandidatesTab'
import AcademyTab from '@/components/home/AcademyTab'
import LiveAuctionMiniWindow from '@/components/home/LiveAuctionMiniWindow'
import SupportGoalReminderModal from '@/components/SupportGoalReminderModal'
import { useSupportGoalReminder } from '@/hooks/useSupportGoalReminder'
import { usePresidentSystem } from '@/hooks/usePresidentSystem'
import FloatingPoster from '@/components/home/FloatingPoster'
import JoinPoster from '@/components/home/JoinPoster'

interface AuctionShow {
  id: string
  title: string
  description?: string | null
  category?: string | null
  thumbnail_url?: string | null
  status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
  scheduled_for?: string | null
  live_started_at?: string | null
  ended_at?: string | null
  livekit_room_name?: string | null
  auctioneer_id: string
  current_lot_id?: string | null
  hls_url?: string | null
  egress_id?: string | null
}

interface LiveItem {
  id: string
  title: string
  type: 'stream' | 'podcast' | 'auction'
  viewerCount: number
  streamerName: string
  streamerAvatar: string | null
  isFeatured?: boolean
  isBattle?: boolean
  battleFormat?: string
  battleStatus?: string
  category?: string | null
}

type TabType = 'wall' | 'live' | 'universe' | 'laws-fees' | 'leagues' | 'president' | 'academy'

const PWAInstallPrompt = lazyWithRetry(() => import('../components/PWAInstallPrompt'))
const TCNNPopupWidget = lazyWithRetry(() => import('@/components/tcnn/TCNNPopupWidget'))
const FeaturedBroadcasts = lazyWithRetry(() => import('@/components/broadcast/FeaturedBroadcasts'))
const PromoSlot = lazyWithRetry(() => import('@/components/promo/PromoSlot'))
const AdRail = lazyWithRetry(() => import('@/components/promo/AdRail'))

const glass =
  'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]'
const neonCard =
  'border border-cyan-400/20 bg-[#071020]/80 backdrop-blur-2xl shadow-[0_0_28px_rgba(34,211,238,0.08)]'
const rainbowBorder =
  'relative overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:p-[1px] before:[background:linear-gradient(90deg,#ff2a6d,#ffb703,#38ff7d,#00d4ff,#a855f7,#ff2a6d)] before:[mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] before:[mask-composite:exclude]'

const OriginalBackground = React.memo(() => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#050715]" />
      <div className="absolute inset-0 opacity-[0.20] [background:radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.25),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(14,165,233,0.20),transparent_30%),radial-gradient(circle_at_50%_92%,rgba(99,102,241,0.18),transparent_36%)]" />

      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.055)_1px,transparent_1px)] bg-[length:58px_58px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_26%,rgba(3,7,18,0.72)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#050715] via-[#050715]/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050715] via-[#050715]/70 to-transparent" />
    </div>
  )
})
OriginalBackground.displayName = 'OriginalBackground'

const PrideBackground = React.memo(() => {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#050715]" />
      <div className="absolute inset-0 opacity-[0.20] [background:radial-gradient(circle_at_20%_10%,rgba(236,72,153,0.30),transparent_32%),radial-gradient(circle_at_80%_5%,rgba(34,211,238,0.25),transparent_30%),radial-gradient(circle_at_50%_92%,rgba(168,85,247,0.28),transparent_36%)]" />

      <div className="absolute -left-[12%] top-[7%] h-[64vh] w-[72vw] -rotate-12 opacity-[0.38] blur-[1px]">
        <div className="h-1/6 rounded-r-full bg-red-500/85" />
        <div className="h-1/6 rounded-r-full bg-orange-400/85" />
        <div className="h-1/6 rounded-r-full bg-yellow-300/85" />
        <div className="h-1/6 rounded-r-full bg-green-400/85" />
        <div className="h-1/6 rounded-r-full bg-blue-500/85" />
        <div className="h-1/6 rounded-r-full bg-purple-600/85" />
      </div>

      <div className="absolute -right-[18%] top-[4%] h-[76vh] w-[70vw] rotate-12 opacity-[0.40] blur-[1px]">
        <div className="h-1/6 rounded-l-full bg-red-500/85" />
        <div className="h-1/6 rounded-l-full bg-orange-400/85" />
        <div className="h-1/6 rounded-l-full bg-yellow-300/85" />
        <div className="h-1/6 rounded-l-full bg-green-400/85" />
        <div className="h-1/6 rounded-l-full bg-blue-500/85" />
        <div className="h-1/6 rounded-l-full bg-purple-600/85" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.055)_1px,transparent_1px)] bg-[length:58px_58px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_26%,rgba(3,7,18,0.72)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#09051a] via-[#09051a]/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050715] via-[#050715]/70 to-transparent" />
    </div>
  )
})
PrideBackground.displayName = 'PrideBackground'

function TopPrideHero({
  onGoLive,
  onCelebrate,
}: {
  onGoLive: () => void
  onCelebrate: () => void
}) {
  return (
    <section className={`${glass} ${rainbowBorder} rounded-2xl p-2 md:p-3`}>
      <div className="relative z-10 grid gap-2 lg:grid-cols-[1fr_140px]">
        <div className="relative min-h-[80px] overflow-hidden rounded-2xl border border-pink-400/25 bg-[#0b0d1f]/80 p-3">
          <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_8%_35%,rgba(236,72,153,0.45),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.35),transparent_35%),linear-gradient(120deg,rgba(255,42,109,0.25),rgba(255,183,3,0.14),rgba(56,255,125,0.14),rgba(0,212,255,0.18),rgba(168,85,247,0.25))]" />
          <div className="absolute bottom-0 right-0 h-full w-1/2 opacity-30 [background:linear-gradient(90deg,transparent,rgba(34,211,238,0.25)),repeating-linear-gradient(90deg,transparent_0_14px,rgba(255,255,255,0.14)_15px_16px)]" />
          <div className="relative flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white">
                <Heart className="h-2.5 w-2.5 text-pink-300" />
                Pride Month
              </span>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-bold text-cyan-100">
                Live with pride. Troll with love.
              </span>
            </div>
            <div>
              <h1 className="text-lg font-black leading-tight text-white md:text-2xl">
                Welcome to Mai Troll{' '}
                <span className="bg-gradient-to-r from-pink-400 via-yellow-300 to-cyan-300 bg-clip-text text-transparent">
                  (MaiTroll)
                </span>
              </h1>
              <p className="mt-1 max-w-2xl text-[11px] font-medium text-slate-200 md:text-xs">
                Social streaming platform for creators, streamers, and communities. 
                Livestream, chat, and engage with creators on Mai Troll.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onCelebrate}
                className="rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-3 py-1.5 text-xs font-black text-white shadow-[0_0_28px_rgba(236,72,153,0.35)] transition hover:scale-[1.02]"
              >
                Celebrate!
              </button>
              <button
                onClick={onGoLive}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-white transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
              >
                Go Live
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => onGoLive()}
          className="group hidden rounded-2xl border border-purple-400/30 bg-gradient-to-br from-purple-700/75 via-fuchsia-600/35 to-cyan-700/45 p-2.5 text-left shadow-[0_0_30px_rgba(168,85,247,0.18)] transition hover:scale-[1.02] lg:block"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 shadow-[0_0_24px_rgba(34,211,238,0.35)]">
              <Gamepad2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-white">HytroGaming</p>
              <p className="text-[8px] font-black uppercase tracking-wider text-purple-100">Watch</p>
            </div>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2">
            <p className="text-[8px] font-bold text-slate-100">Featured stream</p>
            <p className="mt-0.5 text-[7px] text-slate-300">Gaming & battles</p>
          </div>
        </button>
      </div>
    </section>
  )
}

function PrideAdRail() {
  return (
    <aside className={`${neonCard} ${rainbowBorder} hidden rounded-2xl p-3 lg:block`}>
      <div className="flex min-h-[230px] flex-col items-center justify-between rounded-xl border border-white/10 bg-black/25 p-4 text-center">
        <div>
          <p className="text-sm font-black text-white">Pride Month</p>
          <p className="mt-1 text-xs font-bold text-slate-300">Ad Spot</p>
        </div>
        <div className="relative my-4 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 blur-xl opacity-40" />
          <Heart className="relative h-16 w-16 text-pink-300 drop-shadow-[0_0_20px_rgba(236,72,153,0.9)]" />
        </div>
        <div>
          <p className="text-xs font-black text-cyan-100">Your Brand</p>
          <p className="text-xs font-bold text-slate-300">Proudly Here</p>
          <button className="mt-3 rounded-lg bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 px-3 py-2 text-xs font-black text-white">
            Advertise Now
          </button>
        </div>
      </div>
    </aside>
  )
}

function LevelStatusCard() {
  return (
    <section className={`${neonCard} rounded-2xl p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <Star className="h-4 w-4 text-yellow-300" />
            Level System
          </p>
          <p className="mt-1 text-[11px] font-bold text-slate-400">City Rank Lvl 385</p>
        </div>
        <Crown className="h-8 w-8 text-yellow-300 drop-shadow-[0_0_16px_rgba(250,204,21,0.6)]" />
      </div>
      <div className="mt-4 rounded-xl border border-fuchsia-400/30 bg-gradient-to-r from-amber-500 via-fuchsia-500 to-purple-600 px-3 py-2 text-center text-xs font-black text-white">
        VETERAN WARRIOR
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-slate-300">
        <span>XP Progress</span>
        <span>16.2%</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/10">
        <div className="h-2 w-[16.2%] rounded-full bg-gradient-to-r from-pink-500 via-yellow-300 to-cyan-300" />
      </div>
      <p className="mt-3 text-[11px] text-slate-400">
        <span className="font-black text-fuchsia-300">838 XP</span> to next level
        <span className="float-right font-black text-cyan-300">+84 bonus coins</span>
      </p>
      <div className="mt-4 space-y-2">
        {[
          ['Theme: Cyber City', 'Exclusive app theme'],
          ['Voice Room Access', 'Create voice-only rooms'],
          ['Founders Wall', 'Name listed on wall'],
        ].map(([title, sub]) => (
          <div key={title} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-white">{title}</p>
              <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-black text-yellow-300">
                legend
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function PrideCollectionCard({ onOpenStore }: { onOpenStore: () => void }) {
  return (
    <section className={`${glass} ${rainbowBorder} rounded-2xl p-4`}>
      <div className="relative z-10">
        <h3 className="text-xl font-black text-white">Pride Collection</h3>
        <p className="text-sm font-bold text-slate-200">Now Available</p>
        <p className="mt-2 text-xs text-slate-400">Limited Edition Avatars, Frames & Badges</p>
        <div className="my-5 flex items-center justify-center gap-5">
          <Crown className="h-14 w-14 text-yellow-300 drop-shadow-[0_0_18px_rgba(250,204,21,0.8)]" />
          <Heart className="h-14 w-14 text-pink-300 drop-shadow-[0_0_18px_rgba(236,72,153,0.8)]" />
          <Gift className="h-14 w-14 text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
        </div>
        <button
          onClick={onOpenStore}
          className="rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 text-sm font-black text-white shadow-[0_0_24px_rgba(236,72,153,0.25)]"
        >
          Shop Now
        </button>
      </div>
    </section>
  )
}

function PrideChallengesCard({ onOpenChallenges }: { onOpenChallenges: () => void }) {
  const now = new Date()
  const currentWeek = Math.min(4, Math.max(1, Math.ceil(now.getDate() / 7)))
  const dayOfWeek = now.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek

  const allPrideChallenges: Array<{ week: number; title: string; description: string; xp: string; color: string }> = [
    // Week 1
    { week: 1, title: 'Show Your Pride', description: 'Update your profile frame to a Pride theme', xp: '500 XP', color: 'pink' },
    { week: 1, title: 'Rainbow Greeting', description: 'Send 10 positive chat messages today', xp: '750 XP', color: 'red' },
    { week: 1, title: 'Pride Profile', description: 'Add a Pride badge to your profile', xp: '300 XP', color: 'orange' },
    { week: 1, title: 'Spread Love', description: 'Like 20 posts on the Troll Wall', xp: '400 XP', color: 'yellow' },
    { week: 1, title: 'Community Spirit', description: 'Reply to 5 different wall posts', xp: '600 XP', color: 'green' },
    // Week 2
    { week: 2, title: 'Ally Actions', description: 'Support 5 different users with gifts', xp: '1,000 XP', color: 'cyan' },
    { week: 2, title: 'Wall Storyteller', description: 'Post 3 Pride-themed messages on the wall', xp: '800 XP', color: 'purple' },
    { week: 2, title: 'Gift of Pride', description: 'Send a Pride gift to 3 friends', xp: '900 XP', color: 'pink' },
    { week: 2, title: 'Pride Explorer', description: 'Visit 5 different neighborhoods', xp: '600 XP', color: 'red' },
    // Week 3
    { week: 3, title: 'Pride Champion', description: 'Win a battle with a Pride theme equipped', xp: '1,200 XP', color: 'orange' },
    { week: 3, title: 'Family Pride', description: 'Invite a friend to join your Troll Family', xp: '1,000 XP', color: 'yellow' },
    { week: 3, title: 'Pride Collector', description: 'Purchase a Pride item from the store', xp: '750 XP', color: 'green' },
    { week: 3, title: 'Voice of Pride', description: 'Spend 30 minutes in a voice room', xp: '500 XP', color: 'cyan' },
    { week: 3, title: 'Pride Shoutout', description: 'Give 10 compliments in chat', xp: '800 XP', color: 'blue' },
    // Week 4
    { week: 4, title: 'Pride Legend', description: 'Reach top 10 on any leaderboard', xp: '2,000 XP', color: 'purple' },
    { week: 4, title: 'Pride Marathon', description: 'Be active for 5 days this week', xp: '1,500 XP', color: 'pink' },
    { week: 4, title: 'Pride Connector', description: 'Add 5 new friends to your list', xp: '900 XP', color: 'red' },
    { week: 4, title: 'Pride Creator', description: 'Share a Pride moment on your wall', xp: '1,000 XP', color: 'orange' },
    { week: 4, title: 'Ultimate Pride', description: 'Complete all other Pride challenges', xp: '5,000 XP', color: 'yellow' },
  ]

  const colorMap: Record<string, string> = {
    pink: 'border-pink-400/25 bg-pink-500/[0.07]',
    red: 'border-red-400/25 bg-red-500/[0.07]',
    orange: 'border-orange-400/25 bg-orange-500/[0.07]',
    yellow: 'border-yellow-300/25 bg-yellow-300/[0.07]',
    green: 'border-green-400/25 bg-green-500/[0.07]',
    cyan: 'border-cyan-400/25 bg-cyan-500/[0.07]',
    blue: 'border-blue-400/25 bg-blue-500/[0.07]',
    purple: 'border-purple-400/25 bg-purple-500/[0.07]',
  }

  const xpColorMap: Record<string, string> = {
    pink: 'text-pink-300',
    red: 'text-red-300',
    orange: 'text-orange-300',
    yellow: 'text-yellow-300',
    green: 'text-green-300',
    cyan: 'text-cyan-300',
    blue: 'text-blue-300',
    purple: 'text-purple-300',
  }

  const visibleChallenges = allPrideChallenges.filter(c => c.week <= currentWeek)
  const currentWeekChallenges = allPrideChallenges.filter(c => c.week === currentWeek)
  const previewChallenges = currentWeekChallenges.slice(0, 3)

  return (
    <section className={`${glass} ${rainbowBorder} rounded-2xl p-4`}>
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="rainbow-text-shimmer text-lg font-black">Pride Challenges</h3>
            <p className="text-xs text-slate-400">Week {currentWeek} of 4 • Updates Sunday</p>
          </div>
          <span className="rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-2.5 py-1 text-[10px] font-black text-pink-200">
            {visibleChallenges.length}/{allPrideChallenges.length}
          </span>
        </div>

        <div className="pride-hero-rainbow-bar mb-4 mt-3" />

        <div className="mt-3 space-y-2">
          {previewChallenges.map((ch) => (
            <div key={ch.title} className={`rounded-xl border p-3 ${colorMap[ch.color] || 'border-white/10 bg-white/[0.04]'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-white">{ch.title}</p>
                <span className={`text-[11px] font-black ${xpColorMap[ch.color] || 'text-yellow-300'}`}>{ch.xp}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">{ch.description}</p>
            </div>
          ))}
        </div>

        {currentWeekChallenges.length > 3 && (
          <p className="mt-2 text-center text-[10px] text-slate-500">
            +{currentWeekChallenges.length - 3} more this week
          </p>
        )}

        <button
          onClick={onOpenChallenges}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 px-4 py-2.5 text-xs font-black text-black shadow-[0_0_24px_rgba(236,72,153,0.25)] transition hover:scale-[1.02]"
        >
          View All Challenges →
        </button>

        <p className="mt-2 text-center text-[9px] text-slate-500">
          Next update in {daysUntilSunday} day{daysUntilSunday !== 1 ? 's' : ''} 🏳️‍🌈
        </p>
      </div>
    </section>
  )
}

function CityAnnouncementCard() {
  return (
    <section className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-white">City Announcement</h3>
          <p className="mt-1 text-sm font-bold text-slate-200">Mai Troll Stands With You</p>
        </div>
        <Shield className="h-10 w-10 text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.7)]" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-300">
        We are a community that values respect, inclusion and equality. Thank you for making Troll
        City a place where everyone is seen, heard, and celebrated. 🏳️‍🌈
      </p>
    </section>
  )
}

function CashOutCard() {
  return (
    <section className={`${glass} rounded-2xl p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black text-white">
            <Zap className="h-4 w-4 text-fuchsia-300" />
            Farm & Cash Out
          </h3>
          <p className="text-[11px] text-slate-400">Mai Troll Rewards Hub</p>
        </div>
        <button className="rounded-full bg-white/10 p-1">
          <X className="h-4 w-4 text-slate-300" />
        </button>
      </div>

      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 text-[11px] font-black">
        <button className="bg-gradient-to-r from-fuchsia-500 to-purple-600 px-2 py-2 text-white">Cashout</button>
        <button className="bg-white/[0.05] px-2 py-2 text-slate-300">Weekly</button>
        <button className="bg-white/[0.05] px-2 py-2 text-slate-300">Buy Coins</button>
      </div>

      <div className="mt-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[0.05] p-3">
        <p className="text-[11px] font-bold text-slate-300">Eligible Coins</p>
        <p className="mt-1 text-xl font-black text-white">0 coins</p>
        <p className="mt-1 text-[10px] text-slate-400">$17,986 available • 917,986 total</p>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-purple-600/35 px-3 py-2">
        <p className="text-xs font-black text-purple-100">7.5K coins</p>
        <p className="text-xs font-black text-white">$25</p>
        <span className="rounded-full bg-fuchsia-500 px-2 py-1 text-[10px] font-black text-white">NEXT</span>
      </div>
    </section>
  )
}

function HomeTabs({
  activeTab,
  setActiveTab,
  liveCount,
  battleCount,
  presidentTabLabel,
}: {
  activeTab: TabType
  setActiveTab: (tab: TabType) => void
  liveCount: number
  battleCount: number
  presidentTabLabel: string
}) {
  const tabs: Array<{
    id: TabType
    label: string
    subtitle: string
    icon: React.ElementType
    active: string
    count?: number
  }> = [
    { id: 'wall', label: 'Troll Feed', subtitle: 'Everything', icon: MessageCircle, active: 'from-pink-500 to-purple-600' },
    { id: 'live', label: 'Live Now', subtitle: 'Active streams', icon: Radio, active: 'from-red-500 to-pink-600', count: liveCount },
    { id: 'universe', label: 'Universe', subtitle: 'Explore all', icon: Sparkles, active: 'from-yellow-500 to-orange-600', count: battleCount },
    { id: 'laws-fees', label: 'City Laws & Fees', subtitle: 'Rules & info', icon: FileText, active: 'from-cyan-500 to-blue-600' },
    { id: 'leagues', label: 'Leagues', subtitle: 'Competitions', icon: Trophy, active: 'from-purple-500 to-indigo-600' },
    { id: 'president', label: 'President Candidates', subtitle: 'Elections', icon: Vote, active: 'from-amber-500 to-yellow-600' },
    { id: 'academy', label: 'Academy', subtitle: 'Learn & grow', icon: BookOpen, active: 'from-emerald-500 to-teal-600' },
  ]

  return (
    <>
      <style>{`
        @keyframes pulsatingRgbRing {
          0% {
            box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7), 0 0 20px 8px rgba(0, 255, 0, 0.3), inset 0 0 20px rgba(0, 0, 255, 0.2);
          }
          33% {
            box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7), 0 0 20px 8px rgba(0, 0, 255, 0.3), inset 0 0 20px rgba(255, 0, 0, 0.2);
          }
          66% {
            box-shadow: 0 0 0 0 rgba(0, 0, 255, 0.7), 0 0 20px 8px rgba(255, 0, 0, 0.3), inset 0 0 20px rgba(0, 255, 0, 0.2);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7), 0 0 20px 8px rgba(0, 255, 0, 0.3), inset 0 0 20px rgba(0, 0, 255, 0.2);
          }
        }
        .home-tabs-container {
          animation: pulsatingRgbRing 4s ease-in-out infinite;
        }
      `}</style>
      <div className="home-tabs-container rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.04] backdrop-blur-lg p-3 shadow-lg">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-7">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative overflow-hidden rounded-2xl px-3 py-3 text-left transition-all duration-300 ${
                selected
                  ? `bg-gradient-to-r ${tab.active} shadow-[0_0_28px_rgba(168,85,247,0.35)]`
                  : 'border border-white/10 bg-white/[0.04] hover:border-purple-400/30 hover:bg-purple-600/10'
              }`}
            >
              <div className="relative z-10 flex flex-col gap-1.5">
                <Icon className={`h-4 w-4 ${selected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`} />
                <div>
                  <p className={`text-xs font-black leading-tight ${selected ? 'text-white' : 'text-slate-200'}`}>
                    {tab.label}
                  </p>
                  <p className={`text-[10px] leading-tight ${selected ? 'text-white/80' : 'text-slate-400'}`}>
                    {tab.subtitle}
                  </p>
                </div>
                {!!tab.count && (
                  <span className={`text-[11px] font-black ${selected ? 'text-white' : 'text-cyan-300'}`}>
                    {tab.count}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
    </>
  )
}

function LiveGrid({
  liveItems,
  loadingLive,
  totalViewers,
  showLiveGrid,
  setShowLiveGrid,
  onClickItem,
}: {
  liveItems: LiveItem[]
  loadingLive: boolean
  totalViewers: number
  showLiveGrid: boolean | null
  setShowLiveGrid: (value: boolean | null) => void
  onClickItem: (item: LiveItem) => void
}) {
  const visible = showLiveGrid ?? true

  return (
    <div className="space-y-4">
      <div className={`${glass} rounded-2xl p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white">
              <Radio className="h-5 w-5 text-red-400" />
              Live Now
            </h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {liveItems.length} broadcasting • {totalViewers.toLocaleString()} watching now
            </p>
          </div>
          {liveItems.length > 0 && (
            <button
              onClick={() => setShowLiveGrid(visible ? false : true)}
              className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-100"
            >
              {visible ? 'Hide Broadcasts' : 'Show Broadcasts'}
            </button>
          )}
        </div>

        <Suspense fallback={<div className="mt-4 aspect-video rounded-xl bg-white/5" />}>
          {liveItems.some((item) => item.isFeatured) && (
            <div className="mt-4">
              <FeaturedBroadcasts />
            </div>
          )}
        </Suspense>

        {visible && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {loadingLive ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-white/5" />
              ))
            ) : liveItems.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center">
                <Radio className="mx-auto h-10 w-10 text-slate-600" />
                <p className="mt-3 text-sm font-bold text-slate-400">No one is live right now</p>
              </div>
            ) : (
              liveItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onClickItem(item)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 text-left transition hover:border-cyan-300/60"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 via-slate-950 to-cyan-900/50" />
                  {item.type === 'auction' ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Gavel className="h-16 w-16 text-cyan-300/40" />
                    </div>
                  ) : item.streamerAvatar ? (
                    <img src={item.streamerAvatar} alt={item.streamerName} className="absolute inset-0 h-full w-full object-cover opacity-80" />
                  ) : (
                    <Play className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-white/20" />
                  )}
                  <div className="absolute left-2 top-2 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white">LIVE</div>
                  <div className="absolute right-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-black text-white">
                    👁 {item.viewerCount}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-3">
                    <p className="truncate text-sm font-black text-white">{item.title}</p>
                    <p className="truncate text-xs font-bold text-slate-300">{item.streamerName}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BattleGrid({ items, onClickItem }: { items: LiveItem[]; onClickItem: (item: LiveItem) => void }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <h2 className="flex items-center gap-2 text-xl font-black text-white">
        <Sparkles className="h-5 w-5 text-yellow-300" />
        Universal Battles
      </h2>
      <p className="mt-1 text-xs font-bold text-slate-400">{items.length} active battle streams</p>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-yellow-600" />
          <p className="mt-3 text-sm font-bold text-slate-400">No Universal Battles active</p>
          <p className="mt-1 text-xs text-slate-500">Start a battle from your live stream.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onClickItem(item)}
              className="rounded-2xl border border-yellow-300/20 bg-gradient-to-br from-yellow-900/35 to-orange-950/45 p-4 text-left transition hover:border-yellow-300/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-yellow-500 px-2 py-1 text-[10px] font-black text-black">
                  {item.battleFormat?.toUpperCase() || 'BATTLE'}
                </span>
                <span className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                  {item.battleStatus || 'active'}
                </span>
              </div>
              <p className="mt-3 truncate text-base font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs font-bold text-yellow-200">
                {item.streamerName} • {item.viewerCount} viewers
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LeftSidebar({ liveItems }: { liveItems: LiveItem[] }) {
  const topLive = liveItems.slice(0, 5)
  
  return (
    <aside className="hidden space-y-3 lg:block">
      {/* Live Right Now */}
      <div className={`${neonCard} rounded-2xl p-4`}>
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <Radio className="h-4 w-4 text-red-400" />
          LIVE RIGHT NOW
        </h3>
        <p className="mt-1 text-[10px] text-slate-400">Top streamers</p>
        
        <div className="mt-3 space-y-2">
          {topLive.length === 0 ? (
            <p className="text-xs text-slate-500">No one live</p>
          ) : (
            topLive.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 transition hover:bg-white/[0.08]">
                <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-purple-500 to-cyan-500">
                  {item.streamerAvatar && (
                    <img src={item.streamerAvatar} alt={item.streamerName} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-white">{item.streamerName}</p>
                  <p className="truncate text-[10px] text-slate-400">{item.category || 'Chat'}</p>
                </div>
                <span className="flex-shrink-0 text-[10px] font-black text-red-300">👁 {item.viewerCount}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trending Topics */}
      <div className={`${neonCard} rounded-2xl p-4`}>
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          TRENDING TOPICS
        </h3>
        
        <div className="mt-3 space-y-2">
          {[
            { name: 'PrideMonth', count: 12.4 },
            { name: 'TrollWall', count: 8.7 },
            { name: 'CityElections', count: 5.9 },
            { name: 'BattleNight', count: 3.1 },
            { name: 'TCNN', count: 2.3 },
          ].map((trend) => (
            <button key={trend.name} className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-2 text-left transition hover:bg-white/[0.08]">
              <p className="text-[10px] font-black text-cyan-300">#{trend.name}</p>
              <p className="text-[9px] text-slate-400">{trend.count}K posts</p>
            </button>
          ))}
        </div>
      </div>

      {/* Online Friends */}
      <div className={`${neonCard} rounded-2xl p-4`}>
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <Users className="h-4 w-4 text-green-400" />
          ONLINE FRIENDS
        </h3>
        <p className="mt-1 text-[10px] text-slate-400">28 Online</p>
        
        <div className="mt-3 space-y-2">
          {[
            { name: 'ShadowDream', status: 'In a live stream' },
            { name: 'QueenTroll', status: 'In a live stream' },
            { name: 'OG_Jester', status: 'Online' },
            { name: 'PixlPerfect', status: 'Away' },
          ].map((friend) => (
            <div key={friend.name} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <div className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-purple-500">
                <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-400 border border-white/50" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-white">{friend.name}</p>
                <p className="truncate text-[9px] text-slate-400">{friend.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function RightSidebar({ user, liveAuctions, isPride, onOpenStore, onOpenChallenges }: { user: any; liveAuctions: AuctionShow[]; isPride: boolean; onOpenStore: () => void; onOpenChallenges: () => void }) {
  return (
    <aside className="hidden space-y-3 md:block">
      {/* Pride Month Widget */}
      {isPride && (
        <div className={`${glass} ${rainbowBorder} rounded-2xl p-4`}>
          <h3 className="text-sm font-black text-white">Pride Month 🏳️‍🌈</h3>
          <p className="mt-1 text-[10px] text-slate-400">Live with pride. Troll with love.</p>
          
          <div className="mt-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 p-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-black text-cyan-300">75% Complete</span>
              <span className="text-slate-400">Ends June 30th</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-black/50">
              <div className="h-2 w-[75%] rounded-full bg-gradient-to-r from-pink-500 via-yellow-300 to-cyan-300" />
            </div>
          </div>
          
          <button
            onClick={onOpenChallenges}
            className="mt-3 w-full rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-2 text-xs font-black text-white"
          >
            View Challenges
          </button>
        </div>
      )}

      {/* Live Battles */}
      <div className={`${neonCard} rounded-2xl p-4`}>
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <Sparkles className="h-4 w-4 text-yellow-300" />
          Live Battles
        </h3>
        <p className="mt-1 text-[10px] text-slate-400">2,089 LIVE</p>
        
        <div className="mt-3 space-y-2">
          {[
            { name: 'Team Chaos', vs: 'Team Order', viewers: 1245, state: 'LIVE' },
            { name: 'Team Chaos', vs: 'Team Order', viewers: 987, state: 'LIVE' },
          ].map((battle, idx) => (
            <button key={idx} className="w-full rounded-lg border border-yellow-300/20 bg-yellow-900/20 p-2 text-left transition hover:bg-yellow-900/40">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-yellow-300">{battle.name}</p>
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white">🔴 LIVE</span>
              </div>
              <p className="mt-1 text-[9px] text-slate-400">vs {battle.vs} • 👁 {battle.viewers}</p>
            </button>
          ))}
        </div>
        
        <button className="mt-3 w-full rounded-lg border border-yellow-300/30 bg-yellow-600/10 px-3 py-2 text-xs font-black text-yellow-300 transition hover:bg-yellow-600/20">
          Watch Battle
        </button>
      </div>

      {/* City Announcement */}
      <div className={`${glass} rounded-2xl p-4`}>
        <h3 className="flex items-center gap-2 text-sm font-black text-white">
          <Shield className="h-4 w-4 text-cyan-300" />
          City Announcement
        </h3>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          City elections are now LIVE! Vote for your next president and shape the future of Mai Troll.
        </p>
        <button className="mt-3 w-full rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 px-3 py-2 text-xs font-black text-white">
          Vote Now
        </button>
      </div>

      {/* Level Progress */}
      <div className={`${neonCard} rounded-2xl p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1 text-sm font-black text-white">
              <Star className="h-4 w-4 text-yellow-300" />
              Level 24
            </p>
            <p className="text-[10px] text-slate-400">Veteran Warrior</p>
          </div>
          <Crown className="h-6 w-6 text-yellow-300" />
        </div>
        
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-black">
            <span className="text-slate-300">XP Progress</span>
            <span className="text-cyan-300">68%</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/10">
            <div className="h-2 w-[68%] rounded-full bg-gradient-to-r from-pink-500 via-yellow-300 to-cyan-300" />
          </div>
        </div>
        
        <p className="mt-2 text-[9px] text-slate-400">
          <span className="font-black text-cyan-300">91,234 XP</span> to next level
        </p>
      </div>
    </aside>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isLoading = useAuthStore((state) => state.isLoading)

  const [activeTab, setActiveTab] = useState<TabType>('wall')
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [totalViewers, setTotalViewers] = useState(0)
  const [loadingLive, setLoadingLive] = useState(true)
  const [showLiveGrid, setShowLiveGrid] = useState<boolean | null>(null)
  const [liveAuctions, setLiveAuctions] = useState<AuctionShow[]>([])
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Fetch live streams list (callable from realtime handlers)
  const fetchLiveContent = async () => {
    try {
      const { data: streamsData, error: streamsError } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          current_viewers,
          viewer_count,
          is_featured,
          battle_mode,
          battle_format,
          battle_status,
          broadcaster_id
        `)
        .eq('is_live', true)
        .order('is_featured', { ascending: false })
        .order('current_viewers', { ascending: false })
        .limit(100)

      if (streamsError) throw streamsError

      const broadcasterIds = Array.from(new Set((streamsData || []).map((s: any) => s.broadcaster_id).filter(Boolean)))
      let broadcasterMap = new Map<string, any>()

      if (broadcasterIds.length > 0) {
        const { data: broadcasters, error: broadcasterError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', broadcasterIds)

        if (!broadcasterError && broadcasters) {
          broadcasterMap = new Map(broadcasters.map((b: any) => [b.id, b]))
        }
      }

      if (!mountedRef.current) return

      const streams: LiveItem[] = (streamsData || []).map((stream: any) => {
        const broadcaster = broadcasterMap.get(stream.broadcaster_id)
        return {
          id: stream.id,
          title: stream.title || 'Untitled Stream',
          type: 'stream',
          viewerCount: stream.current_viewers || stream.viewer_count || 0,
          streamerName: broadcaster?.username || 'Unknown',
          streamerAvatar: broadcaster?.avatar_url || null,
          isFeatured: stream.is_featured || false,
          isBattle: stream.battle_mode === 'universal',
          battleFormat: stream.battle_format,
          battleStatus: stream.battle_status,
          category: stream.category || null,
        }
      })

      setLiveItems(streams)
      setTotalViewers(streams.reduce((sum, item) => sum + item.viewerCount, 0))
    } catch (err) {
      console.error('Error fetching live content:', err)
    } finally {
      if (mountedRef.current) setLoadingLive(false)
    }
  }
  const [supportGoalReminder, setSupportGoalReminder] = useState<any>(null)
  const [reminderLoading, setReminderLoading] = useState(false)

  const {
    reminder: supportReminder,
    loading: reminderLoadingState,
    refetch: fetchSupportReminder,
  } = useSupportGoalReminder()
  const { currentElection, currentPresident } = usePresidentSystem()

  const presidentTabLabel = currentElection?.status === 'open'
    ? 'President Candidates'
    : currentPresident
      ? 'President'
      : 'President Office'

  const battleItems = useMemo(() => liveItems.filter((item) => item.isBattle), [liveItems])

  const auctionItems = useMemo(() => liveAuctions.map((auction) => ({
    id: auction.id,
    title: auction.title || 'Untitled Auction',
    type: 'auction' as const,
    viewerCount: 0,
    streamerName: 'Auction',
    streamerAvatar: null,
    isFeatured: false,
    isBattle: false,
  })), [liveAuctions])

  const allLiveItems = useMemo(() => [...liveItems, ...auctionItems], [liveItems, auctionItems])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (user?.id) {
      // Hook fetches automatically; keeping dependency preserves existing reminder wiring.
    }
  }, [user?.id, fetchSupportReminder])

  useEffect(() => {
    setSupportGoalReminder(supportReminder)
    setReminderLoading(reminderLoadingState)
  }, [supportReminder, reminderLoadingState])

  useEffect(() => {
    let mounted = true
    // Move fetchLiveContent to component scope so it can be invoked by realtime handlers.
    mounted = true
    fetchLiveContent()

    // Poll as a fallback for visibility edge cases
    const interval = setInterval(() => {
      fetchLiveContent()
    }, 60000)

    // Realtime subscription: refresh live list the second a stream row changes
    // OPTIMIZED: Only listen to UPDATE events (not INSERT/DELETE) since we only care about status changes
    const channel = supabase.channel('home:live-streams')
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams' }, (payload) => {
      try {
        // Only refresh when live status or viewer counts or featured flags change
        const oldRow = (payload.old || null) as any
        const newRow = (payload.new || null) as any
        const relevantChange = (() => {
          if (!oldRow && newRow) return newRow.is_live === true
          if (oldRow && !newRow) return oldRow.is_live === true
          if (oldRow && newRow) {
            if ((oldRow.is_live || newRow.is_live) && oldRow.is_live !== newRow.is_live) return true
            const keys = ['current_viewers','viewer_count','is_featured','battle_mode','battle_format','battle_status']
            return keys.some(k => (oldRow as any)[k] !== (newRow as any)[k])
          }
          return false
        })()

        if (relevantChange) {
          fetchLiveContent()
        }
      } catch (e) {
        console.warn('home:live-streams handler error', e)
      }
    })

    channel.subscribe()

    return () => {
      mounted = false
      clearInterval(interval)
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const fetchLiveAuctions = async () => {
      try {
        const { data, error } = await supabase
          .from('auction_shows')
          .select('*')
          .eq('status', 'live')
          .order('live_started_at', { ascending: false })
          .limit(1)

        if (error) throw error
        if (mounted) setLiveAuctions(data || [])
      } catch (err) {
        console.error('Error fetching live auctions:', err)
      }
    }

    fetchLiveAuctions()
    const interval = setInterval(fetchLiveAuctions, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const requireAuth = useCallback(
    (intent?: string) => {
      if (user) return true
      toast.info(`Sign in to ${intent || 'continue'}.`)
      navigate('/auth')
      return false
    },
    [navigate, user],
  )

  const handleLiveItemClick = (item: LiveItem) => {
    if (item.type === 'auction') {
      navigate(`/auctions/${item.id}`)
    } else if (item.category === 'gaming') {
      navigate(`/gaming/watch/${item.id}`)
    } else {
      navigate(`/watch/${item.id}`)
    }
  }

  const goLive = () => {
    if (!requireAuth('go live')) return
    navigate('/broadcast/setup')
  }

  const openChallenges = () => {
    setActiveTab('leagues')
  }

  const openStore = () => {
    if (!requireAuth('open the Pride collection')) return
    navigate('/store')
  }

  return (
    <div className="relative min-h-full w-full overflow-y-auto overflow-x-hidden md:overflow-hidden text-white">
      {isPrideMonth() ? <PrideBackground /> : <OriginalBackground />}

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050715]/85 backdrop-blur-md">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-purple-500/30 border-t-cyan-300" />
            <p className="text-sm font-bold text-slate-300">Loading Mai Troll...</p>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <TCNNPopupWidget onRequireAuth={requireAuth} />
      </Suspense>

      <Suspense fallback={null}>
        <PWAInstallPrompt />
      </Suspense>

      <main className="relative z-10 mx-auto flex w-full max-w-[1520px] flex-col gap-3 px-3 pb-8 pt-3 md:px-5">
        <TopPrideHero onGoLive={goLive} onCelebrate={openChallenges} />

        {/* Browse Categories — SEO internal linking hub */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-6">
          {[
            { slug: 'gaming', label: 'Gaming', subtitle: 'HytroGaming', icon: Gamepad2, active: 'from-green-600 to-emerald-600', href: '/hytrogaming' },
            { slug: 'just-chatting', label: 'Chat', subtitle: 'UtroMail', icon: MessageCircle, active: 'from-purple-600 to-pink-600' },
            { slug: 'education', label: 'Learn', subtitle: 'Academy', icon: BookOpen, active: 'from-slate-600 to-zinc-600' },
            { slug: 'entertainment', label: 'Fun', subtitle: 'Troll Wheel', icon: Sparkles, active: 'from-rose-600 to-pink-600' },
            { slug: 'politics', label: 'Politics', subtitle: 'Government', icon: Vote, active: 'from-indigo-600 to-blue-600' },
            { slug: 'news', label: 'News', subtitle: 'TCNN', icon: Radio, active: 'from-red-600 to-orange-600' },
          ].map((cat) => {
            const Icon = cat.icon
            const to = cat.href || `/categories/${cat.slug}`
            return (
              <Link
                key={cat.slug}
                to={to}
                className={`group relative overflow-hidden rounded-2xl px-3 py-3 text-left transition-all duration-300 border border-white/10 bg-white/[0.04] hover:border-purple-400/30 hover:bg-purple-600/10`}
              >
                <div className="relative z-10 flex flex-col gap-1.5">
                  <Icon className="h-4 w-4 text-slate-300 group-hover:text-white" />
                  <div>
                    <p className="text-xs font-black leading-tight text-slate-200">
                      {cat.label}
                    </p>
                    <p className="text-[10px] leading-tight text-slate-400">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <HomeTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          liveCount={allLiveItems.length}
          battleCount={battleItems.length}
          presidentTabLabel={presidentTabLabel}
        />

        <Suspense fallback={null}>
          <div className="hidden lg:block">
            <PromoSlot placement="home_horizontal_banner" variant="horizontal" />
          </div>
        </Suspense>

        {activeTab === 'wall' && (
          <section className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_280px] lg:grid-cols-[1fr_240px_240px] xl:grid-cols-[140px_minmax(0,1fr)_240px_240px]">
            <div className="hidden xl:block">
              {isPrideMonth() && <PrideAdRail />}
              <Suspense fallback={null}>
                <div className="mt-3">
                  <AdRail placement="left_rail" />
                </div>
              </Suspense>
            </div>

            <div className="min-w-0 space-y-3">
              <div className={`${glass} rounded-2xl p-4`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-2xl font-black text-white">
                      Troll Wall <span>🏳️‍🌈</span>
                    </h2>
                    <p className="text-sm font-medium text-slate-400">The live social pulse of Mai Troll.</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                    ∞ LIVE FEED
                  </span>
                </div>

                <TrollWallFeed onRequireAuth={requireAuth} feedClassName="w-full" />
              </div>
            </div>

            <div className="hidden space-y-3 md:block">
              <LevelStatusCard />
              <FloatingPoster />
              {liveAuctions.length > 0 && (
                <LiveAuctionMiniWindow auction={liveAuctions[0]} onRequireAuth={requireAuth} />
              )}
            </div>

            <div className="hidden space-y-3 md:block">
              {isPrideMonth() && (
                <>
                  <PrideCollectionCard onOpenStore={openStore} />
                  <PrideChallengesCard onOpenChallenges={openChallenges} />
                  <CityAnnouncementCard />
                </>
              )}
            </div>
          </section>
        )}

        {activeTab === 'live' && (
          <LiveGrid
            liveItems={allLiveItems}
            loadingLive={loadingLive}
            totalViewers={allLiveItems.reduce((sum, item) => sum + item.viewerCount, 0)}
            showLiveGrid={showLiveGrid}
            setShowLiveGrid={setShowLiveGrid}
            onClickItem={handleLiveItemClick}
          />
        )}

        {activeTab === 'universe' && <BattleGrid items={battleItems} onClickItem={handleLiveItemClick} />}

        {activeTab === 'laws-fees' && (
          <section className={`${glass} rounded-2xl p-4`}>
            <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" /></div>}>
              <CityLawsFeesTab />
            </Suspense>
          </section>
        )}

        {activeTab === 'leagues' && (
          <section className={`${glass} rounded-2xl p-4`}>
            <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-300 border-t-transparent" /></div>}>
              <LeaguesTab />
            </Suspense>
          </section>
        )}

        {activeTab === 'president' && (
          <section className={`${glass} rounded-2xl p-4`}>
            <Suspense fallback={<div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" /></div>}>
              <PresidentCandidatesTab />
            </Suspense>
          </section>
        )}

        {activeTab === 'academy' && (
          <AcademyTab />
        )}
      </main>

      <JoinPoster />

      {supportGoalReminder && !reminderLoading && (
        <SupportGoalReminderModal
          isOpen={true}
          onClose={() => setSupportGoalReminder(null)}
          broadcaster={supportGoalReminder}
        />
      )}
    </div>
  )
}
