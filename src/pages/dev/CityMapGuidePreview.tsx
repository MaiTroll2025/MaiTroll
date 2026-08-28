/**
 * City Map Guide — Gamified Interactive Landing Page (Dev Preview)
 *
 * Access: /dev/city-map-guide-preview
 *
 * Once approved, move to:  src/pages/PublicLandingPage.tsx
 * Components to extract:   src/components/home/CityMapGuide.tsx
 *                           src/components/home/BeginnerChecklist.tsx
 *                           src/components/home/CityTourMode.tsx
 *                           src/components/home/RolePathCards.tsx
 *                           src/components/home/LiveCityPreview.tsx
 *                           src/components/home/FeatureExplainer.tsx
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import {
  Radio, Users, Play, Zap, Sparkles, Gift, Sword,
  Crown, Castle, Badge, Shield, Eye, Compass, Mic,
  ArrowRight, ChevronLeft, ChevronRight, X, MapPin,
  Video, Coins, ScrollText, GraduationCap, ShoppingBag,
  Building2, Newspaper, Briefcase, Gem, Star, Flame,
  Repeat, Home as HomeIcon, Lock, Unlock, Heart, Trophy, Flag,
  Hourglass, Layout, MessageSquare, Send, Landmark, Megaphone
} from 'lucide-react'
import { MaiTrollTheme } from '../../styles/trollCityTheme'

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO / MOCK DATA
// ═══════════════════════════════════════════════════════════════════════════════

const LIVE_CITY_EVENTS: ActivityEvent[] = [
  { id: '1', type: 'live',      message: '🎙️ DJBigBeats went live in Broadcast District',    priority: 'medium', created_at: new Date(Date.now() - 30000).toISOString(), metadata: { url: '/watch/demo1' } },
  { id: '2', type: 'gift',      message: '🎁 Tyson sent a 💎 Diamond — level up unlocked!', priority: 'medium', created_at: new Date(Date.now() - 60000).toISOString() },
  { id: '3', type: 'battle',    message: '⚔️ Universal Battle is underway — support your team!', priority: 'high',   created_at: new Date(Date.now() - 120000).toISOString(), metadata: { url: '/watch/demo3' } },
  { id: '4', type: 'tcnn_live', message: '📰 TCNN: Friday Battle Day is LIVE all across the city', priority: 'high',   created_at: new Date(Date.now() - 180000).toISOString(), metadata: { url: '/tcnn' } },
  { id: '5', type: 'system',    message: '🏠 A new house hit the market in Platinum Ridge',    priority: 'medium', created_at: new Date(Date.now() - 240000).toISOString(), metadata: { url: '/neighborhood-setup' } },
  { id: '6', type: 'gift',      message: '🎁 StormRider dropped a 🚀 Rocket — coin store x2!', priority: 'medium', created_at: new Date(Date.now() - 300000).toISOString() },
]

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRICT DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface District {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  color: string      // accent color class (text-*)
  glow: string       // box-shadow glow
  badgeText: string
  badgeColor: string
  gridArea?: string  // for 3x3 placement
}

const DISTRICTS: District[] = [
  {
    id:        'broadcast',
    name:      'Broadcast District',
    icon:      <Radio className="w-7 h-7" />,
    description: 'Watch live streams, join seats, chat, and send gifts to creators. The heart of the city.',
    color:  'text-red-400',
    glow:   '0 0 30px rgba(248,113,113,0.35)',
    badgeText: '24 / 7 LIVE',
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30',
    gridArea: '1 / 1 / 2 / 2',
  },
  {
    id:        'battle',
    name:      'Battle Arena',
    icon:      <Sword className="w-7 h-7" />,
    description: 'Friday Battle Day, random matchups, support teams with coins, and climb the rankings.',
    color:  'text-amber-400',
    glow:   '0 0 30px rgba(251,191,36,0.35)',
    badgeText: 'FRIDAY LIVE',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    gridArea: '1 / 2 / 2 / 3',
  },
  {
    id:        'court',
    name:      'Troll Court',
    icon:      <Building2 className="w-7 h-7" />,
    description: 'Court-themed hearings, cases, judges, prosecutors, attorneys, and audience seats.',
    color:  'text-violet-400',
    glow:   '0 0 30px rgba(167,139,250,0.35)',
    badgeText: 'IN SESSION',
    badgeColor: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    gridArea: '1 / 3 / 2 / 4',
  },
  {
    id:        'utromail',
    name:      'Utromail Station',
    icon:      <Shield className="w-7 h-7" />,
    description: 'City law enforcement: officers, reports, arrests, and the jail system.',
    color:  'text-cyan-400',
    glow:   '0 0 30px rgba(34,211,238,0.35)',
    badgeText: 'ON PATROL',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    gridArea: '2 / 1 / 3 / 2',
  },
  {
    id:        'neighborhood',
    name:      'Neighborhoods',
    icon:      <HomeIcon className="w-7 h-7" />,
    description: 'Own houses, join neighborhoods, raid properties, and build your city reputation.',
    color:  'text-emerald-400',
    glow:   '0 0 30px rgba(52,211,153,0.35)',
    badgeText: 'OWN PROPERTY',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    gridArea: '2 / 2 / 3 / 3',
  },
  {
    id:        'coins',
    name:      'Coin Store',
    icon:      <Coins className="w-7 h-7" />,
    description: 'Buy coins, send gifts, unlock features, run ads, and power your city activity.',
    color:  'text-yellow-400',
    glow:   '0 0 30px rgba(250,204,21,0.35)',
    badgeText: 'OPEN',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    gridArea: '2 / 3 / 3 / 4',
  },
  {
    id:        'tcnn',
    name:      'TCNN News',
    icon:      <Newspaper className="w-7 h-7" />,
    description: 'City news, drama, announcements, broadcasts, and live event coverage.',
    color:  'text-blue-400',
    glow:   '0 0 30px rgba(96,165,250,0.35)',
    badgeText: 'ON AIR',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    gridArea: '3 / 1 / 4 / 2',
  },
  {
    id:        'mai',
    name:      'MAICorp Jobs',
    icon:      <Briefcase className="w-7 h-7" />,
    description: 'Apply for Mai Troll roles — officer, court staff, city admin, broadcaster, journalist.',
    color:  'text-pink-400',
    glow:   '0 0 30px rgba(244,114,182,0.35)',
    badgeText: 'HIRING',
    badgeColor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    gridArea: '3 / 2 / 4 / 3',
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// BEGINNER CHECKLIST STEPS
// ═══════════════════════════════════════════════════════════════════════════════

interface ChecklistStep {
  step: number
  title: string
  description: string
  icon: React.ReactNode
  actionLabel: string
  actionPath: string
  completed?: boolean
}

function getDefaultSteps(): ChecklistStep[] {
  return [
    { step: 1, title: 'Create your city profile', description: 'Pick a username, avatar, and make your Mai Troll identity.', icon: <Users className="w-5 h-5" />, actionLabel: 'Set up profile →', actionPath: '/profile/setup' },
    { step: 2, title: 'Pick your neighborhood', description: 'Choose a district and find a house to call home in the city.', icon: <HomeIcon className="w-5 h-5" />, actionLabel: 'Explore neighborhoods →', actionPath: '/neighborhood-setup' },
    { step: 3, title: 'Watch a broadcast', description: 'See what city content is live. Click a stream and join the chat.', icon: <Play className="w-5 h-5" />, actionLabel: 'Watch a stream →', actionPath: '/live' },
    { step: 4, title: 'Send or earn coins', description: 'Top up at the Coin Store or earn coins by engaging with the city.', icon: <Coins className="w-5 h-5" />, actionLabel: 'Open Coin Store →', actionPath: '/coin-store' },
    { step: 5, title: 'Join a seat or battle', description: 'Enter a broadcast seat to be on camera, or jump into a Friday Battle.', icon: <Sword className="w-5 h-5" />, actionLabel: 'View battles →', actionPath: '/live' },
    { step: 6, title: 'Level up with XP', description: 'Sending gifts and going live earns XP. Watch your rank climb.', icon: <Gift className="w-5 h-5" />, actionLabel: 'Check your XP →', actionPath: '/profile/settings' },
    { step: 7, title: 'Apply for city roles', description: 'Work for MAICorp as a broadcaster, officer, court staff, or journalist.', icon: <Briefcase className="w-5 h-5" />, actionLabel: 'Browse jobs →', actionPath: '/' },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE PATH DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface RolePath {
  id: string
  name: string
  icon: React.ReactNode
  color: string
  description: string
  whatYouDo: string[]
  howToStart: string
  whereToGo: string
}

const ROLE_PATHS: RolePath[] = [
  {
    id: 'viewer', name: 'Viewer', icon: <Eye className="w-5 h-5" />,
    color: 'text-cyan-400',
    description: 'The foundation of the city. Watch, chat, support, and grow.',
    whatYouDo: ['Watch live streams', 'Send gifts & coins', 'Join seats', 'Earn XP daily'],
    howToStart: 'Sign up and explore. No application needed.',
    whereToGo: '/live',
  },
  {
    id: 'broadcaster', name: 'Broadcaster', icon: <Mic className="w-5 h-5" />,
    color: 'text-pink-400',
    description: 'Create content, build an audience, and earn from your city.',
    whatYouDo: ['Stream live to your city', 'Accept coins & gifts', 'Set paid chat prices', 'Build your Troll Wall'],
    howToStart: 'Go live from the Broadcast District.',
    whereToGo: '/broadcast/setup',
  },
  {
    id: 'battler', name: 'Battler', icon: <Sword className="w-5 h-5" />,
    color: 'text-amber-400',
    description: 'Face off head-to-head in live broadcast battles for coins and XP.',
    whatYouDo: ['Join Friday Battle Day matches', 'Support teams with coins', 'Climb city rankings', 'Win prizes & badges'],
    howToStart: 'Go live and enable Battle Mode on Friday.',
    whereToGo: '/broadcast/setup',
  },
  {
    id: 'utromail-officer', name: 'Utromail Officer', icon: <Shield className="w-5 h-5" />,
    color: 'text-cyan-400',
    description: 'City law enforcement. Patrol, respond, and keep the city running.',
    whatYouDo: ['Respond to city reports', 'Patrol broadcast rooms', 'Handle enforcement actions', 'Manage the jail system'],
    howToStart: 'Apply through MAICorp after reaching the required level.',
    whereToGo: '/utromail',
  },
  {
    id: 'attorney', name: 'Court Attorney', icon: <ScrollText className="w-5 h-5" />,
    color: 'text-violet-400',
    description: 'Defend or prosecute users in Troll Court hearings paneled by real judges.',
    whatYouDo: ['Take on cases', 'Represent users in court hearings', 'Argue before judges', 'Build your legal record'],
    howToStart: 'Apply for the attorney program through the court.',
    whereToGo: '/troll-court',
  },
  {
    id: 'prosecutor', name: 'Prosecutor', icon: <Landmark className="w-5 h-5" />,
    color: 'text-purple-400',
    description: 'Prosecute violations and represent the city in court.',
    whatYouDo: ['File charges against violations', 'Present cases in court', 'Request penalties & bans', 'Vet jail sentences'],
    howToStart: 'Apply through MAICorp to join the legal team.',
    whereToGo: '/troll-court',
  },
  {
    id: 'tcnn', name: 'TCNN Journalist', icon: <Megaphone className="w-5 h-5" />,
    color: 'text-blue-400',
    description: 'Report city news, host live events, and keep Mai Troll informed.',
    whatYouDo: ['Report on live city events', 'Host breaking-news segments', 'Cover battles & court rulings', 'Build your brand as a news anchor'],
    howToStart: 'Apply through TCNN after reaching minimum level.',
    whereToGo: '/tcnn',
  },
  {
    id: 'city-staff', name: 'City Staff', icon: <Gem className="w-5 h-5" />,
    color: 'text-emerald-400',
    description: 'Behind-the-scenes roles keeping the city operational.',
    whatYouDo: ['Coordinate city events', 'Support heavy user traffic', 'Assist with moderator work', 'Keep city features running'],
    howToStart: 'Apply through MAICorp Jobs and pass the interview.',
    whereToGo: '/',
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE EXPLAINER DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface FeatureExplain {
  id: string
  icon: React.ReactNode
  title: string
  content: string
  color: 'cyan' | 'pink' | 'purple' | 'gold' | 'green'
}

const FEATURES: FeatureExplain[] = [
  {
    id: 'gifts-xp',
    icon: <Gift className="w-5 h-5" />,
    title: 'Gifts & XP',
    content: 'Sending any gift gives XP to both the sender and the broadcaster. Upgrade your standing and unlock new profile perks.',
    color: 'pink',
  },
  {
    id: 'paid-chat',
    icon: <MessageSquare className="w-5 h-5" />,
    title: 'Paid Chat',
    content: 'Broadcasters can set a minimum coin cost per chat message. Viewers pay that gift amount to talk live in the chat.',
    color: 'gold',
  },
  {
    id: 'seats',
    icon: <Users className="w-5 h-5" />,
    title: 'Seats',
    content: 'Join a broadcaster\'s seat during a live stream to appear on camera with them. Assigned by the broadcaster.',
    color: 'purple',
  },
  {
    id: 'friday-battles',
    icon: <Flame className="w-5 h-5" />,
    title: 'Friday Battle Day',
    content: 'Every Friday, battles are active across the city all day long. Your coins are your vote — use them wisely.',
    color: 'amber',
  },
  {
    id: 'jail-utromail',
    icon: <Lock className="w-5 h-5" />,
    title: 'Jail & Utromail',
    content: 'MaiTroll uses a jail system instead of boring bans. Utromail officers manage arrests, reports, and inmate records.',
    color: 'cyan',
  },
  {
    id: 'houses-raids',
    icon: <HomeIcon className="w-5 h-5" />,
    title: 'Houses & Raids',
    content: 'Your house is part of the city. Neighbors can raid, defend, and upgrade. Use the Neighborhood Map to manage properties.',
    color: 'green',
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// TOUR STEPS
// ═══════════════════════════════════════════════════════════════════════════════

interface TourStep {
  id: string
  sectionTitle: string
  title: string
  description: string
  targetId: string           // element to highlight
  actionLabel: string
  actionPath: string
}

function buildTourSteps(): TourStep[] {
  return [
    {
      id: 'hero', sectionTitle: '🎯 Welcome Tour',
      title: 'Welcome to Mai Troll!',
      description: 'A live city where broadcasting, battles, courts, neighborhoods, and real-time drama all connect. Use keyboard ← → to navigate.',
      targetId: 'tc-hero', actionLabel: 'Start Exploring →', actionPath: '#tc-districts',
    },
    {
      id: 'districts', sectionTitle: '🏙️ The City',
      title: 'The Interactive City Map',
      description: 'MaiTroll is divided into 8 districts. Click any card to explore — each district has its own rules, features, and drama.',
      targetId: 'tc-districts', actionLabel: 'Explore a district →', actionPath: '/live',
    },
    {
      id: 'checklist', sectionTitle: '🚀 Getting Started',
      title: 'Your First 7 Steps',
      description: 'Confused where to start? Complete these 7 steps in order. Each one opens the right page and explains exactly what to do.',
      targetId: 'tc-checklist', actionLabel: 'View Checklist →', actionPath: '/profile/setup',
    },
    {
      id: 'features', sectionTitle: '📚 How It Works',
      title: 'City Features Explained',
      description: 'Gifts, paid chat, seats, Friday Battle Day, jail, neighborhoods & raids — everything you need to know before you dive in.',
      targetId: 'tc-features', actionLabel: 'Learn More →', actionPath: '/broadcast/setup',
    },
    {
      id: 'roles', sectionTitle: '👤 Find Your Path',
      title: 'Choose a Role Path',
      description: 'Viewer → Broadcaster → Battler → Officer → Court → Journalist → City Staff. Each path explains what you do and where to go.',
      targetId: 'tc-roles', actionLabel: 'Pick a role →', actionPath: '/',
    },
    {
      id: 'live', sectionTitle: '🔴 Live City',
      title: 'Live City Activity',
      description: 'Watch what\'s happening right now in Mai Troll — streams starting, gifts flying, battles launching, arrests being made.',
      targetId: 'tc-live', actionLabel: 'See the city live →', actionPath: '/tcnn',
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const featureAccent: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan:   { bg: 'bg-cyan-500/15',        border: 'border-cyan-500/30',    text: 'text-cyan-300',    glow: '0 0 20px rgba(34,211,238,0.25)' },
  pink:   { bg: 'bg-pink-500/15',        border: 'border-pink-500/30',    text: 'text-pink-300',    glow: '0 0 20px rgba(244,114,182,0.25)' },
  purple: { bg: 'bg-purple-500/15',      border: 'border-purple-500/30',  text: 'text-purple-300',  glow: '0 0 20px rgba(167,139,250,0.25)' },
  gold:   { bg: 'bg-yellow-500/15',      border: 'border-yellow-500/30',  text: 'text-yellow-300',  glow: '0 0 20px rgba(250,204,21,0.25)' },
  green:  { bg: 'bg-emerald-500/15',     border: 'border-emerald-500/30', text: 'text-emerald-300', glow: '0 0 20px rgba(52,211,153,0.25)' },
  amber:  { bg: 'bg-amber-500/15',       border: 'border-amber-500/30',   text: 'text-amber-300',   glow: '0 0 20px rgba(251,191,36,0.25)' },
}

const stepAccent = [
  'from-purple-500/30 to-pink-500/30',
  'from-cyan-500/30 to-blue-500/30',
  'from-amber-500/30 to-orange-500/30',
  'from-emerald-500/30 to-teal-500/30',
  'from-pink-500/30 to-rose-500/30',
  'from-indigo-500/30 to-violet-500/30',
  'from-yellow-500/30 to-lime-500/30',
]

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CityMapGuidePreview() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // ── Live events (useGlobalActivity with demo fallback) ────────────────────
  const liveEvents = useGlobalActivity()
  const [displayEvents, setDisplayEvents] = useState<ActivityEvent[]>(LIVE_CITY_EVENTS)

  useEffect(() => {
    if (liveEvents.length > 0) {
      setDisplayEvents(liveEvents.slice(0, 12))
    }
  }, [liveEvents])

  // ── Beginner checklist state ───────────────────────────────────────────────
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set([1, 3]))

  const toggleStep = (n: number) =>
    setCheckedSteps(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })

  // ── Ref for tour highlight offset ─────────────────────────────────────────
  const tourRef = useRef<HTMLDivElement>(null)

  // ── District navigation ───────────────────────────────────────────────────
  const districtRoutes: Record<string, { path: string; auth: boolean; label?: string }> = {
    broadcast:    { path: '/live',                         auth: false },
    battle:       { path: '/live',                         auth: false },
    court:        { path: '/troll-court',                  auth: false },
    utromail:     { path: '/utromail',                     auth: false },
    neighborhood: { path: '/neighborhood-setup',             auth: false },
    coins:        { path: '/coin-store',                   auth: false },
    tcnn:         { path: '/tcnn',                         auth: false },

  }

  const goToDistrict = (d: District) => {
    const route = districtRoutes[d.id]
    if (!route) { return } // currently only hit if `id` not in map
    navigate(route.path)
  }

  // ── Tour mode ──────────────────────────────────────────────────────────────
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const tourSteps = useRef(buildTourSteps())
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null)

  const openTour = useCallback(() => {
    setTourStep(0)
    setTourOpen(true)
    setActiveTargetId(tourSteps.current[0].targetId)
  }, [])

  const advanceTour = useCallback(() => {
    const next = Math.min(tourStep + 1, tourSteps.current.length - 1)
    setTourStep(next)
    setActiveTargetId(tourSteps.current[next].targetId)
  }, [tourStep])

  const prevTour = useCallback(() => {
    const prev = Math.max(tourStep - 1, 0)
    setTourStep(prev)
    setActiveTargetId(tourSteps.current[prev].targetId)
  }, [tourStep])

  const closeTour = useCallback(() => {
    setTourOpen(false)
    setActiveTargetId(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Highlight wrapper used on tour target sections
  const highlightClass = activeTargetId
    ? 'ring-2 ring-cyan-400/80 ring-offset-2 ring-offset-[#020617] rounded-3xl transition-all duration-500'
    : ''

  return (
    <div className="min-h-screen overflow-x-hidden relative font-sans"
      style={{ background: 'linear-gradient(135deg,#020617 0%,#0f172a 46%,#020617 100%)' }}>

      {/* ══════════════════════════════════════════════════
          ANIMATED BACKGROUND
      ══════════════════════════════════════════════════ */}
      <div className="fixed inset-0 -z-20 overflow-hidden pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slateg-950 via-[#070d1f] to-[#0a0720]" />

        {/* Radial glows */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,rgba(139,92,246,0.22),transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_85%,rgba(6,182,212,0.18),transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(236,72,153,0.14),transparent_48%)]" />

        {/* City grid ─── animated to feel alive */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139,92,246,0.6) 1px,transparent 1px),
              linear-gradient(90deg,rgba(139,92,246,0.6) 1px,transparent 1px)`,
            backgroundSize: '44px 44px',
            animation: 'grid-drift 20s linear infinite',
          }} />

        {/* Floating glow orbs */}
        <GlowOrb size="w-80 h-80" top="-30%" left="-10%" color="purple" delay="0s" />
        <GlowOrb size="w-96 h-96" top="60%" right="-15%" color="cyan"  delay="3s" />
        <GlowOrb size="w-64 h-64" top="30%" left="50%"  color="pink"  delay="6s" />
        <GlowOrb size="w-72 h-72" top="70%" left="20%"  color="blue"  delay="9s" />

        {/* Ground reflection gradient */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[rgba(2,6,23,0.7)] to-transparent" />
      </div>

      <style>{`@keyframes grid-drift{0%{transform:translate(0,0)}100%{transform:translate(44px,44px)}}`}</style>

      {/* ══════════════════════════════════════════════════
          TOUR MODE OVERLAY
      ══════════════════════════════════════════════════ */}
      {tourOpen && (
        <CityTourOverlay
          step={tourSteps.current[tourStep]}
          stepIndex={tourStep}
          totalSteps={tourSteps.current.length}
          onNext={advanceTour}
          onPrev={prevTour}
          onClose={closeTour}
          onVisit={() => { closeTour(); navigate(tourSteps.current[tourStep].actionPath) }}
        />
      )}

      {/* ══════════════════════════════════════════════════
          DEV PREVIEW BADGE
      ══════════════════════════════════════════════════ */}
      <DevPreviewBadge />

      {/* ══════════════════════════════════════════════════
          MAIN SCROLL CONTAINER
      ══════════════════════════════════════════════════ */}
      <div className="relative z-10" ref={tourRef}>

        {/* ─────────────────────────────────────────────────
            HERO
        ───────────────────────────────────────────────── */}
        <section id="tc-hero" className={cn('relative pt-10 pb-20 px-4 md:px-8', highlightClass)}>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-12 items-center">

              {/* Left copy */}
              <div className="flex-1 text-center lg:text-left space-y-6">
                {/* Status pill */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                  bg-cyan-500/10 border border-cyan-500/25 animate-pulse-slow">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-300 font-semibold text-sm">
                    Friday Battle Day — Live Now
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight">
                  <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400
                    bg-clip-text text-transparent">
                    Welcome to
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400
                    bg-clip-text text-transparent">
                    Mai Troll
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  A live broadcasting city where battles, courts, neighborhoods, gifts, XP, and city drama all connect. <em>Here is where everything happens.</em>
                </p>

                {/* Primary CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-2">
                  <PrimaryBtn label="Start Exploring" onClick={openTour} />
                  <PrimaryBtn label="Go Live"            onClick={() => navigate('/broadcast/setup')} variant="outline" />
                  <PrimaryBtn label="Watch Broadcasts"   onClick={() => navigate('/live')}        variant="outline" />
                  <PrimaryBtn label="Join Battles"       onClick={() => navigate('/live')}        variant="outline" />
                </div>
              </div>

              {/* Right — city hologram preview */}
              <div className="hidden lg:flex flex-1 justify-center">
                <div className="relative w-full max-w-md animate-fade-in-slow">
                  {/* Glow ring */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20
                    blur-2xl scale-90" />
                  <div className="relative w-full rounded-3xl overflow-hidden
                    border border-white/[0.07]
                    bg-gradient-to-br from-slate-900/90 via-purple-900/40 to-slate-900/90
                    backdrop-blur-2xl shadow-[0_20px_70px_rgba(0,0,0,0.5)]">
                    {/* Building silhouettes */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 opacity-20"
                      style={{
                        background: `
                          repeating-linear-gradient(90deg,transparent,transparent 38px,rgba(139,92,246,0.6) 38px,rgba(139,92,246,0.6) 40px),
                          linear-gradient(0deg,rgba(6,182,212,0.15) 0%,transparent 100%)`,
                        backgroundSize: '40px 100%',
                        height: '100%',
                      }} />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(6,182,212,0.35),transparent_62%)]" />

                    {/* Center content */}
                    <div className="relative z-10 p-6 pt-10">
                      <div className="text-center space-y-4">
                        {/* Live indicator */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5
                          bg-red-600/90 backdrop-blur-md rounded-full
                          shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          <span className="text-white text-xs font-bold">1,247 ONLINE</span>
                        </div>

                        {/* Map pulse */}
                        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30
                            animate-ping-slow" />
                          <div className="absolute inset-2 rounded-full border border-purple-400/30
                            animate-ping-slow" style={{ animationDelay: '1s' }} />
                          <div className="w-20 h-20 rounded-full
                            bg-gradient-to-br from-cyan-500/30 to-purple-500/30
                            border border-cyan-400/50 flex items-center justify-center">
                            <MapPin className="w-9 h-9 text-cyan-300" />
                          </div>
                        </div>

                        {/* District dots around the pin */}
                        {DISTRICTS.map((d, i) => (
                          <MapPinDot key={d.id} district={d} index={i}
                            color={d.color.replace('text-', 'border-').replace('-400', '-400/60')} />
                        ))}

                        <p className="text-slate-400 text-xs">
                          Click any district to explore the city
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            CITY MAP — 8 DISTRICTS (3×3 grid with 1 empty cell)
        ───────────────────────────────────────────────── */}
        <section id="tc-districts"
          className={cn('py-16 px-4 md:px-8', highlightClass)}>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">City Districts</h2>
            </div>
            <p className="text-slate-400 mb-10 max-w-2xl">
              Each district is its own world. Click a card to enter — map routes and features are all inside the connected pages.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {DISTRICTS.map((d) => (
                <DistrictCard
                  key={d.id}
                  district={d}
                  onClick={() => goToDistrict(d)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            BEGINNER CHECKLIST
        ───────────────────────────────────────────────── */}
        <section id="tc-checklist" className={cn('py-16 px-4 md:px-8', highlightClass)}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <Flag className="w-5 h-5 text-emerald-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                What Should I Do First?
              </h2>
            </div>
            <p className="text-slate-400 mb-10 max-w-2xl">
              New in Mai Troll? Follow these 7 steps to understand every major feature.
            </p>

            <div className="space-y-3">
              {getDefaultSteps().map((step, i) => {
                const done = checkedSteps.has(step.step)
                const accent = stepAccent[step.step - 1] || stepAccent[0]
                return (
                  <ChecklistCard
                    key={step.step}
                    step={step}
                    done={done}
                    accent={accent}
                    onToggle={() => toggleStep(step.step)}
                    onGo={() => navigate(step.actionPath)}
                  />
                )
              })}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            FEATURE EXPLAINERS
        ───────────────────────────────────────────────── */}
        <section id="tc-features" className={cn('py-16 px-4 md:px-8', highlightClass)}>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <ScrollText className="w-5 h-5 text-gold-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">How the City Works</h2>
            </div>
            <p className="text-slate-400 mb-10 max-w-2xl">
              Six quick explanations for every major system you will interact with as a Mai Troll citizen.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map(f => (
                <FeatureExplainCard key={f.id} feature={f} />
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            ROLE PATHS
        ───────────────────────────────────────────────── */}
        <section id="tc-roles" className={cn('py-16 px-4 md:px-8', highlightClass)}>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <Crown className="w-5 h-5 text-amber-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">Find Your Role</h2>
            </div>
            <p className="text-slate-400 mb-10 max-w-2xl">
              Each path tells you <em>what you do, how to start, and where to go</em>.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ROLE_PATHS.map(role => (
                <RolePathCard key={role.id} role={role} onNavigate={navigate} />
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            LIVE CITY ACTIVITY
        ───────────────────────────────────────────────── */}
        <section id="tc-live" className={cn('py-16 px-4 md:px-8', highlightClass)}>
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">Live City Activity</h2>
            </div>
            <p className="text-slate-400 mb-8 max-w-2xl">
              Real-time city events from TCNN, battle scores, gifts, and jail notices.
            </p>

            {/* Ticker strip */}
            <LiveCityTicker events={displayEvents} />

            {/* Event feed */}
            <div className="mt-6 space-y-2">
              {displayEvents.map(ev => (
                <ActivityRow key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            FOOTER
        ───────────────────────────────────────────────── */}
        <footer className="py-10 px-4 border-t border-white/[0.06]">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-500/50" />
              <span>© 2026 MaiTroll. All rights reserved.</span>
            </div>
            <div className="flex gap-5">
              {['/legal/terms', '/legal/privacy', '/legal/safety', '/support'].map(p => (
                <Link key={p} to={p} className="hover:text-purple-400 transition-colors">
                  {p.split('/').pop()?.replace(/^\w/, c => c.toUpperCase())}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </div>

      {/* ══════════════════════════════════════════════════
          TOUR FLOATING CTA (always visible)
      ══════════════════════════════════════════════════ */}
      {!tourOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={openTour}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full
              bg-gradient-to-r from-cyan-600 to-purple-600
              text-white text-sm font-bold shadow-[0_0_30px_rgba(6,182,212,0.35)]
              hover:shadow-[0_0_45px_rgba(139,92,246,0.5)] hover:-translate-y-0.5
              transition-all duration-300">
            <Compass className="w-4 h-4" />
            Take the Tour
            <span className="text-white/60 hidden sm:inline">← swipe districts</span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          GLOBAL ANIMATIONS
      ══════════════════════════════════════════════════ */}
      <style>{`
        @keyframes ping-slow {
          0%   { transform:scale(1);   opacity:0.8 }
          75%  { transform:scale(2.2); opacity:0  }
          100% { transform:scale(2.2); opacity:0  }
        }
        @keyframes dialog-in {
          from { opacity:0; transform:scale(.96) translateY(10px) }
          to   { opacity:1; transform:scale(1) translateY(0)       }
        }
        @keyframes ticker-scroll {
          from { transform:translateX(0) }
          to   { transform:translateX(-50%) }
        }
        @keyframes dot-float {
          0%,100% { transform:translateY(0) }
          50%      { transform:translateY(-4px) }
        }
        .animate-ping-slow  { animation: ping-slow  3s cubic-bezier(.4,0,.6,1) infinite; }
        .animate-dialog-in  { animation: dialog-in  .3s ease-out forwards; }
        .animate-ticker     { animation: ticker-scroll 35s linear infinite; }
        .ticker-paused      { animation-play-state: paused; }
        .animate-dot-float  { animation: dot-float  2.5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   GLOW ORB BACKGROUND
════════════════════════════════════════════════════════════════════════════ */
function GlowOrb({ size, top, left, color, delay }: {
  size: string; top: string; left: string; color: string; delay: string
}) {
  const colorMap: Record<string, string> = {
    purple: 'rgba(139,92,246,0.28)',
    cyan:   'rgba(6,182,212,0.22)',
    pink:   'rgba(236,72,153,0.22)',
    blue:   'rgba(37,99,235,0.20)',
  }
  return (
    <div
      className={cn('absolute rounded-full blur-3xl', size)}
      style={{ top, left, background: colorMap[color] || colorMap.cyan, animationDelay: delay }}
    />
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   DEV PREVIEW BADGE
════════════════════════════════════════════════════════════════════════════ */
function DevPreviewBadge() {
  return (
    <div className="fixed top-4 right-4 z-[9999] hidden md:flex items-center gap-2
      px-3 py-1.5 bg-black/70 backdrop-blur-lg rounded-full border border-white/20 text-white/70 text-xs">
      <Sparkles className="w-3 h-3 text-amber-400" />
      <span>Dev Preview — City Map Guide</span>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   HOLOGRAPHIC MAP PIN DOT (spins around center in hero)
════════════════════════════════════════════════════════════════════════════ */
function MapPinDot({ district, index, color }: {
  district: District; index: number; color: string
}) {
  const angle = (index * 360 / DISTRICTS.length) - 90       // start at top
  const rad   = (angle * Math.PI) / 180
  const r     = 90                                         // px from center
  const cx    = `calc(50% + ${Math.cos(rad) * r}px)`
  const cy    = `calc(50% + ${Math.sin(rad) * r}px)`

  return (
    <div
      className="absolute w-3.5 h-3.5 rounded-full"
      style={{
        left: cx, top: cy, transform: 'translate(-50%,-50%)',
        border: `2px solid ${district.glow.replace('0 0 30px ', '')}`,
        background: district.glow.replace('0 0 30px ', '').replace('rgba', 'rgba').replace(',0.35)', ',0.9)'),
        boxShadow: district.glow,
        animation: `dot-float 2s ease-in-out infinite`,
        animationDelay: `${index * 0.2}s`,
      }}
    />
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   PRIMARY BUTTON
════════════════════════════════════════════════════════════════════════════ */
function PrimaryBtn({
  label, onClick, variant = 'filled',
}: { label: string; onClick?: () => void; variant?: 'filled' | 'outline' }) {
  const baseFilled =
    'px-5 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 rounded-xl font-bold text-white text-sm' +
    ' shadow-[0_0_25px_rgba(139,92,246,0.35)] hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(236,72,153,0.45)]' +
    ' transition-all duration-300 cursor-pointer'

  const baseOutline =
    'px-5 py-3 bg-slate-900/60 backdrop-blur-xl border border-white/[0.09] rounded-xl font-bold text-slate-200 text-sm' +
    ' hover:border-white/20 hover:bg-slate-800/60 transition-all duration-300 cursor-pointer'

  return (
    <button onClick={onClick} className={variant === 'filled' ? baseFilled : baseOutline}>
      {label}
    </button>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   DISTRICT CARD
════════════════════════════════════════════════════════════════════════════ */
function DistrictCard({
  district, onClick,
}: { district: District; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left p-5 rounded-2xl overflow-hidden
        bg-slate-900/65 backdrop-blur-xl border border-white/[0.07]
        hover:border-white/18 hover:bg-slate-800/55
        transition-all duration-300 cursor-pointer
        hover:-translate-y-1 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
      style={{ boxShadow: district.glow }}
    >
      {/* Highlighted gradient on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 75% 20%,${district.glow.replace('0 0 30px ', 'rgba(/ /)').replace('0.35)', '0.12)')})} transparent 70%`,
        }} />

      {/* Badge */}
      <div className="absolute top-4 right-4">
        <span className="block px-2 py-0.5 rounded-full text-[10px] font-bold border
          bg-opacity-20 backdrop-blur-sm"
          style={{
            background: district.glow,
            color: district.color.replace('text-', ''),
            borderColor: district.color.replace('text-', 'border-').replace('-400', '-500/30'),
          }}>
          {district.badgeText}
        </span>
      </div>

      {/* Icon */}
      <div
        className="mb-3 p-2.5 rounded-xl w-fit"
        style={{ background: `${district.glow.replace('0 0 30px ', '').replace('0.35)', '0.12)')}`, boxShadow: district.glow }}>
        <span className={district.color}>{district.icon}</span>
      </div>

      {/* Copy */}
      <h3 className="text-base font-bold text-white mb-1.5 pr-16">{district.name}</h3>
      <p className="text-slate-400 text-xs leading-relaxed mb-3 line-clamp-2">
        {district.description}
      </p>

      {/* Action arrow */}
      <span className="inline-flex items-center gap-1 text-xs font-semibold transition-all
        group-hover:gap-2"
        style={{ color: district.color }}>
        Explore <ArrowRight className="w-3.5 h-3.5" />
      </span>

      {/* Bottom glow line */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg,transparent,${district.color.replace('text-','')}/0.5,transparent)` }} />
    </button>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   CHECKLIST CARD
════════════════════════════════════════════════════════════════════════════ */
function ChecklistCard({
  step, done, accent, onToggle, onGo,
}: {
  step: ChecklistStep; done: boolean; accent: string
  onToggle: () => void; onGo: () => void
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border transition-all duration-300',
        done
          ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
          : 'border-white/[0.07] bg-slate-900/55 hover:border-white/15 hover:bg-slate-800/45',
      )}
    >
      <div className={cn(
        'absolute top-0 left-0 w-1.5 h-full rounded-l-2xl transition-all duration-300',
        done
          ? 'bg-gradient-to-b from-emerald-400 to-teal-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
          : 'bg-gradient-to-b from-purple-500 to-pink-500 opacity-50 group-hover:opacity-100 group-hover:shadow-[0_0_12px_rgba(139,92,246,0.5)]',
      )} />

      <div className="flex items-start gap-4 p-5 pl-7">
        {/* Step number */}
        <div className={cn(
          'mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-300',
          done
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
            : cn('bg-gradient-to-br text-white', accent),
        )}>
          {done ? <CheckIcon /> : step.step}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={cn('font-bold text-white transition-colors', done && 'text-emerald-200')}>
                {step.title}
              </h3>
              <p className="text-slate-400 text-sm mt-0.5 leading-relaxed">{step.description}</p>
            </div>
            {/* Done badge */}
            {done && (
              <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/15
                border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                <CheckIcon /> Done
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={onGo}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg
                bg-gradient-to-r from-purple-600/25 to-cyan-600/25 text-[13px] font-semibold text-white/90
                hover:from-purple-600/40 hover:to-cyan-600/40 transition-all
                border border-white/[0.09] hover:border-white/20">
              {step.actionLabel}
            </button>
            <button
              onClick={onToggle}
              className="px-3 py-1.5 rounded-lg text-[11px] text-slate-500 hover:text-slate-300
                transition-colors border border-white/[0.05] hover:border-white/10">
              {done ? 'Mark incomplete' : 'Mark done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   FEATURE EXPLAINER CARD
════════════════════════════════════════════════════════════════════════════ */
function FeatureExplainCard({ feature }: { feature: FeatureExplain }) {
  const a = featureAccent[feature.color]
  return (
    <div className="group p-5 rounded-2xl bg-slate-900/55 border border-white/[0.07]
      hover:border-white/15 hover:bg-slate-800/45 transition-all duration-300
      hover:-translate-y-0.5"
      style={{ boxShadow: a.glow }}>
      <div className={cn('inline-flex items-center gap-3 px-3 py-2 rounded-xl mb-4', a.bg, a.border)}>
        <span className={a.text}>{feature.icon}</span>
        <h3 className={cn('text-sm font-bold', a.text)}>{feature.title}</h3>
      </div>
      <p className="text-slate-400 text-[13px] leading-relaxed">{feature.content}</p>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   ROLE PATH CARD
════════════════════════════════════════════════════════════════════════════ */
function RolePathCard({
  role, onNavigate,
}: { role: RolePath; onNavigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900/55 border border-white/[0.07]
      hover:border-white/15 transition-all duration-300 group"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      {/* Accent top strip */}
      <div className="h-1 bg-gradient-to-r from-purple-600 to-cyan-500 opacity-70" />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <span className={role.color}>{role.icon}</span>
          </div>
          <h3 className="font-bold text-white text-sm">{role.name}</h3>
        </div>

        <p className="text-slate-500 text-xs leading-relaxed mb-3">{role.description}</p>

        {/* Expanded details */}
        {expanded && (
          <div className="space-y-2 mb-3 animate-fade-in">
            <DetailBlock label="What you do" lines={role.whatYouDo}
              colorClass="text-cyan-300/90" />
            <DetailLine label="How to start" content={role.howToStart} colorClass="text-purple-300/90" />
            <DetailLine label="Where to go" content={role.whereToGo} colorClass="text-pink-300/90" isPath />
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors">
          {expanded ? 'Less ↑' : `What you do ↓`}
        </button>

        {/* Go button */}
        <button
          onClick={() => onNavigate(role.whereToGo)}
          className="mt-3 w-full py-2 rounded-xl font-bold text-xs text-white
            bg-gradient-to-r from-purple-600/30 to-cyan-600/30
            border border-white/[0.09] hover:border-white/20
            hover:from-purple-600/50 hover:to-cyan-600/50 transition-all">
          Go to {role.name}
        </button>
      </div>

      {/* Hover accent */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 opacity-0 group-hover:opacity-70 transition-opacity
        bg-gradient-to-r from-purple-500 to-cyan-500" />
    </div>
  )
}

function DetailBlock({ label, lines, colorClass }: {
  label: string; lines: string[]; colorClass: string
}) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <ul className="mt-1 space-y-0.5">
        {lines.map((line, i) => (
          <li key={i} className={cn('text-xs flex items-start gap-1.5', colorClass)}>
            <Star className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" fill="currentColor" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DetailLine({ label, content, colorClass, isPath }: {
  label: string; content: string; colorClass: string; isPath?: boolean
}) {
  const displayLabel = isPath
    ? content.split('/').pop()?.replace(/^\w/, c => c.toUpperCase()) || content
    : content
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <p className={cn('text-xs mt-0.5', colorClass)}>
        {isPath ? <code className="opacity-70">{content}</code> : displayLabel}
      </p>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   LIVE CITY TICKER (in-page, self-contained)
════════════════════════════════════════════════════════════════════════════ */
function LiveCityTicker({ events }: { events: ActivityEvent[] }) {
  const [paused, setPaused] = useState(false)
  const extra = Array.from({ length: Math.max(0, 6 - events.length) }).map((_, i) => ({
    id: `fill-${i}`,
    type: 'system' as const,
    message: i % 2 === 0
      ? '🏙️ The city is alive — watch for new events!'
      : '💬 A gift was just sent in the Broadcast District.',
    priority: 'low' as const,
    created_at: new Date().toISOString(),
  }))
  const all = [...events, ...extra]

  const double = [...all, ...all.map(e => ({ ...e, id: `${e.id}-dup` }))]

  const tickStyle = paused ? 'ticker-paused' : 'animate-ticker'

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-slate-900/65 border border-white/[0.07]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Gradient fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-slate-900 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-slate-900 to-transparent z-10" />

      <div className={cn('flex whitespace-nowrap py-3', tickStyle)}>
        {double.map((ev, i) => {
          const a = featureAccent[
            ev.type === 'gift' ? 'pink' :
            ev.type === 'battle' ? 'amber' :
            ev.type === 'tcnn_live' ? 'purple' :
            'cyan'
          ]
          return (
            <div key={ev.id + i}
              className={cn('inline-flex items-center gap-2 px-4 shrink-0', a.text)}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span className="text-xs font-medium text-slate-200">{ev.message}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   ACTIVITY ROW
════════════════════════════════════════════════════════════════════════════ */
function ActivityRow({ event }: { event: ActivityEvent }) {
  const a = featureAccent[
    event.type === 'gift' ? 'pink' :
    event.type === 'battle' ? 'amber' :
    event.type === 'tcnn_live' ? 'purple' :
    event.type === 'tcnn_breaking' ? 'red' :
    'cyan'
  ]

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer',
      'bg-slate-900/45 border-white/[0.05] hover:border-white/12 hover:bg-slate-800/40'
    )}>
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', a.bg, a.border)}>
        <span className={cn('text-xs font-bold', a.text)}>
          {event.type === 'gift' ? 'GIFT'
            : event.type === 'battle' ? '⚔️'
            : event.type === 'tcnn_live' ? '📰'
            : event.type === 'tcnn_breaking' ? '🚨'
            : '🔵'}
        </span>
      </div>
      <p className="flex-1 text-sm text-slate-200 truncate">{event.message}</p>
      <span className={cn(
        'flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border',
        event.priority === 'high' || event.priority === 'breaking'
          ? 'bg-red-500/15 text-red-400 border-red-500/25'
          : 'bg-white/[0.04] text-slate-500 border-white/[0.08]'
      )}>
        {event.priority}
      </span>
    </div>
  )
}

/* ═════════════════════════════════════════════════════════════════════════════
   CITY TOUR OVERLAY
════════════════════════════════════════════════════════════════════════════ */
function CityTourOverlay({
  step, stepIndex, totalSteps,
  onNext, onPrev, onClose, onVisit,
}: {
  step: TourStep; stepIndex: number; totalSteps: number
  onNext: () => void; onPrev: () => void; onClose: () => void; onVisit: () => void
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') onNext()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onNext, onPrev, onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center md:items-center justify-center p-4
      bg-[#020617]/90 backdrop-blur-sm">
      <div className="animate-dialog-in w-full max-w-lg
        bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900
        border border-cyan-400/25 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(6,182,212,0.18)]">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">
              {step.sectionTitle}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i}
                  className={cn(
                    'h-1 rounded-full transition-all duration-300',
                    i <= stepIndex ? 'w-6 bg-cyan-400' : 'w-2 bg-white/15',
                  )} />
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400
              hover:text-white transition-colors border border-white/[0.08]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-4">
          <h3 className="text-xl md:text-2xl font-black text-white leading-tight">
            {step.title}
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>

          {/* CTA */}
          <button
            onClick={onVisit}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm
              bg-gradient-to-r from-cyan-600 to-purple-600
              shadow-[0_0_30px_rgba(6,182,212,0.3)]
              hover:shadow-[0_0_45px_rgba(139,92,246,0.45)]
              hover:-translate-y-0.5 transition-all duration-300
              flex items-center justify-center gap-2">
            <Compass className="w-4 h-4" />
            {step.actionLabel}
          </button>

          {/* Footer nav */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={onPrev}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-slate-400
                hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
                border border-white/[0.08] hover:border-white/18 transition-all">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <span className="text-xs text-slate-600">
              {stepIndex + 1} / {totalSteps}
            </span>

            <button
              onClick={onNext}
              disabled={stepIndex === totalSteps - 1}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-white font-semibold
                bg-gradient-to-r from-purple-600/50 to-cyan-600/50 border border-white/[0.09]
                hover:from-purple-600/70 hover:to-cyan-600/70 hover:border-white/20
                disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

