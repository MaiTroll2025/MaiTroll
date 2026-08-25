import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Eye,
  Gavel,
  Search,
  Shield,
  ShieldAlert,
  Siren,
  UserX,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

export default function PhoneTrollOfficer() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'patrol' | 'reports' | 'enforce'>('patrol')

  const patrolQueue = [
    { username: '@spam_user1', reason: 'Spam in chat', severity: 'low' },
    { username: '@toxic_troll', reason: 'Harassment report', severity: 'high' },
    { username: '@fake_gifter', reason: 'Gift manipulation', severity: 'medium' },
    { username: '@ban_evader', reason: 'Alt account detected', severity: 'high' },
  ]

  const reports = [
    { id: 'RPT-101', reporter: '@good_user', reported: '@bad_actor', type: 'Harassment', status: 'open' },
    { id: 'RPT-102', reporter: '@streamer1', reported: '@viewer_x', type: 'Spam', status: 'open' },
    { id: 'RPT-103', reporter: '@mod_team', reported: '@scam_bot', type: 'Scam', status: 'investigating' },
  ]

  const recentActions = [
    { action: 'Warning issued', target: '@spam_user1', time: '10m ago' },
    { action: 'Mute applied', target: '@toxic_troll', time: '25m ago' },
    { action: 'Report closed', target: '@fake_gifter', time: '1h ago' },
  ]

  return (
    <div className="min-h-screen w-full bg-[#05010f] text-white pb-8">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-500/10 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#00BFFF]/15 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-red-500/20 bg-[#05010f]/90 backdrop-blur-2xl">
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
              Troll Officer
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Patrol & Enforce
            </p>
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 active:scale-95"
          >
            <Siren size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 py-4 space-y-4">
        <section className={`relative overflow-hidden rounded-3xl p-5 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-[#00BFFF]/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-[0_0_25px_rgba(239,68,68,0.4)]">
              <Shield size={28} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Troll Court Enforcement
              </p>
              <h2 className={`text-xl font-black ${neonTextGradient}`}>
                Officer Panel
              </h2>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-lg font-black text-red-400">8</p>
              <p className="text-[8px] uppercase text-zinc-500">Patrol</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-lg font-black text-[#00BFFF]">15</p>
              <p className="text-[8px] uppercase text-zinc-500">Reports</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
              <p className="text-lg font-black text-amber-400">3</p>
              <p className="text-[8px] uppercase text-zinc-500">Actions</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'patrol' as const, label: 'Patrol', icon: <Eye size={16} /> },
            { key: 'reports' as const, label: 'Reports', icon: <ShieldAlert size={16} /> },
            { key: 'enforce' as const, label: 'Actions', icon: <Gavel size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-[10px] font-black uppercase tracking-wide transition active:scale-95 ${
                activeTab === tab.key
                  ? 'border-red-400/40 bg-red-400/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-zinc-500'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'patrol' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Patrol Queue
              </h3>
              <button className="flex h-8 items-center gap-1 rounded-lg bg-red-500/10 px-3 text-[10px] font-bold text-red-400">
                <Search size={12} />
                Search
              </button>
            </div>
            {patrolQueue.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white/90">{item.username}</p>
                    <p className="text-[10px] text-white/50">{item.reason}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${
                      item.severity === 'high'
                        ? 'border-red-400/30 bg-red-400/10 text-red-400'
                        : item.severity === 'medium'
                          ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                          : 'border-white/20 bg-white/10 text-white/50'
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'reports' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Open Reports
            </h3>
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold text-zinc-500">{report.id}</p>
                    <h4 className="text-sm font-bold text-white/90">{report.type}</h4>
                    <p className="text-[10px] text-white/50">
                      {report.reporter} → {report.reported}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${
                      report.status === 'open'
                        ? 'border-red-400/30 bg-red-400/10 text-red-400'
                        : 'border-[#00BFFF]/30 bg-[#00BFFF]/10 text-[#00BFFF]'
                    }`}
                  >
                    {report.status}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'enforce' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Recent Actions
            </h3>
            {recentActions.map((action, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                  <UserX size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white/90">{action.action}</p>
                  <p className="text-[10px] text-white/50">{action.target}</p>
                </div>
                <span className="text-[9px] text-zinc-500">{action.time}</span>
              </div>
            ))}
          </section>
        )}

        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/troll-court')}
            className="flex items-center gap-3 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 active:scale-95"
          >
            <ShieldAlert size={20} className="text-red-400" />
            <span className="text-xs font-bold">File Report</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/5 p-4 active:scale-95"
          >
            <Eye size={20} className="text-[#00BFFF]" />
            <span className="text-xs font-bold">Watchlist</span>
          </button>
        </section>
      </main>
    </div>
  )
}
