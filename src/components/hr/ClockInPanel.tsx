import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { LogIn, LogOut, Clock, RefreshCw, AlertTriangle } from 'lucide-react'

interface ClockInPanelProps {
  isHRAdmin: boolean
  currentUserId: string | undefined
  hasApprovedRole: boolean
}

interface WorkSession {
  id: string
  officer_id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number
  auto_clocked_out: boolean
  user?: { id: string; username: string } | null
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const formatHours = (hours: number): string => {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${h}h ${m}m`
}

export default function ClockInPanel({ isHRAdmin: _isHRAdmin, currentUserId, hasApprovedRole }: ClockInPanelProps) {
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null)
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([])
  const [weekSessions, setWeekSessions] = useState<WorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadClockData = async () => {
    if (!currentUserId) return
    setLoading(true)
    try {
      const { data: active } = await supabase
        .from('officer_work_sessions')
        .select('id, officer_id, clock_in, clock_out, hours_worked, auto_clocked_out')
        .eq('officer_id', currentUserId)
        .is('clock_out', null)
        .order('clock_in', { ascending: false })
        .limit(1)
        .maybeSingle()

      setActiveSession(active as any || null)

      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const startOfWeek = new Date(startOfDay)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

      const { data: daySessions } = await supabase
        .from('officer_work_sessions')
        .select('id, officer_id, clock_in, clock_out, hours_worked, auto_clocked_out')
        .eq('officer_id', currentUserId)
        .gte('clock_in', startOfDay.toISOString())
        .order('clock_in', { ascending: false })
        .limit(50)

      setTodaySessions((daySessions as any) || [])

      const { data: weekData } = await supabase
        .from('officer_work_sessions')
        .select('id, officer_id, clock_in, clock_out, hours_worked, auto_clocked_out')
        .eq('officer_id', currentUserId)
        .gte('clock_in', startOfWeek.toISOString())
        .order('clock_in', { ascending: false })
        .limit(100)

      setWeekSessions((weekData as any) || [])
    } catch (err: any) {
      console.error('[HR] Clock data load error:', err)
      toast.error(err?.message || 'Failed to load clock data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClockData()
  }, [currentUserId])

  const handleClockToggle = async () => {
    if (!currentUserId) {
      toast.error('You must be signed in')
      return
    }

    if (!hasApprovedRole) {
      toast.error('You must have an approved role to clock in')
      return
    }

    setActionLoading(true)
    try {
      if (activeSession) {
        const { error } = await supabase.rpc('manual_clock_out', { p_session_id: activeSession.id })
        if (error) throw error
        toast.success('Clocked out successfully')
      } else {
        const { error } = await supabase.rpc('manual_clock_in', { p_officer_id: currentUserId })
        if (error) throw error
        toast.success('Clocked in successfully')
      }
      await loadClockData()
    } catch (err: any) {
      console.error('[HR] Clock toggle error:', err)
      toast.error(err?.message || 'Failed to toggle clock status')
    } finally {
      setActionLoading(false)
    }
  }

  const todayTotalMs = useMemo(() => {
    return todaySessions.reduce((sum, s) => {
      const start = new Date(s.clock_in).getTime()
      const end = s.clock_out ? new Date(s.clock_out).getTime() : now
      return sum + Math.max(0, end - start)
    }, 0)
  }, [todaySessions, now])

  const weekTotalMs = useMemo(() => {
    return weekSessions.reduce((sum, s) => {
      const start = new Date(s.clock_in).getTime()
      const end = s.clock_out ? new Date(s.clock_out).getTime() : now
      return sum + Math.max(0, end - start)
    }, 0)
  }, [weekSessions, now])

  const todayHours = useMemo(() => {
    return todaySessions.reduce((sum, s) => {
      if (s.clock_out) return sum + (s.hours_worked || 0)
      const start = new Date(s.clock_in).getTime()
      return sum + Math.max(0, (now - start) / (1000 * 60 * 60))
    }, 0)
  }, [todaySessions, now])

  const weekHours = useMemo(() => {
    return weekSessions.reduce((sum, s) => {
      if (s.clock_out) return sum + (s.hours_worked || 0)
      const start = new Date(s.clock_in).getTime()
      return sum + Math.max(0, (now - start) / (1000 * 60 * 60))
    }, 0)
  }, [weekSessions, now])

  const activeSince = activeSession ? new Date(activeSession.clock_in) : null
  const activeDurationMs = activeSince ? now - activeSince.getTime() : 0

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
        Loading clock data...
      </div>
    )
  }

  if (!hasApprovedRole) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-black text-white">Clock In / Out</h3>
          <p className="text-xs text-slate-400">Time tracking for approved role holders.</p>
        </div>
        <div className="rounded-3xl border border-amber-300/20 bg-amber-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-sm font-bold text-amber-100">Role Approval Required</p>
              <p className="mt-1 text-xs text-amber-200/80">
                 You do not currently have an approved role. Apply for a role through the Applications tab or the Jobs page to access time tracking.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Clock In / Out</h3>
          <p className="text-xs text-slate-400">Track your work time for payroll processing.</p>
        </div>
        <button
          type="button"
          onClick={loadClockData}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Current Status</p>
          <p className="mt-2 text-2xl font-black text-white">
            {activeSession ? 'Clocked In' : 'Off Duty'}
          </p>
          {activeSince && (
            <p className="mt-1 text-xs text-slate-400">
              Since {activeSince.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Today Total</p>
          <p className="mt-2 text-2xl font-black text-cyan-300">{formatDuration(todayTotalMs)}</p>
          <p className="mt-1 text-xs text-slate-400">{formatHours(todayHours)} worked</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">This Week</p>
          <p className="mt-2 text-2xl font-black text-purple-300">{formatDuration(weekTotalMs)}</p>
          <p className="mt-1 text-xs text-slate-400">{formatHours(weekHours)} worked</p>
        </div>
      </div>

      {activeSession && (
        <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Active Shift</p>
              <p className="mt-1 text-lg font-black text-white">{formatDuration(activeDurationMs)}</p>
              <p className="text-xs text-slate-400">Started {activeSince?.toLocaleString()}</p>
            </div>
            <div className="h-16 w-16 rounded-full border-4 border-emerald-400/40 bg-emerald-500/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-emerald-300" />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleClockToggle}
        disabled={actionLoading}
        className={`w-full rounded-3xl border px-6 py-4 text-base font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50 ${
          activeSession
            ? 'border-red-300/40 bg-red-500/15 text-red-50 hover:bg-red-500/25'
            : 'border-cyan-300/40 bg-cyan-500/15 text-cyan-50 hover:bg-cyan-500/25'
        }`}
      >
        {actionLoading ? (
          'Processing...'
        ) : activeSession ? (
          <span className="flex items-center justify-center gap-2">
            <LogOut className="h-5 w-5" />
            Clock Out
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <LogIn className="h-5 w-5" />
            Clock In
          </span>
        )}
      </button>

      {todaySessions.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-slate-300">Today&apos;s Sessions</h4>
          <div className="space-y-2">
            {todaySessions.map(session => {
              const start = new Date(session.clock_in)
              const end = session.clock_out ? new Date(session.clock_out) : null
              const duration = end ? end.getTime() - start.getTime() : now - start.getTime()
              return (
                <div key={session.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs">
                  <div className="flex items-center gap-3">
                    {session.auto_clocked_out ? (
                      <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-100">Auto</span>
                    ) : end ? (
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-100">Complete</span>
                    ) : (
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">Active</span>
                    )}
                    <span className="text-slate-300">
                      {start.toLocaleTimeString()} → {end ? end.toLocaleTimeString() : 'Now'}
                    </span>
                  </div>
                  <span className="font-mono text-slate-400">{formatDuration(duration)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
