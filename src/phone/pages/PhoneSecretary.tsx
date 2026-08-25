import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  Calendar,
  ClipboardList,
  Clock,
  FileText,
  Mail,
  PenSquare,
  Search,
  Send,
  Users,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

export default function PhoneSecretary() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'notes' | 'schedule' | 'mail'>('notes')

  const notes = [
    { title: 'Court Docket Update', preview: '3 new cases scheduled for Friday...', date: 'Today' },
    { title: 'Officer Meeting Notes', preview: 'Discussed new moderation policies...', date: 'Yesterday' },
    { title: 'Admin Memo', preview: 'System maintenance scheduled for...', date: '2 days ago' },
  ]

  const schedule = [
    { time: '10:00 AM', title: 'Court Session Prep', status: 'upcoming' },
    { time: '2:00 PM', title: 'Officer Briefing', status: 'upcoming' },
    { time: '4:30 PM', title: 'Docket Review', status: 'pending' },
  ]

  const messages = [
    { from: 'Lead Officer', subject: 'Docket changes for tomorrow', unread: true },
    { from: 'Troll Officer', subject: 'Case evidence submitted', unread: true },
    { from: 'Admin', subject: 'Weekly report review', unread: false },
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
              Secretary
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              Court Clerk
            </p>
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 text-[#BF00FF] active:scale-95"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#BF00FF] shadow-[0_0_8px_rgba(191,0,255,0.8)]" />
          </button>
        </div>
      </header>

      <main className="relative z-10 px-4 py-4 space-y-4">
        {/* Role Banner */}
        <section className={`relative overflow-hidden rounded-3xl p-5 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/10 via-transparent to-[#BF00FF]/10" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-[#BF00FF] shadow-[0_0_25px_rgba(191,0,255,0.3)]">
              <PenSquare size={28} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Court Secretary
              </p>
              <h2 className={`text-xl font-black ${neonTextGradient}`}>
                Records & Docket
              </h2>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'notes' as const, label: 'Notes', icon: <PenSquare size={16} /> },
            { key: 'schedule' as const, label: 'Schedule', icon: <Calendar size={16} /> },
            { key: 'mail' as const, label: 'Mail', icon: <Mail size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-[10px] font-black uppercase tracking-wide transition active:scale-95 ${
                activeTab === tab.key
                  ? 'border-[#00BFFF]/40 bg-[#00BFFF]/15 text-white'
                  : 'border-white/10 bg-white/[0.03] text-zinc-500'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Recent Notes
              </h3>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00BFFF]/10 text-[#00BFFF]">
                <PenSquare size={14} />
              </button>
            </div>
            {notes.map((note, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white/90">{note.title}</h4>
                  <span className="text-[9px] text-zinc-500">{note.date}</span>
                </div>
                <p className="mt-1 text-xs text-white/50">{note.preview}</p>
              </div>
            ))}
          </section>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              Today's Schedule
            </h3>
            {schedule.map((event, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/5">
                  <Clock size={14} className="text-[#00BFFF]" />
                  <span className="text-[8px] font-bold text-[#00BFFF]">{event.time}</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white/90">{event.title}</h4>
                  <p className="text-[10px] text-zinc-500">{event.status}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Mail Tab */}
        {activeTab === 'mail' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Inbox
              </h3>
              <button className="flex h-8 items-center gap-1 rounded-lg bg-[#BF00FF]/10 px-3 text-[10px] font-bold text-[#BF00FF]">
                <Search size={12} />
                Search
              </button>
            </div>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-center gap-4 rounded-2xl border p-4 ${
                  msg.unread
                    ? 'border-[#BF00FF]/30 bg-[#BF00FF]/5'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00BFFF]/20 to-[#BF00FF]/20">
                  {msg.unread && (
                    <span className="absolute -ml-8 -mt-8 h-2 w-2 rounded-full bg-[#BF00FF]" />
                  )}
                  <Mail size={16} className={msg.unread ? 'text-[#BF00FF]' : 'text-zinc-500'} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white/90">{msg.from}</p>
                  <p className="truncate text-[10px] text-white/50">{msg.subject}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Quick Actions */}
        <section className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-[#00BFFF]/20 bg-[#00BFFF]/5 p-4 active:scale-95"
          >
            <ClipboardList size={20} className="text-[#00BFFF]" />
            <span className="text-xs font-bold">Docket List</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-[#BF00FF]/20 bg-[#BF00FF]/5 p-4 active:scale-95"
          >
            <Users size={20} className="text-[#BF00FF]" />
            <span className="text-xs font-bold">Officers</span>
          </button>
        </section>
      </main>
    </div>
  )
}
