import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  Bell,
  Crown,
  Gavel,
  Scale,
  Shield,
  Star,
  Sword,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

export default function PhoneLeadOfficer() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'cases' | 'officers' | 'powers'>('cases')

  const assignedCases = [
    { id: 'CASE-001', title: 'Harassment Claim', defendant: '@toxicuser', status: 'active' },
    { id: 'CASE-002', title: 'Scam Report', defendant: '@scammer99', status: 'review' },
    { id: 'CASE-003', title: 'Ban Appeal', defendant: '@bannedone', status: 'pending' },
  ]

  const officers = [
    { name: '@officer_jake', status: 'online', cases: 5 },
    { name: '@officer_maya', status: 'online', cases: 3 },
    { name: '@officer_lee', status: 'offline', cases: 2 },
    { name: '@officer_sam', status: 'on_break', cases: 4 },
  ]

  const powers = [
    { name: 'Summon User', description: 'Summon a user to court', icon: <Gavel size={18} />, tier: 'lead' },
    { name: 'Issue Ruling', description: 'Make binding decisions', icon: <Scale size={18} />, tier: 'lead' },
    { name: 'Assign Cases', description: 'Delegate to officers', icon: <Users size={18} />, tier: 'lead' },
    { name: 'Emergency Ban', description: 'Immediate suspension', icon: <Shield size={18} />, tier: 'lead' },
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
              Lead Officer
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Command Center
            </p>
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/5 text-amber-400 active:scale-95"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 py-4 space-y-4">
        {/* Role Banner */}
        <section className={`relative overflow-hidden rounded-3xl p-5 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-[#BF00FF]/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_25px_rgba(251,191,36,0.4)]">
              <Star size={28} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Troll Court Authority
              </p>
              <h2 className={`text-xl font-black ${neonTextGradient}`}>
                Lead Officer
              </h2>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-lg font-black text-amber-400">12</p>
              <p className="text-[8px] uppercase text-zinc-500">Cases</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-lg font-black text-[#00BFFF]">4</p>
              <p className="text-[8px] uppercase text-zinc-500">Officers</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-lg font-black text-[#BF00FF]">98%</p>
              <p className="text-[8px] uppercase text-zinc-500">Resolved</p>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'cases' as const, label: 'Cases', icon: <Gavel size={16} /> },
            { key: 'officers' as const, label: 'Officers', icon: <Users size={16} /> },
            { key: 'powers' as const, label: 'Powers', icon: <Zap size={16} /> },
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

        {/* Cases Tab */}
        {activeTab === 'cases' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Assigned Cases
            </h3>
            {assignedCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500">{caseItem.id}</p>
                    <h4 className="text-sm font-bold text-white/90">{caseItem.title}</h4>
                    <p className="text-[10px] text-white/50">vs {caseItem.defendant}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${
                      caseItem.status === 'active'
                        ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                        : caseItem.status === 'review'
                          ? 'border-[#00BFFF]/30 bg-[#00BFFF]/10 text-[#00BFFF]'
                          : 'border-white/20 bg-white/10 text-white/50'
                    }`}
                  >
                    {caseItem.status}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Officers Tab */}
        {activeTab === 'officers' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Officer Roster
            </h3>
            {officers.map((officer) => (
              <div
                key={officer.name}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00BFFF]/20 to-[#BF00FF]/20">
                  <Shield size={16} className="text-[#00BFFF]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white/90">{officer.name}</p>
                  <p className="text-[10px] text-white/50">{officer.cases} active cases</p>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    officer.status === 'online'
                      ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]'
                      : officer.status === 'on_break'
                        ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]'
                        : 'bg-zinc-600'
                  }`}
                />
              </div>
            ))}
          </section>
        )}

        {/* Powers Tab */}
        {activeTab === 'powers' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Authorized Powers
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {powers.map((power) => (
                <button
                  key={power.name}
                  type="button"
                  className="flex flex-col items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-center active:scale-95"
                >
                  <div className="text-amber-400">{power.icon}</div>
                  <span className="text-[10px] font-black text-white/90">{power.name}</span>
                  <span className="text-[8px] text-white/40">{power.description}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/troll-court')}
            className="flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 active:scale-95"
          >
            <Trophy size={20} className="text-amber-400" />
            <span className="text-xs font-bold">Open Court</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/5 p-4 active:scale-95"
          >
            <Award size={20} className="text-[#00BFFF]" />
            <span className="text-xs font-bold">Promote</span>
          </button>
        </section>
      </main>
    </div>
  )
}

