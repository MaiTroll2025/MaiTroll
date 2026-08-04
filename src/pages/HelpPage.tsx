import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import {
  Home, Search, Compass, Bell, User, Video, Coins, MessageCircle,
  Sparkles, Mic, Gavel, Scale, Map, Gamepad2, GraduationCap,
  DollarSign, Trophy, Users, Store, Package, BookOpen, Shield,
  Car, Briefcase, Shuffle, Heart, Radio, Crown, Vote,
  LayoutGrid, Settings, Activity, ClipboardList, MonitorDot,
  Lock, Eye, Ban, FileText, Newspaper, Megaphone, Zap,
  Building2, Landmark, Waves, Receipt, BarChart3, TrendingUp,
} from 'lucide-react'

const PAGE_GUIDE: Record<string, { label: string; icon: any; desc: string; roles?: string[] }> = {
  '/home': { label: 'Home', icon: Home, desc: 'Main feed with live streams, posts, and city updates.' },
  '/search': { label: 'Search', icon: Search, desc: 'Find users, streams, posts, and marketplace items.' },
  '/explore': { label: 'Explore', icon: Compass, desc: 'Discover trending content and live broadcasts.' },
  '/notifications': { label: 'Notifications', icon: Bell, desc: 'Alerts, mentions, and system messages.' },
  '/profile': { label: 'Profile', icon: User, desc: 'Your public profile, stats, and settings.' },
  '/broadcast/setup': { label: 'Go Live', icon: Video, desc: 'Start a live stream or broadcast.' },
  '/store': { label: 'Coin Store', icon: Coins, desc: 'Buy troll coins and hype coins.' },
  '/utromail': { label: 'Chats', icon: MessageCircle, desc: 'Messages and conversations.' },
  '/treelz': { label: 'Treelz', icon: Sparkles, desc: 'Short-form video feed.' },
  '/podcast': { label: 'Podcast', icon: Mic, desc: 'Listen to audio shows and podcasts.' },
  '/auctions': { label: 'Live Auctions', icon: Gavel, desc: 'Bid on items in live auctions.' },
  '/troll-court': { label: 'Troll Court', icon: Scale, desc: 'Court sessions, cases, and appeals.' },
  '/neighborhood-map': { label: 'Neighborhood', icon: Map, desc: 'City map, neighborhoods, and local activity.' },
  '/hytrogaming': { label: 'HydroGaming', icon: Gamepad2, desc: 'Gaming streams and community.' },
  '/academy': { label: 'Academy', icon: GraduationCap, desc: 'Courses, classes, and certifications.' },
  '/mai-pay': { label: 'MAI Pay', icon: DollarSign, desc: 'Payments, cashouts, and financial tools.' },
  '/leaderboard': { label: 'Leaderboard', icon: Trophy, desc: 'Top users by XP, coins, and activity.' },
  '/family/home': { label: 'Troll Family', icon: Users, desc: 'Your family, chat, and family features.' },
  '/marketplace': { label: 'Shop', icon: Store, desc: 'Buy and sell items in the marketplace.' },
  '/inventory': { label: 'Inventory', icon: Package, desc: 'Items you own and manage.' },
  '/church': { label: 'Church', icon: BookOpen, desc: 'Troll Church events and community.' },
  '/safety': { label: 'Safety', icon: Shield, desc: 'Safety guidelines, policies, and help.' },
  '/ktauto': { label: 'Cars', icon: Car, desc: 'KTAuto dealership and vehicles.' },
  '/jobs': { label: 'Jobs', icon: Briefcase, desc: 'Jobs, applications, and career tools.' },
  '/troll-wheel': { label: 'Troll Wheel', icon: Shuffle, desc: 'Spin the wheel for rewards.' },
  '/match': { label: 'Troll Match', icon: Heart, desc: 'Match with other users.' },
  '/government': { label: 'Government', icon: Landmark, desc: 'Government feeds, elections, and officials.', roles: ['admin', 'secretary', 'officer', 'president'] },
  '/admin': { label: 'Admin Panel', icon: Settings, desc: 'Full admin dashboard and analytics.', roles: ['admin'] },
  '/admin/chat-moderation': { label: 'Chat Mod', icon: MessageCircle, desc: 'Moderate live chat across the platform.', roles: ['admin', 'officer'] },
  '/admin/jail-management': { label: 'Jail', icon: Lock, desc: 'Manage inmates and jail settings.', roles: ['admin', 'officer'] },
  '/admin/reports-queue': { label: 'Reports', icon: ClipboardList, desc: 'Review user reports and appeals.', roles: ['admin', 'officer'] },
  '/admin/stream-monitor': { label: 'Streams', icon: MonitorDot, desc: 'Monitor active broadcasts.', roles: ['admin'] },
  '/officer/dashboard': { label: 'Officer HQ', icon: Shield, desc: 'Officer dashboard and patrol tools.', roles: ['officer'] },
  '/lead-officer': { label: 'Lead HQ', icon: Crown, desc: 'Lead officer command center.', roles: ['lead_officer'] },
  '/secretary': { label: 'Secretary', icon: FileText, desc: 'Secretary console and executive tasks.', roles: ['secretary'] },
  '/president': { label: 'President', icon: Vote, desc: 'President dashboard and executive orders.', roles: ['president'] },
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  officer: 'Troll Officer',
  lead_officer: 'Lead Officer',
  secretary: 'Secretary',
  president: 'President',
  broadcaster: 'Broadcaster',
  auctioneer: 'Auctioneer',
  journalist: 'Journalist',
  pastor: 'Pastor',
  attorney: 'Attorney',
  prosecutor: 'Prosecutor',
}

