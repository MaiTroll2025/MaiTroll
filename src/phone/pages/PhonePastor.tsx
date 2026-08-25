import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Heart,
  MessageCircleHeart,
  Sparkles,
  Users,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

export default function PhonePastor() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'counsel' | 'prayers' | 'community'>('counsel')

  const counselQueue = [
    { username: '@struggling_one', topic: 'Community conflict', urgency: 'medium' },
    { username: '@new_member', topic: 'Guidance request', urgency: 'low' },
    { username: '@hurt_user', topic: 'Harassment recovery', urgency: 'high' },
  ]

  const prayers = [
    { from: '@faithful_one', request: 'Prayers for my family during difficult times', prayers: 12 },
    { from: '@hope_seeker', request: 'Strength to overcome personal challenges', prayers: 8 },
    { from: '@grateful_heart', request: 'Gratitude for this amazing community', prayers: 24 },
  ]

  const communityStats = [
    { label: 'Souls Helped', value: '156', icon: <Heart size={16} /> },
    { label: 'Prayers Said', value: '1.2K', icon: <MessageCircleHeart size={16} /> },
    { label: 'Sessions', value: '48', icon: <BookOpen size={16} /> },
  ]

  return (
    <div className="min-h-screen w-full bg-[#05010f] text-white pb-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/15 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-[#05010f]/90 backdrop-blur-2xl">
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
              Pastor
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Spiritual Guidance
            </p>
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 active:scale-95"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 py-4 space-y-4">
        <section className={`relative overflow-hidden rounded-3xl p-5 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-[#BF00FF]/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-[#BF00FF] shadow-[0_0_25px_rgba(251,191,36,0.3)]">
              <BookOpen size={28} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Troll Community Church
              </p>
              <h2 className={`text-xl font-black ${neonTextGradient}`}>
                Pastor Dashboard
              </h2>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            {communityStats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                <div className="flex justify-center text-amber-400 mb-1">{stat.icon}</div>
                <p className="text-lg font-black text-white">{stat.value}</p>
                <p className="text-[7px] uppercase text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'counsel' as const, label: 'Counsel', icon: <Heart size={16} /> },
            { key: 'prayers' as const, label: 'Prayers', icon: <Sparkles size={16} /> },
            { key: 'community' as const, label: 'Community', icon: <Users size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-[10px] font-black uppercase tracking-wide transition active:scale-95 ${
                activeTab === tab.key
                  ? 'border-amber-400/40 bg-amber-400/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-zinc-500'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'counsel' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Counsel Queue
            </h3>
            {counselQueue.map((session, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white/90">{session.username}</p>
                    <p className="text-[10px] text-white/50">{session.topic}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${
                      session.urgency === 'high'
                        ? 'border-red-400/30 bg-red-400/10 text-red-400'
                        : session.urgency === 'medium'
                          ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                          : 'border-green-400/30 bg-green-400/10 text-green-400'
                    }`}
                  >
                    {session.urgency}
                  </span>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl bg-gradient-to-r from-amber-500 to-[#BF00FF] py-2 text-[10px] font-black uppercase tracking-wide active:scale-[0.98]"
                >
                  Begin Session
                </button>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'prayers' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Prayer Requests
            </h3>
            {prayers.map((prayer, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs text-white/70 italic">"{prayer.request}"</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-amber-400">{prayer.from}</span>
                  <div className="flex items-center gap-1 text-[10px] text-white/50">
                    <MessageCircleHeart size={12} />
                    {prayer.prayers} prayers
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 py-2 text-[10px] font-bold text-amber-400 active:scale-[0.98]"
                >
                  <Sparkles size={12} />
                  Say Prayer
                </button>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'community' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Community Outreach
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex flex-col items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 active:scale-95"
              >
                <Users size={24} className="text-amber-400" />
                <span className="text-[10px] font-bold">New Members</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-2 rounded-2xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 p-4 active:scale-95"
              >
                <Heart size={24} className="text-[#BF00FF]" />
                <span className="text-[10px] font-bold">Wellness Check</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-2 rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/5 p-4 active:scale-95"
              >
                <BookOpen size={24} className="text-[#00BFFF]" />
                <span className="text-[10px] font-bold">Daily Devotional</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-2 rounded-2xl border border-green-400/20 bg-green-400/5 p-4 active:scale-95"
              >
                <MessageCircleHeart size={24} className="text-green-400" />
                <span className="text-[10px] font-bold">Encouragement</span>
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-[#BF00FF]/10 p-4 text-center">
          <Sparkles size={24} className="mx-auto text-amber-400" />
          <p className="mt-2 text-sm font-black">"Let your light shine before others."</p>
          <p className="text-[10px] text-white/40">Matthew 5:16</p>
        </section>
      </main>
    </div>
  )
}
