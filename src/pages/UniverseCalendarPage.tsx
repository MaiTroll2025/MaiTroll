import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Calendar as CalIcon, ArrowLeft, EyeOff, Eye } from 'lucide-react'

function Cell({ day, events, matches, onOpen }: any) {
  const dayEvents = events.filter((e: any) => new Date(e.scheduled_start).toDateString() === day.toDateString())
  return (
    <div className={`min-h-[92px] rounded-xl border border-white/5 bg-white/[0.02] p-1.5 ${day.getMonth() !== new Date().getMonth() ? 'opacity-40' : ''}`}>
      <div className="text-[10px] text-slate-500">{day.getDate()}</div>
      {dayEvents.map((e: any) => (
        <button key={e.id} onClick={() => onOpen(e)} className="mt-1 w-full rounded-md bg-gradient-to-r from-indigo-500/30 to-fuchsia-500/30 px-1.5 py-0.5 text-left text-[10px] truncate">
          {new Date(e.scheduled_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · 7PM
        </button>
      ))}
      {matches.filter((m: any) => m.scheduled_start && new Date(m.scheduled_start).toDateString() === day.toDateString())
        .map((m: any) => (
          <div key={m.id} className="mt-1 flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">
            <EyeOff className="h-2.5 w-2.5" /> Opponent Hidden
          </div>
        ))}
    </div>
  )
}

export default function UniverseCalendarPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'month' | 'week' | 'upcoming'>('upcoming')
  const [events, setEvents] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [month, setMonth] = useState(new Date())

  const load = useCallback(async () => {
    const { data: ev } = await supabase.from('universe_events').select('*').order('scheduled_start', { ascending: true })
    setEvents(ev || [])
    // Matches are always shown opponent-hidden on the public calendar.
    // Per-event private match data is loaded in the Live/My Battles views
    // via the get_my_universe_matches() RPC (opponent nulled until reveal).
    setMatches([])
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: refresh on any event change broadcast
  useEffect(() => {
    const ch = supabase
      .channel('universe-calendar')
      .on('broadcast', { event: 'refresh' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [load])

  const weeks = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7)) // Monday-start
    const days = []
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d) }
    const w: Date[][] = []
    for (let i = 0; i < days.length; i += 7) w.push(days.slice(i, i + 7))
    return w
  }, [month])

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#020617_55%,_#000000_100%)]" />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/universe')} className="text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /></button>
          <CalIcon className="h-5 w-5 text-fuchsia-300" />
          <h1 className="text-xl font-black">Universe Calendar</h1>
          <div className="ml-auto flex gap-1 text-xs">
            {(['upcoming', 'week', 'month'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-lg px-2.5 py-1 ${view === v ? 'bg-fuchsia-500/30 text-white' : 'bg-white/5 text-slate-400'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">All battles start at <span className="text-amber-300">7:00 PM Mountain Time</span>. Opponents stay hidden until reveal.</p>

        {view === 'upcoming' && (
          <div className="space-y-2">
            {events.length === 0 && <p className="text-slate-500 text-sm">No scheduled battles.</p>}
            {events.map((e) => (
              <div key={e.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold">{e.title}</p>
                  <p className="text-xs text-slate-400">{new Date(e.scheduled_start).toLocaleDateString()} · 7:00 PM {mdLabel(new Date(e.scheduled_start))}</p>
                </div>
                <div className="flex items-center gap-2 text-amber-200 text-xs"><EyeOff className="h-3 w-3" /> Opponent Hidden</div>
              </div>
            ))}
          </div>
        )}

        {view === 'week' && (
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
            {weeks[0]?.map((d, i) => <Cell key={i} day={d} events={events} matches={matches} onOpen={() => {}} />)}
          </div>
        )}

        {view === 'month' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="px-3 py-1 rounded-lg bg-white/5">‹</button>
              <span className="font-bold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="px-3 py-1 rounded-lg bg-white/5">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}
            </div>
            {weeks.map((w, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {w.map((d, i) => <Cell key={i} day={d} events={events} matches={matches} onOpen={() => {}} />)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
