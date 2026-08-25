import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Crown,
  FileText,
  Gavel,
  LayoutDashboard,
  MessageCircle,
  Scale,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

export default function PhoneAdminDashboard() {
  const navigate = useNavigate()

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