export default function HelpPage() {
  const { profile } = useAuthStore()
  const role = String(profile?.role || '').toLowerCase()
  const trollRole = String(profile?.troll_role || '').toLowerCase()
  const userRoles = new Set([role, trollRole])

  const isAdmin = userRoles.has('admin') || profile?.is_admin
  const isOfficer = userRoles.has('troll_officer') || userRoles.has('officer') || profile?.is_troll_officer || profile?.is_lead_officer
  const isLead = userRoles.has('lead_troll_officer') || profile?.is_lead_officer
  const isSecretary = userRoles.has('secretary') || profile?.is_secretary
  const isPresident = userRoles.has('president') || profile?.is_president

  const visiblePages = Object.entries(PAGE_GUIDE).filter(([, page]) => {
    if (!page.roles) return true
    return page.roles.some((r) => userRoles.has(r) || (r === 'admin' && isAdmin) || (r === 'officer' && isOfficer) || (r === 'lead_officer' && isLead) || (r === 'secretary' && isSecretary) || (r === 'president' && isPresident))
  })

  const categories = [
    { title: 'General', paths: ['/home', '/search', '/explore', '/notifications', '/profile', '/safety'] },
    { title: 'Media & Social', paths: ['/broadcast/setup', '/treelz', '/podcast', '/utromail', '/family/home', '/match'] },
    { title: 'Economy', paths: ['/store', '/mai-pay', '/leaderboard', '/marketplace', '/inventory', '/auctions', '/troll-wheel'] },
    { title: 'Games & Learning', paths: ['/hytrogaming', '/academy', '/ktauto', '/jobs'] },
    { title: 'City & Government', paths: ['/neighborhood-map', '/church', '/troll-court', '/government'] },
    { title: 'Staff & Admin', paths: ['/admin', '/admin/chat-moderation', '/admin/jail-management', '/admin/reports-queue', '/admin/stream-monitor', '/officer/dashboard', '/lead-officer', '/secretary', '/president'] },
  ]

  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.12),transparent_30%)]" />
      </div>

      <section className="relative z-10 mx-auto max-w-3xl px-4 py-8 md:px-8">
        <header className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-8">
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Mai Troll
            <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-red-300 bg-clip-text text-transparent">
              Page Guide
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            A quick guide to every page in Mai Troll. Hover over tabs on web for quick hints, or browse this guide on mobile.
          </p>
          {isAdmin && (
            <p className="mt-2 text-xs font-bold text-cyan-300">Role: Admin — all pages visible</p>
          )}
          {isOfficer && !isAdmin && (
            <p className="mt-2 text-xs font-bold text-amber-300">Role: Officer — patrol and moderation tools available</p>
          )}
          {isSecretary && !isAdmin && (
            <p className="mt-2 text-xs font-bold text-purple-300">Role: Secretary — executive and admin support tools available</p>
          )}
          {isPresident && !isAdmin && (
            <p className="mt-2 text-xs font-bold text-red-300">Role: President — executive city tools available</p>
          )}
          {!isAdmin && !isOfficer && !isSecretary && !isPresident && (
            <p className="mt-2 text-xs font-bold text-slate-400">Role: Citizen — general access</p>
          )}
        </header>

        <div className="space-y-8">
          {categories.map((cat) => {
            const pages = cat.paths
              .map((p) => PAGE_GUIDE[p])
              .filter(Boolean)
            if (pages.length === 0) return null
            return (
              <section key={cat.title}>
                <h2 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-300/70">{cat.title}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pages.map((page) => {
                    const Icon = page.icon
                    return (
                      <Link
                        key={page.label}
                        to={cat.paths.find((p) => PAGE_GUIDE[p]?.label === page.label) || '#'}
                        className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-black text-white">{page.label}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-400">{page.desc}</p>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </main>
  )
}
