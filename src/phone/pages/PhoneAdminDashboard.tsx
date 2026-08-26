import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Crown,
  Gavel,
  Scale,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  Monitor,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'
import { useAuthStore } from '../../lib/store'
import { supabase } from '../../lib/supabase'

export default function PhoneAdminDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const isAdmin =
    profile?.is_admin === true ||
    ['admin', 'ceo', 'superadmin'].includes(profile?.role || '')

  const [rtcStats, setRtcStats] = useState({
    liveStreams: 0,
    onlineCount: 0,
    activeSessions: 0,
    totalMinutes: 0,
    totalUsers: 0,
  })
  const [rtcLoading, setRtcLoading] = useState(true)

  useEffect(() => {
    if (!isAdmin) return

    const fetchRtcStats = async () => {
      setRtcLoading(true)
      try {
        const [{ count: streamsCount }, { count: sessionsCount }, { count: totalUsers }] = await Promise.all([
          supabase.from('streams').select('id', { count: 'exact', head: true }).or('is_live.eq.true,status.eq.live'),
          supabase.from('rtc_sessions').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        ])

        let totalMinutes = 0
        try {
          const { data: totalRow } = await supabase
            .from('rtc_minute_totals')
            .select('total_minutes')
            .eq('id', 'global')
            .maybeSingle()
          totalMinutes = Number(totalRow?.total_minutes) || 0
        } catch {
          // non-critical
        }

        setRtcStats({
          liveStreams: streamsCount || 0,
          activeSessions: sessionsCount || 0,
          totalMinutes,
          totalUsers: totalUsers || 0,
          onlineCount: 0,
        })
      } catch (err) {
        console.error('[PhoneAdminDashboard] RTC fetch error:', err)
      } finally {
        setRtcLoading(false)
      }
    }

    fetchRtcStats()

    const interval = window.setInterval(fetchRtcStats, 15000)
    return () => window.clearInterval(interval)
  }, [isAdmin])

  const stats = [
    { label: 'Total Users', value: '12.4K', icon: <Users size={18} />, color: 'text-[#00BFFF]' },
    { label: 'Active Today', value: '3.2K', icon: <TrendingUp size={18} />, color: 'text-green-400' },
    { label: 'Revenue', value: '$48K', icon: <Wallet size={18} />, color: 'text-amber-400' },
    { label: 'Open Cases', value: '24', icon: <Scale size={18} />, color: 'text-[#BF00FF]' },
  ]

  const quickActions = [
    { label: 'Manage Users', icon: <Users size={20} />, path: '/admin/users', color: 'border-[#00BFFF]/30 bg-[#00BFFF]/10 text-[#00BFFF]' },
    { label: 'Court Cases', icon: <Gavel size={20} />, path: '/troll-court', color: 'border-amber-400/30 bg-amber-400/10 text-amber-400' },
    { label: 'Payouts', icon: <Wallet size={20} />, path: '/admin/payouts', color: 'border-green-400/30 bg-green-400/10 text-green-400' },
    { label: 'Reports', icon: <BarChart3 size={20} />, path: '/admin/reports', color: 'border-[#BF00FF]/30 bg-[#BF00FF]/10 text-[#BF00FF]' },
    { label: 'Moderation', icon: <Shield size={20} />, path: '/admin/moderation', color: 'border-red-400/30 bg-red-400/10 text-red-400' },
    { label: 'Settings', icon: <Settings size={20} />, path: '/admin/settings', color: 'border-white/30 bg-white/10 text-white' },
  ]

  const recentActivity = [
    { text: 'New cashout request from @trollking', time: '2m ago', type: 'payout' },
    { text: 'Court case filed: Harassment claim', time: '15m ago', type: 'court' },
    { text: 'User @newbie reported for spam', time: '1h ago', type: 'report' },
    { text: 'Payout completed: $50 to @streamer', time: '2h ago', type: 'payout' },
  ]

  return (
    <div className="min-h-screen w-full bg-[#05010f] text-white pb-8">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/15 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#05010f]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 active:scale-95"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              Admin Dashboard
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Control Center
            </p>
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 text-[#BF00FF] active:scale-95"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 py-4 space-y-4">
        {/* Welcome Banner */}
        <section className={`relative overflow-hidden rounded-3xl p-5 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/10 via-transparent to-[#BF00FF]/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_25px_rgba(0,191,255,0.4)]">
              <Crown size={28} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Welcome back
              </p>
              <h2 className={`text-xl font-black ${neonTextGradient}`}>
                Admin Control
              </h2>
            </div>
          </div>
        </section>

        {/* RTC Monitor - Admin Only */}
        {isAdmin && (
          <section className={`relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4`}>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
                  <Monitor size={20} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    RTC Monitor
                  </p>
                  <p className="text-xs font-black text-white">
                    {rtcLoading ? '...' : `${rtcStats.liveStreams} live • ${rtcStats.activeSessions} sessions`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin-mobile')}
                className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-cyan-300 active:scale-95"
              >
                Open
              </button>
            </div>
            <div className="relative mt-3 grid grid-cols-4 gap-2">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2 text-center">
                <p className="text-lg font-black text-red-400">{rtcStats.liveStreams}</p>
                <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Live</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2 text-center">
                <p className="text-lg font-black text-cyan-400">{rtcStats.activeSessions}</p>
                <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Sessions</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2 text-center">
                <p className="text-lg font-black text-amber-400">{rtcStats.totalMinutes}</p>
                <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Minutes</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2 text-center">
                <p className="text-lg font-black text-purple-400">{rtcStats.totalUsers}</p>
                <p className="text-[8px] font-black uppercase tracking-wider text-zinc-500">Users</p>
              </div>
            </div>
          </section>
        )}

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className={`mb-2 ${stat.color}`}>
                {stat.icon}
              </div>
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-black">{stat.value}</p>
            </div>
          ))}
        </section>

        {/* Quick Actions */}
        <section>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-zinc-400">
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.path)}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 active:scale-95 ${action.color}`}
              >
                {action.icon}
                <span className="text-[9px] font-black uppercase tracking-wide">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Activity Feed */}
        <section>
          <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-zinc-400">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00BFFF]/10 text-[#00BFFF]">
                    {activity.type === 'payout' && <Wallet size={14} />}
                    {activity.type === 'court' && <Scale size={14} />}
                    {activity.type === 'report' && <Shield size={14} />}
                  </div>
                  <p className="text-xs text-white/70">{activity.text}</p>
                </div>
                <span className="shrink-0 text-[9px] text-zinc-500">{activity.time}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
